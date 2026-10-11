#!/usr/bin/env node
// FORKBOMB — the unified production server. One origin, every app:
//   /            landing page            /paste/*      pastebin (apps/paste)
//   /shaders/*   WebGL2 shader playground (apps/shaders)
//   /gradients/* gradient gallery (apps/gradients)   /dots -> /gradients/dots/ (Dots Studio)
//   /healthz     liveness                /readyz       readiness (DATA_DIR writable, not shutting down)
// Config comes only from the environment (see lib/config.js and the README "Production" section). Zero dependencies.
"use strict";
const http = require("http"), path = require("path"), crypto = require("crypto"), fs = require("fs");
const H = require("../shared/http");
const { loadConfig } = require("./lib/config");
const { createLogger } = require("./lib/log");
const { RateLimiter } = require("../paste/lib/ratelimit");
const VERSION = require("../../package.json").version;

const PUBLIC = path.join(__dirname, "public");
const STATIC = { "/": "index.html", "/favicon.svg": "favicon.svg", "/robots.txt": "robots.txt" };
const FAVICON_ICO = require("./lib/favicon");
const ERROR_500 = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>500 · FORKBOMB</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1117;color:#e6edf3;font:16px/1.5 system-ui,sans-serif;text-align:center}a{color:#ff9b6b}</style></head><body><main><h1>500</h1><p>Something broke on our side. It has been logged.</p><p><a href="/">Back to FORKBOMB</a></p></main></body></html>`;
const RID_RE = /^[A-Za-z0-9._-]{1,64}$/;

function createServer(cfg, log = createLogger({ level: cfg.logLevel })) {
  H.setLogger(log);
  const paste = require("../paste/server").createApp({
    base: "/paste", dataDir: cfg.dataDir, maxBytes: cfg.maxBytes, rateLimit: cfg.rateLimit, readRateLimit: cfg.readRateLimit,
    trustProxy: cfg.trustProxy, fsync: cfg.fsync, maxStorageBytes: cfg.maxStorageBytes, maxPastes: cfg.maxPastes, log,
  });
  const shaders = require("../shaders/server").createApp();
  const gradients = require("../gradients/server").createApp();
  const MOUNTS = [["/paste", paste.handler], ["/shaders", shaders.handler], ["/gradients", gradients.handler]];
  const limiter = new RateLimiter({ limit: cfg.globalRateLimit, windowMs: 60e3 });
  const state = { shuttingDown: false };
  setInterval(() => limiter.prune(), 60e3).unref();

  const clientIp = (req) => {
    const xff = req.headers["x-forwarded-for"];
    if (cfg.trustProxy && typeof xff === "string") return xff.split(",")[0].trim();
    return req.socket.remoteAddress || "unknown";
  };
  const isHttps = (req) => req.socket.encrypted || (cfg.trustProxy && String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https");

  function route(req, res) {
    let pathname;
    try { if (req.url.length > 2048) return H.send(res, 414, H.TYPES[".txt"], "uri too long\n"); pathname = new URL(req.url, "http://x").pathname; }
    catch { return H.send(res, 400, H.TYPES[".txt"], "bad request\n"); }
    if (pathname === "/healthz") return H.sendJson(res, 200, { ok: true, version: VERSION });
    if (pathname === "/readyz") {
      const writable = paste.store.writable();
      const ok = writable && !state.shuttingDown;
      return H.sendJson(res, ok ? 200 : 503, { ok, dataDirWritable: writable, shuttingDown: state.shuttingDown });
    }
    const lim = limiter.take(clientIp(req));
    if (!lim.ok) return H.send(res, 429, H.TYPES[".txt"], "too many requests\n", { "Retry-After": String(lim.retryAfter) });
    if (pathname === "/dots" || pathname === "/dots/") return H.redirect(res, "/gradients/dots/");
    for (const [prefix, handler] of MOUNTS) {
      if (pathname === prefix) return H.redirect(res, prefix + "/" + req.url.slice(prefix.length)); // keep the query string
      if (pathname.startsWith(prefix + "/")) { req.url = req.url.slice(prefix.length); return handler(req, res); }
    }
    if (pathname === "/favicon.ico") return H.send(res, 200, H.TYPES[".ico"], FAVICON_ICO, {}, { cache: "public, max-age=86400" });
    if (STATIC[pathname]) {
      if (req.method !== "GET" && req.method !== "HEAD") return H.send(res, 405, H.TYPES[".txt"], "method not allowed\n", { Allow: "GET, HEAD" });
      return H.sendFile(res, path.join(PUBLIC, STATIC[pathname]), [PUBLIC]);
    }
    return H.notFound(res);
  }

  const server = H.harden(http.createServer((req, res) => {
    const start = process.hrtime.bigint();
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && RID_RE.test(incoming) ? incoming : crypto.randomUUID();
    const rawPath = String(req.url).split("?")[0].slice(0, 256);
    res.setHeader("X-Request-Id", id);
    const hsts = cfg.hsts === null ? isHttps(req) : cfg.hsts;
    if (hsts) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (state.shuttingDown) res.setHeader("Connection", "close");
    if (cfg.accessLog) {
      let logged = false;
      const done = (aborted) => {
        if (logged) return; logged = true;
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const status = aborted && !res.writableFinished ? 499 : res.statusCode;
        const lvl = status >= 500 ? "error" : "info";
        log[lvl]("request", { id, method: req.method, path: rawPath, status, ms: Math.round(ms * 100) / 100, bytes: Number(res.getHeader("Content-Length")) || undefined });
      };
      res.on("finish", () => done(false)); res.on("close", () => done(true));
    }
    try { route(req, res); }
    catch (e) {
      log.error("unhandled request error", { id, err: e && e.message });
      if (!res.headersSent) H.send(res, 500, H.TYPES[".html"], ERROR_500); else res.destroy();
    }
  }));
  server.on("clientError", (err, socket) => { if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); });
  server.on("close", () => paste.server.emit("close")); // stops the paste sweep timer
  return { server, state, paste };
}

