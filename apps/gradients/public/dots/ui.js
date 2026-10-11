// FORKBOMB Dots Studio: UI controls rendered as dots. Pure geometry (rounded rects, tracks, knobs, check marks,
// chevrons, spinners) in normalized space + optional label points from a text sampler. Original MIT code.
"use strict";
(function (root) {
  const TAU = Math.PI * 2;
  // perimeter of rounded rect centred (cx,cy), size w*h, radius r -> k points
  function rrect(cx, cy, w, h, r, k, out = []) {
    r = Math.min(r, w / 2, h / 2); const sx = w - 2 * r, sy = h - 2 * r, arc = (Math.PI / 2) * r, L = 2 * sx + 2 * sy + 4 * arc;
    for (let i = 0; i < k; i++) { let s = (i / k) * L; let x, y;
      if (s < sx) { x = -sx / 2 + s; y = -h / 2; } else if ((s -= sx) < arc) { const a = -Math.PI / 2 + s / r; x = sx / 2 + r * Math.cos(a); y = -sy / 2 + r * Math.sin(a); }
      else if ((s -= arc) < sy) { x = w / 2; y = -sy / 2 + s; } else if ((s -= sy) < arc) { const a = s / r; x = sx / 2 + r * Math.cos(a); y = sy / 2 + r * Math.sin(a); }
      else if ((s -= arc) < sx) { x = sx / 2 - s; y = h / 2; } else if ((s -= sx) < arc) { const a = Math.PI / 2 + s / r; x = -sx / 2 + r * Math.cos(a); y = sy / 2 + r * Math.sin(a); }
      else if ((s -= arc) < sy) { x = -w / 2; y = sy / 2 - s; } else { s -= sy; const a = Math.PI + s / r; x = -sx / 2 + r * Math.cos(a); y = -sy / 2 + r * Math.sin(a); }
      out.push(cx + x, cy + y); }
    return out;
  }
  function disc(cx, cy, r, k, out = []) { for (let i = 0; i < k; i++) { const a = i * 2.39996, q = r * Math.sqrt((i + 0.5) / k); out.push(cx + q * Math.cos(a), cy + q * Math.sin(a)); } return out; }
  function line(x0, y0, x1, y1, k, out = []) { for (let i = 0; i < k; i++) { const t = k > 1 ? i / (k - 1) : 0; out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); } return out; }
  function fillRect(cx, cy, w, h, k, out = []) { const c = Math.max(1, Math.round(Math.sqrt((k * w) / h))), rws = Math.max(1, Math.ceil(k / c)); for (let i = 0; i < k; i++) out.push(cx - w / 2 + ((i % c) + 0.5) * (w / c), cy - h / 2 + (Math.floor(i / c) + 0.5) * (h / rws)); return out; }
  // Each control: (state, budget) -> {points:number[], hit:{x,y,w,h}} centred at state.x/state.y
  const CONTROLS = {
    button: (s, k) => ({ points: rrect(s.x, s.y, s.w || 0.7, s.h || 0.2, 0.1, Math.round(k * (s.pressed ? 0.5 : 1)), s.pressed ? fillRect(s.x, s.y, (s.w || 0.7) * 0.9, (s.h || 0.2) * 0.7, Math.round(k * 0.5)) : []) }),
    slider: (s, k) => { const w = s.w || 0.8, v = s.value ?? 0.5, kx = s.x - w / 2 + w * v, p = line(s.x - w / 2, s.y, s.x + w / 2, s.y, Math.round(k * 0.55)); line(s.x - w / 2, s.y - 0.012, kx, s.y - 0.012, Math.round(k * 0.15), p); disc(kx, s.y, 0.045, k - p.length / 2, p); return { points: p }; },
    toggle: (s, k) => { const on = !!s.value, p = rrect(s.x, s.y, 0.26, 0.13, 0.065, Math.round(k * 0.6)); disc(s.x + (on ? 0.065 : -0.065), s.y, 0.045, k - p.length / 2, p); return { points: p }; },
    checkbox: (s, k) => { const p = rrect(s.x, s.y, 0.13, 0.13, 0.025, Math.round(k * (s.value ? 0.6 : 1))); if (s.value) { const m = k - p.length / 2, a = Math.round(m * 0.35); line(s.x - 0.04, s.y, s.x - 0.01, s.y + 0.035, a, p); line(s.x - 0.01, s.y + 0.035, s.x + 0.045, s.y - 0.04, m - a, p); } return { points: p }; },
    dropdown: (s, k) => { const w = s.w || 0.6, p = rrect(s.x, s.y, w, 0.15, 0.03, Math.round(k * 0.8)), m = k - p.length / 2, h = Math.floor(m / 2), cx = s.x + w / 2 - 0.07; line(cx - 0.03, s.y - 0.015, cx, s.y + 0.015, h, p); line(cx, s.y + 0.015, cx + 0.03, s.y - 0.015, m - h, p); return { points: p }; },
    progress: (s, k) => { const w = s.w || 0.8, v = s.value ?? 0.6, p = rrect(s.x, s.y, w, 0.07, 0.035, Math.round(k * 0.5)); fillRect(s.x - w / 2 + (w * v) / 2, s.y, Math.max(0.01, w * v - 0.03), 0.035, k - p.length / 2, p); return { points: p }; },
    spinner: (s, k) => { const p = [], ph = s.phase || 0; for (let i = 0; i < k; i++) { const u = i / k, a = ph + u * TAU * 0.8, r = 0.09 + 0.004 * Math.sin(u * 40); p.push(s.x + r * Math.cos(a), s.y + r * Math.sin(a)); } return { points: p }; },
    loader: (s, k) => { const p = [], ph = s.phase || 0, per = Math.floor(k / 3); for (let j = 0; j < 3; j++) disc(s.x + (j - 1) * 0.08, s.y - 0.03 * Math.max(0, Math.sin(ph * 2 - j * 0.9)), 0.025, j === 2 ? k - 2 * per : per, p); return { points: p }; },
  };
  const HIT = { button: [0.7, 0.2], slider: [0.85, 0.12], toggle: [0.28, 0.15], checkbox: [0.15, 0.15], dropdown: [0.6, 0.15], progress: [0.85, 0.1], spinner: [0.2, 0.2], loader: [0.25, 0.1] };
  // layout: list of {type, x, y, ...state}; returns Float32Array of exactly n points + per-control index ranges
  function build(list, n) {
    const per = Math.floor(n / list.length), all = [], ranges = [];
    list.forEach((c, i) => { const k = i === list.length - 1 ? n - per * (list.length - 1) : per, st = all.length / 2; const p = CONTROLS[c.type](c, k).points; for (let j = 0; j < k; j++) all.push(p[(2 * j) % p.length] ?? c.x, p[(2 * j + 1) % p.length] ?? c.y); ranges.push([st, st + k]); });
    return { points: Float32Array.from(all), ranges };
  }
  function hitTest(list, x, y) { for (let i = 0; i < list.length; i++) { const c = list[i], [w, h] = HIT[c.type], cw = c.w || w; if (Math.abs(x - c.x) < cw / 2 && Math.abs(y - c.y) < h / 2) return i; } return -1; }
  const api = { CONTROLS, build, hitTest, rrect, disc, line, fillRect, TYPES: Object.keys(CONTROLS) };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DotsUI = api;
})(this);
