#!/usr/bin/env node
// FORKBOMB Shaders: zero-dependency static server for the WebGL2 shader playground.
// GET /            playground (public/index.html)
// GET /lib/*.glsl  shader library      GET /presets/*.glsl  demo shaders
// GET /api/library JSON { lib: {name: src}, presets: [{id, title, source}] }
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".glsl": "text/plain; charset=utf-8", ".json": "application/json" };

function listGlsl(dir) {
  return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".glsl")).sort();
}
function loadLibrary() {
  const lib = {};
  for (const f of listGlsl("lib")) lib[f] = fs.readFileSync(path.join(ROOT, "lib", f), "utf8");
  const presets = listGlsl("presets").map((f) => {
    const source = fs.readFileSync(path.join(ROOT, "presets", f), "utf8");
    const title = (source.match(/^\/\/\s*(.+)$/m) || [, f])[1];
    return { id: f.replace(/\.glsl$/, ""), title, source };
  });
  return { lib, presets };
}

function createApp() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "x-content-type-options": "nosniff" }); res.end(body); };
    if (req.method !== "GET" && req.method !== "HEAD") return send(405, "text/plain", "method not allowed\n");
    if (url.pathname === "/api/library") return send(200, TYPES[".json"], JSON.stringify(loadLibrary()));
    let rel = url.pathname === "/" ? "public/index.html" : null;
    const m = url.pathname.match(/^\/(lib|presets)\/([a-z0-9-]+\.glsl)$/) || url.pathname.match(/^\/()([a-z0-9.-]+\.(?:js|css|html))$/);
    if (!rel && m) rel = m[1] ? `${m[1]}/${m[2]}` : `public/${m[2]}`;
    if (!rel) return send(404, "text/plain", "not found\n");
    fs.readFile(path.join(ROOT, rel), (err, buf) => err ? send(404, "text/plain", "not found\n") : send(200, TYPES[path.extname(rel)] || "application/octet-stream", buf));
  });
  return { server };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  createApp().server.listen(port, () => console.log(`FORKBOMB Shaders on http://localhost:${port}`));
}
module.exports = { createApp, loadLibrary };
