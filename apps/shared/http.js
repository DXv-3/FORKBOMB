// FORKBOMB shared hardened HTTP helpers for the zero-dependency static apps (shaders, gradients).
// - security headers + strict CSP (inline <script> blocks in served HTML are allowed by sha256 hash only)
// - GET/HEAD only, 405 with Allow otherwise; request bodies are never read
// - files are served only from an allow-listed root after realpath containment checks
// - no stack traces to clients; errors are logged server-side and answered with a generic message
// - request/header timeouts and graceful shutdown on SIGTERM/SIGINT
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".glsl": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};
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

function send(res, code, type, body, extraHeaders = {}) {
  if (res.headersSent) return res.end();
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const extraScript = type.startsWith("text/html") ? inlineScriptHashes(buf.toString("utf8")) : [];
  res.writeHead(code, { ...securityHeaders(extraScript), "Content-Type": type, "Content-Length": buf.length, "Cache-Control": "no-cache", ...extraHeaders });
  res.end(buf);
}
const sendJson = (res, code, obj) => send(res, code, TYPES[".json"], JSON.stringify(obj));
const notFound = (res) => send(res, 404, TYPES[".txt"], "not found\n");

// Serve one file, refusing anything that resolves (via .., symlinks, etc.) outside the allowed roots.
function sendFile(res, file, roots) {
  let real;
  try { real = fs.realpathSync(file); } catch { return notFound(res); }
  const ok = roots.some((r) => { const rr = fs.realpathSync(r); return real === rr || real.startsWith(rr + path.sep); });
  if (!ok) return notFound(res);
  fs.stat(real, (err, st) => {
    if (err || !st.isFile() || st.size > 8 * 1024 * 1024) return notFound(res);
    fs.readFile(real, (e, buf) => (e ? notFound(res) : send(res, 200, TYPES[path.extname(real)] || "application/octet-stream", buf)));
  });
}

// Wrap a route function with method checks + error containment.
function staticHandler(route) {
  return (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, TYPES[".txt"], "method not allowed\n", { Allow: "GET, HEAD" });
      if (req.url.length > 2048) return send(res, 414, TYPES[".txt"], "uri too long\n");
      let url;
      try { url = new URL(req.url, "http://x"); } catch { return send(res, 400, TYPES[".txt"], "bad request\n"); }
      return route(req, res, url);
    } catch (e) {
      console.error("request failed:", e && e.message);
      return send(res, 500, TYPES[".txt"], "internal error\n");
    }
  };
}

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

module.exports = { TYPES, securityHeaders, inlineScriptHashes, cspString, send, sendJson, sendFile, notFound, staticHandler, harden, shutdownOnSignals };
