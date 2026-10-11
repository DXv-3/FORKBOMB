// FORKBOMB Gradients gallery. Original MIT code. Tabs: CSS (linear/radial/conic), Mesh + Aurora (WebGL2,
// built from apps/shaders/lib via #include), Dots (grid / halftone / morph; clean-room, dotsui.dev-inspired).
// Global grain overlay. Every tab: live controls, Copy CSS / Copy GLSL, Export PNG.
"use strict";
const C = window.GradCore, $ = (s) => document.querySelector(s);
const S = { tab: "css", g: null, type: "linear", angle: 90, grain: 0.12, speed: 1, soft: 4, dotMode: "grid", gap: 16, dot: 2.5, shape: 0, all: [], glsl: null };
const stage = $("#stage"), css = $("#cssPreview"), gl = $("#gl"), dots = $("#dots"), grainEl = $("#grainLayer"), ctl = $("#controls");

// ---------- grain ----------
const grainCanvas = document.createElement("canvas"); grainCanvas.width = grainCanvas.height = 160;
(function () { const x = grainCanvas.getContext("2d"), im = x.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); grainEl.style.backgroundImage = `url(${grainCanvas.toDataURL()})`; })();
const grainCss = () => `/* grain overlay: put on a ::after above the gradient */\nbackground-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");\nmix-blend-mode: overlay; opacity: ${S.grain.toFixed(2)};`;

// ---------- helpers ----------
const colors = () => { const st = S.g.stops; return [0, 1, 2, 3].map((i) => st[Math.min(st.length - 1, Math.round(i * (st.length - 1) / 3))].color); };
const copy = (txt) => { navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {}); $("#out").textContent = txt; flash("copied"); };
function flash(m) { const b = document.activeElement; if (b && b.tagName === "BUTTON") { const o = b.textContent; b.textContent = m + " ✓"; setTimeout(() => (b.textContent = o), 900); } }
function range(label, key, min, max, step, cb) {
  const l = document.createElement("label"); l.innerHTML = `${label}<input type=range min=${min} max=${max} step=${step} value=${S[key]}>`;
  l.querySelector("input").oninput = (e) => { S[key] = +e.target.value; cb && cb(); render(); }; ctl.append(l);
}
function buttons(list) { const r = document.createElement("div"); r.className = "row"; for (const [t, f] of list) { const b = document.createElement("button"); b.textContent = t; b.onclick = f; r.append(b); } ctl.append(r); }

// ---------- CSS tab ----------
const cssString = () => C.toCss(S.g, { type: S.type, angle: S.angle });
function exportPng() {
  const w = stage.clientWidth * 2, h = stage.clientHeight * 2, cv = document.createElement("canvas"); cv.width = w; cv.height = h; const x = cv.getContext("2d");
  if (S.tab === "css") {
    let gr; const a = (S.angle - 90) * Math.PI / 180, L = Math.abs(w * Math.cos(a)) / 2 + Math.abs(h * Math.sin(a)) / 2;
    if (S.type === "radial") gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
    else if (S.type === "conic") gr = x.createConicGradient((S.angle - 90) * Math.PI / 180, w / 2, h / 2);
    else gr = x.createLinearGradient(w / 2 - Math.cos(a) * L, h / 2 - Math.sin(a) * L, w / 2 + Math.cos(a) * L, h / 2 + Math.sin(a) * L);
    for (const s of S.g.stops) gr.addColorStop(s.pos / 100, s.color);
    if (S.type === "conic") gr.addColorStop(1, S.g.stops[0].color);
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  } else x.drawImage(S.tab === "dots" ? dots : gl, 0, 0, w, h);
  if (S.grain > 0) { x.globalAlpha = S.grain; x.globalCompositeOperation = "overlay"; x.fillStyle = x.createPattern(grainCanvas, "repeat"); x.fillRect(0, 0, w, h); }
  const a = document.createElement("a"); a.download = `forkbomb-${S.tab}-${S.g.id}.png`; a.href = cv.toDataURL("image/png"); a.click();
}

