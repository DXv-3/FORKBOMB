// FORKBOMB shared hardened HTTP helpers for the zero-dependency static apps (shaders, gradients).
// - security headers + strict CSP (inline <script> blocks in served HTML are allowed by sha256 hash only)
// - GET/HEAD only, 405 with Allow otherwise; request bodies are never read
// - files are served only from an allow-listed root after realpath containment checks
// - no stack traces to clients; errors are logged server-side and answered with a generic message
// - request/header timeouts and graceful shutdown on SIGTERM/SIGINT
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".glsl": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".webmanifest": "application/manifest+json",
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg\+xml)/;
const BASE_CSP = {
  "default-src": ["'self'"], "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"], "media-src": ["'self'", "blob:"], "connect-src": ["'self'"],
  "object-src": ["'none'"], "base-uri": ["'none'"], "form-action": ["'none'"], "frame-ancestors": ["'none'"],
};
const cspString = (extraScript = []) => Object.entries(BASE_CSP)
  .map(([k, v]) => `${k} ${(k === "script-src" ? v.concat(extraScript) : v).join(" ")}`).join("; ");

function securityHeaders(extraScript) {
  return {
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), payment=()",
    "Content-Security-Policy": cspString(extraScript),
  };
}

// sha256 sources for every inline <script> (no src) in an HTML document.
function inlineScriptHashes(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (m[1] && /\bsrc\s*=/i.test(m[1])) continue;
    out.push(`'sha256-${crypto.createHash("sha256").update(m[2], "utf8").digest("base64")}'`);
  }
  return out;
}

// Pick br > gzip from Accept-Encoding (q=0 respected).
function pickEncoding(req) {
  const ae = String((req && req.headers["accept-encoding"]) || "");
  const ok = (n) => new RegExp(`(^|,)\\s*${n}\\s*(;\\s*q=(?!0(\\.0*)?\\s*(,|$))[0-9.]+)?\\s*(,|$)`, "i").test(ae);
  return ok("br") ? "br" : ok("gzip") ? "gzip" : null;
}
const zcache = new Map(); // etag+enc -> compressed buffer (bounded)
function compress(buf, enc, key) {
  const k = key && key + enc; if (k && zcache.has(k)) return zcache.get(k);
  const out = enc === "br" ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.gzipSync(buf, { level: 6 });
  if (k) { if (zcache.size > 256) zcache.delete(zcache.keys().next().value); zcache.set(k, out); }
  return out;
}

// opts: { etag, lastModified (Date), cache (Cache-Control) }. Handles conditional GET, HEAD and compression.
function send(res, code, type, body, extraHeaders = {}, opts = {}) {
  if (res.headersSent) return res.end();
  const req = res.req;
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const extraScript = type.startsWith("text/html") ? inlineScriptHashes(buf.toString("utf8")) : [];
  const h = { ...securityHeaders(extraScript), "Content-Type": type, "Cache-Control": opts.cache || "no-cache", ...extraHeaders };
  if (code === 200) {
    const etag = opts.etag || `"${crypto.createHash("sha1").update(buf).digest("base64url").slice(0, 27)}"`;
    h.ETag = etag;
    if (opts.lastModified) h["Last-Modified"] = opts.lastModified.toUTCString();
    const inm = req && req.headers["if-none-match"], ims = req && req.headers["if-modified-since"];
    const fresh = inm ? inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag) : (ims && opts.lastModified && Math.floor(opts.lastModified / 1000) <= Math.floor(Date.parse(ims) / 1000));
    if (fresh) { delete h["Content-Type"]; res.writeHead(304, h); return res.end(); }
    if (COMPRESSIBLE.test(type) && buf.length >= 1024) {
      h.Vary = "Accept-Encoding";
      const enc = pickEncoding(req);
      if (enc) { buf = compress(buf, enc, etag); h["Content-Encoding"] = enc; }
    }
  }
  h["Content-Length"] = buf.length;
  res.writeHead(code, h);
  res.end(req && req.method === "HEAD" ? undefined : buf);
}
const sendJson = (res, code, obj) => send(res, code, TYPES[".json"], JSON.stringify(obj));
const wantsHtml = (res) => /text\/html/.test(String((res.req && res.req.headers.accept) || ""));
const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 · FORKBOMB</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1117;color:#e6edf3;font:16px/1.5 system-ui,sans-serif;text-align:center}a{color:#ff9b6b}</style></head><body><main><h1>404</h1><p>Nothing lives at this address.</p><p><a href="/">Back to FORKBOMB</a></p></main></body></html>`;
const notFound = (res) => (wantsHtml(res) ? send(res, 404, TYPES[".html"], NOT_FOUND_HTML) : send(res, 404, TYPES[".txt"], "not found\n"));
// Relative redirects keep apps mountable under any prefix.
const redirect = (res, location, code = 301) => send(res, code, TYPES[".txt"], "moved\n", { Location: location });

