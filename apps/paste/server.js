#!/usr/bin/env node
// FORKBOMB Paste — zero-dependency pastebin. node apps/paste/server.js  (PORT, DATA_DIR, MAX_BYTES)
"use strict";
const http = require("http");
const path = require("path");
const { Store } = require("./lib/store");
const R = require("./lib/render");

function createApp({ dataDir = path.join(__dirname, "data"), maxBytes = 512 * 1024 } = {}) {
  const store = new Store(dataDir);
  const SEC = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; form-action 'self'; base-uri 'none'" };
  const send = (res, code, body, type) => { res.writeHead(code, { ...SEC, "Content-Type": type }); res.end(body); };
  const html = (res, code, b) => send(res, code, b, "text/html; charset=utf-8");
  const json = (res, code, o) => send(res, code, JSON.stringify(o), "application/json");
  const fail = (res, code, c, m) => json(res, code, { error: { code: c, message: m } }); // http-json connector contract

  const readBody = (req) => new Promise((ok, no) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > maxBytes + 4096) { no(Object.assign(new Error("too large"), { code: "too_large" })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", no);
  });
  const validate = (b) => {
    if (typeof b.content !== "string" || !b.content.trim()) throw Object.assign(new Error("content is required"), { code: "bad_content" });
    if (Buffer.byteLength(b.content) > maxBytes) throw Object.assign(new Error(`content exceeds ${maxBytes} bytes`), { code: "too_large" });
    return { content: b.content, title: b.title || "", language: R.safeLang(b.language), expiry: b.expiry || "never" };
  };
  const toApi = (p, req) => ({ ...p, url: `/p/${p.id}`, raw: `/raw/${p.id}` });

  const handler = async (req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname; let m;
    try {
      if (req.method === "GET" && p === "/") return html(res, 200, R.home(maxBytes));
      if (req.method === "GET" && p === "/healthz") return json(res, 200, { ok: true });
      if (req.method === "POST" && p === "/new") {
        const paste = store.create(validate(Object.fromEntries(new URLSearchParams(await readBody(req)))));
        res.writeHead(303, { ...SEC, Location: `/p/${paste.id}` }); return res.end();
      }
      if (req.method === "POST" && p === "/api/paste") {
        let b; try { b = JSON.parse(await readBody(req)); } catch (e) { if (e.code === "too_large") throw e; return fail(res, 400, "bad_json", "body must be JSON"); }
        return json(res, 201, toApi(store.create(validate(b || {}))));
      }
      if (req.method === "GET" && (m = p.match(/^\/api\/paste\/([^/]+)$/))) {
        const x = store.get(m[1]); return x ? json(res, 200, toApi(x)) : fail(res, 404, "not_found", "paste not found or expired");
      }
      if (req.method === "GET" && (m = p.match(/^\/p\/([^/]+)$/))) {
        const x = store.get(m[1]); return x ? html(res, 200, R.view(x)) : html(res, 404, R.notFound());
      }
      if (req.method === "GET" && (m = p.match(/^\/raw\/([^/]+)$/))) {
        const x = store.get(m[1]); return x ? send(res, 200, x.content, "text/plain; charset=utf-8") : send(res, 404, "not found\n", "text/plain; charset=utf-8");
      }
      return p.startsWith("/api/") ? fail(res, 404, "not_found", "no such route") : html(res, 404, R.notFound());
    } catch (e) {
      const code = e.code === "too_large" ? 413 : e.code === "bad_content" || e.code === "bad_expiry" ? 400 : 500;
      if (code === 500) console.error(e);
      if (res.headersSent) return res.end();
      return fail(res, code, e.code || "internal", code === 500 ? "internal error" : e.message);
    }
  };
  const server = http.createServer(handler);
  const timer = setInterval(() => store.sweep(), 60e3); timer.unref();
  server.on("close", () => clearInterval(timer));
  return { server, store };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createApp({ dataDir: process.env.DATA_DIR || undefined, maxBytes: Number(process.env.MAX_BYTES) || undefined });
  server.listen(port, () => console.log(`FORKBOMB Paste listening on http://localhost:${port}`));
}
module.exports = { createApp };