function main() {
  let cfg;
  try { cfg = loadConfig(process.env); }
  catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "config", error: e.message }) + "\n"); process.exit(78); }
  const log = createLogger({ level: cfg.logLevel });
  try { fs.mkdirSync(cfg.dataDir, { recursive: true }); } catch (e) { log.error("cannot create DATA_DIR", { dataDir: cfg.dataDir, err: e.message }); process.exit(73); }
  const { server, state } = createServer(cfg, log);

  const shutdown = (reason, code = 0) => {
    if (state.shuttingDown) return; state.shuttingDown = true;
    log.info("shutting down", { reason, timeoutMs: cfg.shutdownTimeoutMs });
    const t = setTimeout(() => { log.warn("drain timeout, closing remaining connections"); if (server.closeAllConnections) server.closeAllConnections(); process.exit(code || 1); }, cfg.shutdownTimeoutMs);
    t.unref();
    server.close(() => { log.info("stopped", { reason }); process.exit(code); });
    if (server.closeIdleConnections) server.closeIdleConnections();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (r) => { log.error("unhandledRejection", { err: r && r.message ? r.message : String(r) }); shutdown("unhandledRejection", 1); });
  process.on("uncaughtException", (e) => { log.error("uncaughtException", { err: e && e.message, stack: e && e.stack && e.stack.split("\n").slice(0, 5).join(" | ") }); shutdown("uncaughtException", 1); });

  server.on("error", (e) => { log.error("listen failed", { err: e.message, code: e.code }); process.exit(1); });
  server.listen(cfg.port, cfg.host, () => {
    const a = server.address();
    log.info("listening", { version: VERSION, host: cfg.host, port: a.port, dataDir: cfg.dataDir, trustProxy: cfg.trustProxy, maxBytes: cfg.maxBytes, fsync: cfg.fsync });
  });
}

if (require.main === module) main();
module.exports = { createServer, loadConfig, VERSION };