// Serve one file, refusing anything that resolves (via .., symlinks, etc.) outside the allowed roots.
function sendFile(res, file, roots) {
  let real;
  try { real = fs.realpathSync(file); } catch { return notFound(res); }
  const ok = roots.some((r) => { const rr = fs.realpathSync(r); return real === rr || real.startsWith(rr + path.sep); });
  if (!ok) return notFound(res);
  fs.stat(real, (err, st) => {
    if (err || !st.isFile() || st.size > 8 * 1024 * 1024) return notFound(res);
    const type = TYPES[path.extname(real)] || "application/octet-stream";
    const etag = `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`.replace("W/", "");
    // Assets referenced as ?v=<content version> (added to HTML below) never change under that URL: cache them for a year.
    const versioned = /[?&]v=[A-Za-z0-9_-]+/.test(String(res.req && res.req.url));
    const cache = type.startsWith("text/html") ? "no-cache" : versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, stale-while-revalidate=86400";
    fs.readFile(real, (e, buf) => {
      if (e) return notFound(res);
      if (type.startsWith("text/html")) buf = Buffer.from(versionAssets(buf.toString("utf8"), path.dirname(real), roots));
      send(res, 200, type, buf, {}, { etag: type.startsWith("text/html") ? undefined : etag, lastModified: type.startsWith("text/html") ? undefined : st.mtime, cache });
    });
  });
}

// Append ?v=<size-mtime> to relative .js/.css references so they can be cached immutably and still bust on deploy.
const vcache = new Map(); // file:size:mtime -> content hash
function versionAssets(html, dir, roots) {
  return html.replace(/(<(?:script[^>]*\ssrc|link[^>]*\shref)=")([a-z0-9][a-z0-9._/-]*\.(?:js|css))(")/gi, (m, a, ref, z) => {
    try {
      const f = path.resolve(dir, ref), rr = roots.map((r) => fs.realpathSync(r));
      const cands = [f, ...rr.map((r) => path.join(r, path.basename(ref)))]; // e.g. include.js is served from the shaders root
      const hit = cands.find((c) => rr.some((r) => c.startsWith(r + path.sep)) && fs.existsSync(c));
      if (!hit) return m;
      const st = fs.statSync(hit), k = `${hit}:${st.size}:${st.mtimeMs}`;
      if (!vcache.has(k)) vcache.set(k, crypto.createHash("sha256").update(fs.readFileSync(hit)).digest("base64url").slice(0, 10));
      return `${a}${ref}?v=${vcache.get(k)}${z}`;
    } catch { return m; }
  });
}

const BRAND = path.join(__dirname, "..", "forkbomb", "public");

// Wrap a route function with method checks + error containment.
function staticHandler(route) {
  return (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, TYPES[".txt"], "method not allowed\n", { Allow: "GET, HEAD" });
      if (req.url.length > 2048) return send(res, 414, TYPES[".txt"], "uri too long\n");
      let url;
      try { url = new URL(req.url, "http://x"); } catch { return send(res, 400, TYPES[".txt"], "bad request\n"); }
      // standalone dev servers share the FORKBOMB favicon
      if (url.pathname === "/favicon.ico") return send(res, 200, TYPES[".ico"], require("../forkbomb/lib/favicon"), {}, { cache: "public, max-age=86400" });
      if (url.pathname === "/favicon.svg") return sendFile(res, path.join(BRAND, "favicon.svg"), [BRAND]);
      return route(req, res, url);
    } catch (e) {
      logger.error("request failed:", e && e.message);
      return send(res, 500, TYPES[".txt"], "internal error\n");
    }
  };
}

let logger = console;
const setLogger = (l) => { logger = l || console; };

function harden(server) {
  server.requestTimeout = 30e3;
  server.headersTimeout = 10e3;
  server.keepAliveTimeout = 5e3;
  server.maxHeadersCount = 64;
  return server;
}

// Graceful shutdown for `node server.js` (not used by tests): stop accepting, drain, then exit.
function shutdownOnSignals(server, { timeoutMs = 10e3, onClose } = {}) {
  let closing = false;
  const stop = (sig) => {
    if (closing) return; closing = true;
    console.log(`${sig}: shutting down`);
    const t = setTimeout(() => process.exit(1), timeoutMs); t.unref();
    server.close(() => { if (onClose) onClose(); process.exit(0); });
    if (server.closeIdleConnections) server.closeIdleConnections();
  };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
}

module.exports = { BRAND, setLogger, TYPES, NOT_FOUND_HTML, redirect, pickEncoding, compress, securityHeaders, inlineScriptHashes, cspString, send, sendJson, sendFile, notFound, staticHandler, harden, shutdownOnSignals };
