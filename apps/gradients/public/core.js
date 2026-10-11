// FORKBOMB gradients core: pure helpers shared by browser + tests (window.GradCore / require).
(function (root) {
  "use strict";
  const HEX = /^#[0-9a-f]{6}$/i;
  function hexToRgb(h) { if (!HEX.test(h)) throw new Error(`bad hex ${h}`); const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(r, g, b) { return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
  function stopList(stops, unit) { return stops.map((s) => `${s.color} ${s.pos}${unit || "%"}`).join(", "); }
  // CSS for a gradient: type linear|radial|conic.
  function toCss(g, opt) {
    const o = Object.assign({ type: "linear", angle: g.angle == null ? 90 : g.angle, shape: "circle", at: "50% 50%" }, opt || {});
    const s = stopList(g.stops);
    if (o.type === "radial") return `radial-gradient(${o.shape} at ${o.at}, ${s})`;
    if (o.type === "conic") return `conic-gradient(from ${o.angle}deg at ${o.at}, ${g.stops.map((x) => `${x.color} ${Math.round(x.pos * 3.6)}deg`).join(", ")}, ${g.stops[0].color} 360deg)`;
    return `linear-gradient(${o.angle}deg, ${s})`;
  }
  // Sample stops at t in [0,1] (linear RGB-space interpolation, matches CSS default).
  function sample(stops, t) {
    const p = t * 100;
    if (p <= stops[0].pos) return hexToRgb(stops[0].color);
    for (let i = 1; i < stops.length; i++) if (p <= stops[i].pos) {
      const a = stops[i - 1], b = stops[i], f = (p - a.pos) / Math.max(1e-6, b.pos - a.pos);
      const A = hexToRgb(a.color), B = hexToRgb(b.color); return A.map((v, k) => v + (B[k] - v) * f);
    }
    return hexToRgb(stops[stops.length - 1].color);
  }
  const luma = (rgb) => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  // Halftone dot radius for a luminance value; dark = big dots (ink on paper).
  function halftoneRadius(l, cell, invert) { const v = invert ? l : 1 - l; return Math.sqrt(Math.max(0, Math.min(1, v))) * cell * 0.5 * Math.SQRT2 * 0.95; }
  // Dot-grid CSS pattern (pure CSS, no JS).
  function dotGridCss(o) {
    const { color = "#ffffff", bg = "#0b0b12", size = 2, gap = 18 } = o || {};
    return `background-color: ${bg};\nbackground-image: radial-gradient(${color} ${size}px, transparent ${size + 0.5}px);\nbackground-size: ${gap}px ${gap}px;`;
  }
  // Points on parametric shapes, used for the dot-morph effect.
  function shapePoints(shape, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, u = i / n;
      if (shape === "ring") pts.push([Math.cos(t) * 0.8, Math.sin(t) * 0.8]);
      else if (shape === "heart") pts.push([0.05 * 16 * Math.pow(Math.sin(t), 3), -0.05 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
      else if (shape === "spiral") { const r = Math.sqrt(u) * 0.9, a = u * 6 * Math.PI * 2 / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      else if (shape === "wave") pts.push([u * 1.8 - 0.9, Math.sin(u * Math.PI * 4) * 0.35]);
      else { const g = 2.399963 * i, r = Math.sqrt((i + 0.5) / n) * 0.85; pts.push([Math.cos(g) * r, Math.sin(g) * r]); } // "disc" (phyllotaxis)
    }
    return pts;
  }
  const SHAPES = ["disc", "ring", "heart", "spiral", "wave"];
  const api = { hexToRgb, rgbToHex, toCss, sample, luma, halftoneRadius, dotGridCss, shapePoints, SHAPES, HEX };
  if (typeof module === "object" && module.exports) module.exports = api; else root.GradCore = api;
})(this);