// ---------- WebGL tabs ----------
const SRC = {
  mesh: `// FORKBOMB mesh gradient (needs apps/shaders/lib mesh.glsl)
uniform vec3 u_c0; uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3; uniform float u_speed; uniform float u_soft;
#include "mesh.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 col = mesh4(uv, iTime * u_speed, u_c0, u_c1, u_c2, u_c3, u_soft);
  fragColor = vec4(col + gradDither(fragCoord), 1.0);
}`,
  aurora: `// FORKBOMB aurora over a gradient night sky (needs apps/shaders/lib mesh.glsl)
uniform vec3 u_c0; uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3; uniform float u_speed; uniform float u_soft;
#include "mesh.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 sky = ramp3(uv.y, vec3(0.01, 0.01, 0.04), u_c3 * 0.12, vec3(0.02, 0.0, 0.06));
  vec3 col = sky + aurora(uv, iTime * u_speed, u_c0, u_c1) * (u_soft / 3.0);
  fragColor = vec4(col + gradDither(fragCoord), 1.0);
}`,
};
let G = null, prog = null, progFor = "", t0 = performance.now();
function glInit() {
  G = gl.getContext("webgl2", { preserveDrawingBuffer: true }); if (!G) return false;
  const b = G.createBuffer(); G.bindBuffer(G.ARRAY_BUFFER, b); G.bufferData(G.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), G.STATIC_DRAW); return true;
}
function compile(tab) {
  const { code } = ShaderInclude.build(SRC[tab], S.glsl);
  const mk = (t, s) => { const sh = G.createShader(t); G.shaderSource(sh, s); G.compileShader(sh); if (!G.getShaderParameter(sh, G.COMPILE_STATUS)) throw new Error(G.getShaderInfoLog(sh)); return sh; };
  const p = G.createProgram(); G.attachShader(p, mk(G.VERTEX_SHADER, "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}")); G.attachShader(p, mk(G.FRAGMENT_SHADER, code));
  G.bindAttribLocation(p, 0, "p"); G.linkProgram(p); if (!G.getProgramParameter(p, G.LINK_STATUS)) throw new Error(G.getProgramInfoLog(p));
  prog = p; progFor = tab;
}
function drawGl(now) {
  if (!G && !glInit()) return;
  if (progFor !== S.tab) compile(S.tab);
  const w = gl.clientWidth * devicePixelRatio | 0, h = gl.clientHeight * devicePixelRatio | 0; if (gl.width !== w || gl.height !== h) { gl.width = w; gl.height = h; }
  G.viewport(0, 0, w, h); G.useProgram(prog); G.enableVertexAttribArray(0); G.vertexAttribPointer(0, 2, G.FLOAT, false, 0, 0);
  const u = (n) => G.getUniformLocation(prog, n);
  G.uniform1f(u("iTime"), (now - t0) / 1000); G.uniform3f(u("iResolution"), w, h, 1); G.uniform4f(u("iMouse"), 0, 0, 0, 0);
  colors().forEach((c, i) => G.uniform3fv(u("u_c" + i), C.hexToRgb(c).map((v) => v / 255)));
  G.uniform1f(u("u_speed"), S.speed); G.uniform1f(u("u_soft"), S.soft); G.drawArrays(G.TRIANGLES, 0, 3);
}
const glslFor = (tab) => `// Uniforms: u_c0..u_c3 = ${colors().join(", ")}\n` + ShaderInclude.resolve(SRC[tab], S.glsl).code;

// ---------- Dots tab (clean-room, original) ----------
const D = { x: dots.getContext("2d"), mouse: [-1e4, -1e4], parts: [] };
dots.addEventListener("pointermove", (e) => { const r = dots.getBoundingClientRect(); D.mouse = [(e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio]; });
dots.addEventListener("pointerleave", () => (D.mouse = [-1e4, -1e4]));
dots.addEventListener("click", () => { S.shape = (S.shape + 1) % C.SHAPES.length; retarget(); });
function retarget() {
  const n = 900, pts = C.shapePoints(C.SHAPES[S.shape], n);
  if (D.parts.length !== n) D.parts = pts.map(() => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 }));
  const order = pts.map((_, i) => i).sort(() => Math.random() - 0.5);
  D.parts.forEach((p, i) => { p.tx = pts[order[i]][0]; p.ty = pts[order[i]][1]; });
}
function drawDots(now) {
  const w = dots.clientWidth * devicePixelRatio | 0, h = dots.clientHeight * devicePixelRatio | 0; if (dots.width !== w || dots.height !== h) { dots.width = w; dots.height = h; }
  const x = D.x, t = (now - t0) / 1000 * S.speed, gap = S.gap * devicePixelRatio, st = S.g.stops;
  x.fillStyle = "#07070c"; x.fillRect(0, 0, w, h);
  if (S.dotMode === "morph") {
    if (!D.parts.length) retarget();
    const s = Math.min(w, h) * 0.45;
    for (const p of D.parts) {
      const tx = w / 2 + p.tx * s, ty = h / 2 + p.ty * s, px = p.x * w, py = p.y * h;
      const dx = px - D.mouse[0], dy = py - D.mouse[1], d2 = dx * dx + dy * dy + 1, push = 4e3 * devicePixelRatio / d2;
      p.vx = (p.vx + (tx - px) * 0.012 + dx * push * 0.05) * 0.86; p.vy = (p.vy + (ty - py) * 0.012 + dy * push * 0.05) * 0.86;
      p.x += p.vx / w; p.y += p.vy / h;
      const c = C.sample(st, Math.min(1, Math.max(0, p.y))); x.fillStyle = `rgb(${c.map(Math.round)})`;
      x.beginPath(); x.arc(p.x * w, p.y * h, S.dot * devicePixelRatio * 0.8, 0, 7); x.fill();
    }
    return;
  }
  for (let y = gap / 2; y < h; y += gap) for (let X = gap / 2; X < w; X += gap) {
    const u = X / w, v = y / h; let r, c;
    if (S.dotMode === "halftone") {
      const a = S.angle * Math.PI / 180, tt = 0.5 + ((u - 0.5) * Math.sin(a) - (v - 0.5) * Math.cos(a)) + 0.08 * Math.sin(t + u * 6);
      c = C.sample(st, Math.min(1, Math.max(0, tt))); r = C.halftoneRadius(C.luma(c), gap, true);
    } else {
      const dm = Math.hypot(X - D.mouse[0], y - D.mouse[1]) / devicePixelRatio, wave = 0.5 + 0.5 * Math.sin(u * 8 + v * 5 - t * 2) * Math.cos(v * 7 - t);
      r = S.dot * devicePixelRatio * (0.4 + wave + 2.2 * Math.exp(-dm / 60)); c = C.sample(st, Math.min(1, Math.max(0, (u + v) / 2 + 0.15 * Math.sin(t))));
    }
    x.fillStyle = `rgb(${c.map(Math.round)})`; x.beginPath(); x.arc(X, y, Math.max(0.3, r), 0, 7); x.fill();
  }
}

