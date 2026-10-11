// FORKBOMB Dots Studio: easing, staggered morph timing, point matching. Original MIT code.
"use strict";
(function (root) {
  const c1 = 1.70158, c3 = c1 + 1, P = Math.PI;
  const EASE = {
    linear: (t) => t,
    inQuad: (t) => t * t, outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(P * t) - 1) / 2,
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * P / 3)) + 1),
    outBounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // per-particle start offsets: order in [0,1] per particle (index/radial/x/random), stagger = fraction of duration spent staggering
  function staggerOrder(points, mode = "index", seed = 3) {
    const n = points.length / 2, o = new Float32Array(n);
    let a = seed >>> 0; const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const x = points[2 * i], y = points[2 * i + 1];
      o[i] = mode === "radial" ? Math.min(1, Math.hypot(x, y) / 1.42) : mode === "x" ? (x + 1) / 2 : mode === "y" ? (y + 1) / 2 : mode === "random" ? r() : mode === "angle" ? (Math.atan2(y, x) + P) / (2 * P) : i / Math.max(1, n - 1);
    }
    return o;
  }
  const localT = (t, order, stagger) => clamp01((t - order * stagger) / Math.max(1e-6, 1 - stagger));
  // out = lerp(a, b, ease(localT)) per particle
  function interpolate(a, b, t, out, opt = {}) {
    const n = a.length / 2, e = (Object.prototype.hasOwnProperty.call(EASE, opt.ease) && EASE[opt.ease]) || EASE.inOutCubic, st = opt.stagger || 0, ord = opt.order;
    out = out || new Float32Array(a.length);
    for (let i = 0; i < n; i++) { const k = e(st && ord ? localT(t, ord[i], st) : clamp01(t)); out[2 * i] = a[2 * i] + (b[2 * i] - a[2 * i]) * k; out[2 * i + 1] = a[2 * i + 1] + (b[2 * i + 1] - a[2 * i + 1]) * k; }
    return out;
  }
  // reorder target b so each source point travels a short path: sort both by angle-then-radius bucket (O(n log n))
  function match(a, b) {
    const n = a.length / 2, key = (p, i) => { const ang = Math.atan2(p[2 * i + 1], p[2 * i] ), r = Math.hypot(p[2 * i], p[2 * i + 1]); return Math.floor(r * 6) * 10 + (ang + P) / (2 * P); };
    const ia = [...Array(n).keys()].sort((i, j) => key(a, i) - key(a, j)), ib = [...Array(n).keys()].sort((i, j) => key(b, i) - key(b, j));
    const out = new Float32Array(b.length); for (let k = 0; k < n; k++) { out[2 * ia[k]] = b[2 * ib[k]]; out[2 * ia[k] + 1] = b[2 * ib[k] + 1]; }
    return out;
  }
  function resample(p, n) { const m = p.length / 2, out = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const j = Math.floor((i * m) / n); out[2 * i] = p[2 * j]; out[2 * i + 1] = p[2 * j + 1]; } return out; }
  const api = { EASE, staggerOrder, localT, interpolate, match, resample, clamp01 };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DotsMorph = api;
})(this);
