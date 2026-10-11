#!/usr/bin/env node
// FORKBOMB Shaders: zero-dependency static server for the WebGL2 shader playground.
// GET /            playground (public/index.html)
// GET /lib/*.glsl  shader library      GET /presets/*.glsl  demo shaders
// GET /api/library JSON { lib: {name: src}, presets: [{id, title, source}] }
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const H = require("../shared/http");
const ROOT = __dirname;
const ROOTS = ["public", "lib", "presets"].map((d) => path.join(ROOT, d));

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
  const server = H.harden(http.createServer(H.staticHandler((req, res, url) => {
    if (url.pathname === "/api/library") return H.sendJson(res, 200, loadLibrary());
    let rel = url.pathname === "/" ? "public/index.html" : null;
    const m = url.pathname.match(/^\/(lib|presets)\/([a-z0-9-]+\.glsl)$/) || url.pathname.match(/^\/()([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:js|css|html))$/);
    if (!rel && m) rel = m[1] ? `${m[1]}/${m[2]}` : `public/${m[2]}`;
    if (!rel) return H.notFound(res);
    return H.sendFile(res, path.join(ROOT, rel), ROOTS);
  })));
  return { server, handler: server.listeners("request")[0] };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  const { server } = createApp();
  server.listen(port, process.env.HOST || undefined, () => console.log(`FORKBOMB Shaders on http://localhost:${port}`));
  H.shutdownOnSignals(server);
}
module.exports = { createApp, loadLibrary };
