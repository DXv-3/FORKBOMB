#!/usr/bin/env node
// FORKBOMB Gradients: zero-dependency static server for the gradient gallery.
// GET /                    gallery (public/index.html)
// GET /api/gradients       dataset (data/gradients.json, with provenance)   ?q=name filter
// GET /api/glsl            { lib: {name: src} } reused from apps/shaders/lib (gradient.glsl, mesh.glsl, ...)
// GET /dots             Dots Studio (public/dots/studio.html); /dots/*.js|css|html modules + forkbomb-dots.js
// GET /include.js          #include resolver shared with apps/shaders
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const H = require("../shared/http");
const ROOT = __dirname, SHADERS = path.join(ROOT, "..", "shaders");
const ROOTS = [path.join(ROOT, "public"), path.join(SHADERS, "public")];

function loadDataset() { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "gradients.json"), "utf8")); }
function loadGlsl() {
  const lib = {}, dir = path.join(SHADERS, "lib");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".glsl")).sort()) lib[f] = fs.readFileSync(path.join(dir, f), "utf8");
  return { lib };
}

function createApp() {
  const server = H.harden(http.createServer(H.staticHandler((req, res, url) => {
    if (url.pathname === "/api/gradients") {
      const d = loadDataset(), q = (url.searchParams.get("q") || "").slice(0, 100).toLowerCase();
      if (q) d.gradients = d.gradients.filter((g) => String(g.name).toLowerCase().includes(q));
      return H.sendJson(res, 200, d);
    }
    if (url.pathname === "/api/glsl") return H.sendJson(res, 200, loadGlsl());
    let file = null;
    if (url.pathname === "/") file = path.join(ROOT, "public", "index.html");
    else if (url.pathname === "/include.js") file = path.join(SHADERS, "public", "include.js");
    else if (url.pathname === "/dots" || url.pathname === "/dots/") file = path.join(ROOT, "public", "dots", "studio.html");
    else { const m = url.pathname.match(/^\/((?:dots\/)?[a-z0-9-]+\.(?:js|css|html))$/); if (m) file = path.join(ROOT, "public", m[1]); }
    if (!file) return H.notFound(res);
    return H.sendFile(res, file, ROOTS);
  })));
  return { server };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3002;
  const { server } = createApp();
  server.listen(port, process.env.HOST || undefined, () => console.log(`FORKBOMB Gradients on http://localhost:${port}`));
  H.shutdownOnSignals(server);
}
module.exports = { createApp, loadDataset, loadGlsl };
