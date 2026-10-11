#!/usr/bin/env node
// FORKBOMB Paste — zero-dependency pastebin. node apps/paste/server.js
// env: PORT, HOST, DATA_DIR, MAX_BYTES, RATE_LIMIT (writes/min/IP, default 30), READ_RATE_LIMIT (req/min/IP, default 600),
//      TRUST_PROXY=1 (use the first X-Forwarded-For hop as the client IP; only behind a proxy you control)
//      FSYNC=1 (fsync file + dir on write), MAX_STORAGE_BYTES / MAX_PASTES (storage cap, 507 when full; 0 = unlimited)
// For production, prefer the unified server: npm start at the repo root (apps/forkbomb/server.js).
"use strict";
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Store, ID_RE } = require("./lib/store");
const { RateLimiter } = require("./lib/ratelimit");
const R = require("./lib/render");
const fs = require("fs");
const zlib = require("zlib");
const VENDOR = path.join(__dirname, R.PRISM_DIR);
const VENDOR_RE = /^\/vendor\/prism-1\.29\.0\/((?:components|plugins\/autoloader|themes)\/prism-[a-z-]+\.min\.(?:js|css))$/;
const vendorCache = new Map(); // rel -> { buf, gz, br, etag, mtime }
function loadVendor(rel) {
  if (vendorCache.has(rel)) return vendorCache.get(rel);
  let buf, st; try { const f = path.join(VENDOR, rel); st = fs.statSync(f); buf = fs.readFileSync(f); } catch { return null; }
  const v = { buf, gz: zlib.gzipSync(buf), br: zlib.brotliCompressSync(buf), mtime: st.mtime,
    etag: `"${crypto.createHash("sha1").update(buf).digest("base64url").slice(0, 27)}"`, type: rel.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" };
  vendorCache.set(rel, v); return v;
}

const sha = (s) => `'sha256-${crypto.createHash("sha256").update(s, "utf8").digest("base64")}'`;
const CSP = [
  "default-src 'none'",
  `script-src 'self' ${sha(R.VIEW_SCRIPT)}`, // no 'unsafe-inline', no third parties: self-hosted Prism + our one hashed inline script
  `style-src 'self' ${sha(R.CSS)}`, "connect-src 'self'",
  "img-src 'self' data:", "manifest-src 'self'", "form-action 'self'", "base-uri 'none'", "frame-ancestors 'none'",
].join("; ");
const SEC = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin", "Content-Security-Policy": CSP };
// Raw pastes are untrusted bytes: never let a browser run anything in that context.
const RAW_SEC = { ...SEC, "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": "inline" };

const httpError = (status, code, message) => Object.assign(new Error(message), { status, code });

function createApp({ base = "", fsync = false, maxStorageBytes = 0, maxPastes = 0, log = console, dataDir = path.join(__dirname, "data"), maxBytes = 512 * 1024, rateLimit = 30, readRateLimit = 600, trustProxy = false, sweepMs = 60e3 } = {}) {
  if (base && !/^\/[a-z0-9-]+$/.test(base)) throw new Error("base must look like /name");
  const store = new Store(dataDir, { fsync, maxBytes: maxStorageBytes, maxFiles: maxPastes });
  const writes = new RateLimiter({ limit: rateLimit, windowMs: 60e3 });
  const reads = new RateLimiter({ limit: readRateLimit, windowMs: 60e3 });
  const bodyCap = maxBytes * 3 + 4096; // form-encoding can triple the size of the content

  const send = (res, code, body, type, extra = {}) => {
    if (res.headersSent) return res.end();
    res.writeHead(code, { ...SEC, "Content-Type": type, "Cache-Control": "no-store", ...extra }); res.end(body);
  };
  const html = (res, code, b) => send(res, code, b, "text/html; charset=utf-8");
  const json = (res, code, o, extra) => send(res, code, JSON.stringify(o), "application/json; charset=utf-8", extra);
  const fail = (res, code, c, m, extra) => json(res, code, { error: { code: c, message: m } }, extra); // http-json connector contract

  const clientIp = (req) => {
    if (trustProxy && typeof req.headers["x-forwarded-for"] === "string") return req.headers["x-forwarded-for"].split(",")[0].trim();
    return req.socket.remoteAddress || "unknown";
  };

  const readBody = (req) => new Promise((ok, no) => {
    const len = Number(req.headers["content-length"]);
    if (Number.isFinite(len) && len > bodyCap) return no(httpError(413, "too_large", `body exceeds ${bodyCap} bytes`));
    const chunks = []; let n = 0, done = false;
    req.on("data", (c) => {
      if (done) return;
      n += c.length;
      if (n > bodyCap) { done = true; chunks.length = 0; req.pause(); return no(httpError(413, "too_large", `body exceeds ${bodyCap} bytes`)); }
      chunks.push(c);
    });
    req.on("end", () => { if (!done) { done = true; ok(Buffer.concat(chunks).toString("utf8")); } });
    req.on("error", (e) => { if (!done) { done = true; no(e); } });
  });
  const validate = (b) => {
    if (!b || typeof b !== "object" || Array.isArray(b)) throw httpError(400, "bad_request", "body must be a JSON object");
    if (typeof b.content !== "string" || !b.content.trim()) throw httpError(400, "bad_content", "content is required");
    if (Buffer.byteLength(b.content) > maxBytes) throw httpError(413, "too_large", `content exceeds ${maxBytes} bytes`);
    for (const k of ["title", "language", "expiry"]) if (b[k] != null && typeof b[k] !== "string") throw httpError(400, "bad_request", `${k} must be a string`);
    return { content: b.content, title: (b.title || "").slice(0, 120), language: R.safeLang(b.language), expiry: b.expiry || "never" };
  };
  const toApi = (p) => ({ ...p, url: `${base}/p/${p.id}`, raw: `${base}/raw/${p.id}` });
  const ROUTES = [ // [pattern, allowed methods]
    [/^\/$/, "GET, HEAD"], [/^\/healthz$/, "GET, HEAD"], [/^\/new$/, "POST"], [/^\/api\/paste$/, "POST"],
    [/^\/api\/paste\/[^/]+$/, "GET, HEAD"], [/^\/p\/[^/]+$/, "GET, HEAD"], [/^\/raw\/[^/]+$/, "GET, HEAD"], [/^\/vendor\//, "GET, HEAD"], [/^\/favicon\.(svg|ico)$/, "GET, HEAD"],
  ];

  const handler = async (req, res) => {
    let p;
    try {
      if (req.url.length > 2048) return fail(res, 414, "uri_too_long", "request URI too long");
      p = new URL(req.url, "http://x").pathname;
    } catch { return fail(res, 400, "bad_request", "malformed URL"); }
    const method = req.method === "HEAD" ? "GET" : req.method;
    let m;
    try {
      const route = ROUTES.find(([re]) => re.test(p));
      if (route && !route[1].split(", ").includes(req.method)) return fail(res, 405, "method_not_allowed", `use ${route[1]}`, { Allow: route[1] });
      const ip = clientIp(req);
      const lim = (method === "POST" ? writes : reads).take(ip);
      if (!lim.ok) return fail(res, 429, "rate_limited", "too many requests, slow down", { "Retry-After": String(lim.retryAfter) });

      if (method === "GET" && p === "/") return html(res, 200, R.home(maxBytes, base));
      if (method === "GET" && !base && (p === "/favicon.svg" || p === "/favicon.ico")) { // standalone only; the unified server serves these
        let buf; try { buf = p.endsWith(".ico") ? require("../forkbomb/lib/favicon") : fs.readFileSync(path.join(__dirname, "..", "forkbomb", "public", "favicon.svg")); } catch { return send(res, 404, "not found\n", "text/plain; charset=utf-8"); }
        return send(res, 200, req.method === "HEAD" ? undefined : buf, p.endsWith(".svg") ? "image/svg+xml" : "image/x-icon", { "Cache-Control": "public, max-age=86400" });
      }
      if (method === "GET" && p.startsWith("/vendor/")) {
        const vm = p.match(VENDOR_RE), v = vm && loadVendor(vm[1]);
        if (!v) return send(res, 404, "not found\n", "text/plain; charset=utf-8");
        const h = { ETag: v.etag, "Last-Modified": v.mtime.toUTCString(), Vary: "Accept-Encoding", "Cache-Control": "public, max-age=31536000, immutable" };
        if (req.headers["if-none-match"] === v.etag) { res.writeHead(304, { ...SEC, ...h }); return res.end(); }
        const ae = String(req.headers["accept-encoding"] || ""), enc = /\bbr\b/.test(ae) ? "br" : /\bgzip\b/.test(ae) ? "gzip" : null;
        const body = enc === "br" ? v.br : enc === "gzip" ? v.gz : v.buf;
        if (enc) h["Content-Encoding"] = enc;
        res.writeHead(200, { ...SEC, ...h, "Content-Type": v.type, "Content-Length": body.length });
        return res.end(req.method === "HEAD" ? undefined : body);
      }
      if (method === "GET" && p === "/healthz") return json(res, 200, { ok: true });
      if (method === "POST" && p === "/new") {
        const paste = store.create(validate(Object.fromEntries(new URLSearchParams(await readBody(req)))));
        res.writeHead(303, { ...SEC, Location: `${base}/p/${paste.id}` }); return res.end();
      }
      if (method === "POST" && p === "/api/paste") {
        const raw = await readBody(req);
        let b; try { b = JSON.parse(raw); } catch { return fail(res, 400, "bad_json", "body must be JSON"); }
        return json(res, 201, toApi(store.create(validate(b))));
      }
      if (method === "GET" && (m = p.match(/^\/api\/paste\/([^/]+)$/))) {
        const x = ID_RE.test(m[1]) && store.get(m[1]); return x ? json(res, 200, toApi(x)) : fail(res, 404, "not_found", "paste not found or expired");
      }
      if (method === "GET" && (m = p.match(/^\/p\/([^/]+)$/))) {
        const x = ID_RE.test(m[1]) && store.get(m[1]); return x ? html(res, 200, R.view(x, base)) : html(res, 404, R.notFound(base));
      }
      if (method === "GET" && (m = p.match(/^\/raw\/([^/]+)$/))) {
        const x = ID_RE.test(m[1]) && store.get(m[1]);
        return x ? send(res, 200, x.content, "text/plain; charset=utf-8", RAW_SEC) : send(res, 404, "not found\n", "text/plain; charset=utf-8");
      }
      return p.startsWith("/api/") ? fail(res, 404, "not_found", "no such route") : html(res, 404, R.notFound(base));
    } catch (e) {
      const status = e.status || (e.code === "bad_expiry" ? 400 : 500);
      if (status === 500) log.error("paste: request failed:", e && e.message); // never sent to the client
      fail(res, status, status === 500 ? "internal" : e.code, status === 500 ? "internal error" : e.message, status === 413 ? { Connection: "close" } : {});
      if (status === 413) res.on("finish", () => req.destroy());
    }
  };
  const server = http.createServer((req, res) => { handler(req, res).catch(() => { try { fail(res, 500, "internal", "internal error"); } catch {} }); });
  server.requestTimeout = 30e3; server.headersTimeout = 10e3; server.keepAliveTimeout = 5e3; server.maxHeadersCount = 64;
  const timer = setInterval(() => { try { store.sweep(); } catch (e) { log.error("paste: sweep failed:", e.message); } writes.prune(); reads.prune(); }, sweepMs);
  timer.unref();
  server.on("close", () => clearInterval(timer));
  return { server, handler: server.listeners("request")[0], store, writes, reads };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createApp({
    dataDir: process.env.DATA_DIR || undefined, maxBytes: Number(process.env.MAX_BYTES) || undefined,
    rateLimit: Number(process.env.RATE_LIMIT) || undefined, readRateLimit: Number(process.env.READ_RATE_LIMIT) || undefined,
    trustProxy: process.env.TRUST_PROXY === "1", fsync: process.env.FSYNC === "1",
    maxStorageBytes: Number(process.env.MAX_STORAGE_BYTES) || 0, maxPastes: Number(process.env.MAX_PASTES) || 0,
  });
  server.listen(port, process.env.HOST || undefined, () => console.log(`FORKBOMB Paste listening on http://localhost:${port}`));
  let closing = false;
  const stop = (sig) => {
    if (closing) return; closing = true; console.log(`${sig}: shutting down`);
    setTimeout(() => process.exit(1), 10e3).unref();
    server.close(() => process.exit(0)); if (server.closeIdleConnections) server.closeIdleConnections();
  };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
}
module.exports = { createApp, CSP };
