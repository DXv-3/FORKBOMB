#!/usr/bin/env node
// FORKBOMB Gradients: zero-dependency static server for the gradient gallery.
// GET /                    gallery (public/index.html)
// GET /api/gradients       dataset (data/gradients.json, with provenance)   ?q=name filter
// GET /api/glsl            { lib: {name: src} } reused from apps/shaders/lib (gradient.glsl, mesh.glsl, ...)
// GET /dots             Dots Studio (public/dots/studio.html); /dots/*.js|css|html modules + forkbomb-dots.js
// GET /include.js          #include resolver shared with apps/shaders
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname, SHADERS = path.join(ROOT, "..", "shaders");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };

function loadDataset() { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "gradients.json"), "utf8")); }
function loadGlsl() {
  const lib = {}, dir = path.join(SHADERS, "lib");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".glsl")).sort()) lib[f] = fs.readFileSync(path.join(dir, f), "utf8");
  return { lib };
}

function createApp() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "x-content-type-options": "nosniff" }); res.end(body); };
    if (req.method !== "GET" && req.method !== "HEAD") return send(405, "text/plain", "method not allowed\n");
    if (url.pathname === "/api/gradients") {
      const d = loadDataset(), q = (url.searchParams.get("q") || "").toLowerCase();
      if (q) d.gradients = d.gradients.filter((g) => g.name.toLowerCase().includes(q));
      return send(200, TYPES[".json"], JSON.stringify(d));
    }
    if (url.pathname === "/api/glsl") return send(200, TYPES[".json"], JSON.stringify(loadGlsl()));
    let file = null;
    if (url.pathname === "/") file = path.join(ROOT, "public", "index.html");
    else if (url.pathname === "/include.js") file = path.join(SHADERS, "public", "include.js");
    else if (url.pathname === "/dots" || url.pathname === "/dots/") file = path.join(ROOT, "public", "dots", "studio.html");
    else { const m = url.pathname.match(/^\/((?:dots\/)?[a-z0-9-]+\.(?:js|css|html))$/); if (m) file = path.join(ROOT, "public", m[1]); }
    if (!file) return send(404, "text/plain", "not found\n");
    fs.readFile(file, (err, buf) => err ? send(404, "text/plain", "not found\n") : send(200, TYPES[path.extname(file)] || "application/octet-stream", buf));
  });
  return { server };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3002;
  createApp().server.listen(port, () => console.log(`FORKBOMB Gradients on http://localhost:${port}`));
}
module.exports = { createApp, loadDataset, loadGlsl };