// ---------- render / controls ----------
function render() {
  css.style.display = S.tab === "css" ? "" : "none"; gl.style.display = S.tab === "mesh" || S.tab === "aurora" ? "" : "none"; dots.style.display = S.tab === "dots" ? "" : "none";
  css.style.background = cssString(); grainEl.style.opacity = S.grain;
  document.querySelectorAll(".sw").forEach((e) => e.classList.toggle("on", e.dataset.id === S.g.id));
}
function controls() {
  ctl.innerHTML = `<b>${S.g.name}</b><small style="opacity:.6">${S.g.source} · MIT · ${S.g.stops.map((s) => s.color).join(" ")}</small>`;
  if (S.tab === "css") { buttons(["linear", "radial", "conic"].map((t) => [t, () => { S.type = t; render(); }])); range("angle", "angle", 0, 360, 1); }
  if (S.tab === "mesh" || S.tab === "aurora") { range("speed", "speed", 0, 3, 0.05); range(S.tab === "mesh" ? "softness" : "intensity", "soft", 1, 6, 0.1); }
  if (S.tab === "dots") { buttons(["grid", "halftone", "morph"].map((m) => [m, () => { S.dotMode = m; render(); }])); range("spacing", "gap", 6, 40, 1); range("dot size", "dot", 0.5, 6, 0.1); range("angle", "angle", 0, 360, 1); range("speed", "speed", 0, 3, 0.05);
    const s = document.createElement("small"); s.textContent = "grid: hover to ripple · morph: click to change shape, hover to scatter"; ctl.append(s); }
  range("grain", "grain", 0, 0.5, 0.01);
  const copyBtns = [["Copy CSS", () => copy(S.tab === "dots" ? C.dotGridCss({ color: S.g.stops[0].color, gap: S.gap, size: S.dot }) : `background: ${S.tab === "css" ? cssString() : C.toCss(S.g)};${S.grain ? "\n" + grainCss() : ""}`)]];
  if (S.tab === "mesh" || S.tab === "aurora") copyBtns.push(["Copy GLSL", () => copy(glslFor(S.tab))]);
  copyBtns.push(["Export PNG", exportPng], ["Random", () => pick(S.all[Math.random() * S.all.length | 0])]);
  buttons(copyBtns);
}
function pick(g) { S.g = g; S.angle = g.angle; controls(); render(); }
function loop(now) { try { if (S.tab === "mesh" || S.tab === "aurora") drawGl(now); else if (S.tab === "dots") drawDots(now); } catch (e) { ctl.insertAdjacentHTML("beforeend", `<pre style="color:#f88;white-space:pre-wrap">${e.message}</pre>`); S.tab = "css"; render(); } requestAnimationFrame(loop); }
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => { document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b)); S.tab = b.dataset.tab; controls(); render(); }));
function grid(list) {
  $("#grid").innerHTML = ""; const frag = document.createDocumentFragment();
  for (const g of list) { const d = document.createElement("div"); d.className = "sw"; d.dataset.id = g.id; d.style.background = C.toCss(g); d.innerHTML = `<span>${g.name.replace(/</g, "&lt;")}</span>`; d.onclick = () => pick(g); frag.append(d); }
  $("#grid").append(frag); render();
}
Promise.all([fetch("/api/gradients").then((r) => r.json()), fetch("/api/glsl").then((r) => r.json())]).then(([d, l]) => {
  S.all = d.gradients; S.glsl = l.lib; $("#count").textContent = `${S.all.length} gradients · uiGradients + WebGradients (MIT)`;
  const qs = new URLSearchParams(location.search), tab = qs.get("tab"); S.g = S.all.find((g) => g.id === (qs.get("g") || "electric-peacock")) || S.all[0]; S.angle = S.g.angle;
  grid(S.all); $("#q").oninput = (e) => grid(S.all.filter((g) => g.name.toLowerCase().includes(e.target.value.toLowerCase())));
  if (tab) { const b = document.querySelector(`#tabs [data-tab=${tab}]`); if (b) return b.click() || requestAnimationFrame(loop); }
  controls(); render(); requestAnimationFrame(loop);
});
