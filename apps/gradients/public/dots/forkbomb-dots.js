/*! forkbomb-dots.js v0.1.0 | MIT License (c) 2026 FORKBOMB contributors | zero dependencies
 * Tiny embeddable particle-shape library. Original code from standard math; not derived from dots-swarm.
 *
 * API
 *   const d = ForkbombDots.create(canvasOrSelector, { count=1200, size=2, colors=["#22d3ee","#f472b6"], bg=null,
 *                                                      interactive=true, spring=60, shape="disc" })
 *   d.morph("heart" | Float32Array points | {text:"Hi"}, { duration=1.4, ease="inOutCubic", stagger=0.3 })
 *   d.text("Hello", opts)          // sample any text into particles
 *   d.explode(power=2.5)           // burst outward, then springs reform
 *   d.play([{shape:"star",duration:1.5,hold:1}, {text:"Hi"}], {loop:true})   // timed sequence
 *   d.stop(); d.destroy();
 *   ForkbombDots.shapes            // list of built-in shape names
 *   ForkbombDots.points(name, n)   // Float32Array of n points in [-1,1]^2
 */
(function (root) {
  "use strict";
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, pow = Math.pow;
  function norm(p) { var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i; for (i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } var s = 1.84 / Math.max(x1 - x0, y1 - y0, 1e-9), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; for (i = 0; i < p.length; i += 2) { p[i] = (p[i] - cx) * s; p[i + 1] = (p[i + 1] - cy) * s; } return p; }
  function curve(f, n) { var R = 1024, xs = [], ys = [], L = [0], i, k, j = 0, o = new Float32Array(n * 2); for (i = 0; i <= R; i++) { var q = f(i / R); xs.push(q[0]); ys.push(q[1]); if (i) L.push(L[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])); } for (k = 0; k < n; k++) { var s = (k / n) * L[R]; while (j < R - 1 && L[j + 1] < s) j++; var u = (s - L[j]) / ((L[j + 1] - L[j]) || 1); o[2 * k] = xs[j] + (xs[j + 1] - xs[j]) * u; o[2 * k + 1] = ys[j] + (ys[j + 1] - ys[j]) * u; } return norm(o); }
  function polar(rf, turns) { return function (t) { var a = t * TAU * (turns || 1), r = rf(a); return [r * cos(a), r * sin(a)]; }; }
  function star(k, inner) { return function (t) { var s = t * 2 * k, i = Math.floor(s) % (2 * k), u = s - Math.floor(s), r = function (j) { return j % 2 ? inner : 1; }, a = function (j) { return -Math.PI / 2 + (j / (2 * k)) * TAU; }; return [r(i) * cos(a(i)) * (1 - u) + r(i + 1) * cos(a(i + 1)) * u, r(i) * sin(a(i)) * (1 - u) + r(i + 1) * sin(a(i + 1)) * u]; }; }
  var SH = {
    disc: function (n) { var o = new Float32Array(n * 2); for (var i = 0; i < n; i++) { var g = 2.39996 * i, r = Math.sqrt((i + 0.5) / n); o[2 * i] = cos(g) * r; o[2 * i + 1] = sin(g) * r; } return norm(o); },
    ring: function (n) { return curve(function (t) { return [cos(t * TAU), sin(t * TAU)]; }, n); },
    heart: function (n) { return curve(function (t) { var a = t * TAU; return [16 * pow(sin(a), 3), -(13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a))]; }, n); },
    star: function (n) { return curve(star(5, 0.42), n); }, sparkle: function (n) { return curve(star(4, 0.3), n); },
    triangle: function (n) { return curve(star(3, 0.5), n); }, square: function (n) { return curve(star(4, 0.7071), n); },
    infinity: function (n) { return curve(function (t) { var a = t * TAU, d = 1 + sin(a) * sin(a); return [cos(a) / d, sin(a) * cos(a) / d]; }, n); },
    rose: function (n) { return curve(polar(function (a) { return cos(3 * a); }), n); }, flower: function (n) { return curve(polar(function (a) { return 0.6 + 0.4 * cos(6 * a); }), n); },
    lissajous: function (n) { return curve(function (t) { return [sin(3 * t * TAU + 1.57), sin(2 * t * TAU)]; }, n); },
    spiral: function (n) { return curve(function (t) { var r = Math.sqrt(t), a = t * TAU * 4; return [r * cos(a), r * sin(a)]; }, n); },
    wave: function (n) { return curve(function (t) { return [t * 2 - 1, 0.35 * sin(t * TAU * 2)]; }, n); },
    sphere: function (n) { var o = new Float32Array(n * 2); for (var i = 0; i < n; i++) { var y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996, X = r * cos(a), Z = r * sin(a); o[2 * i] = X * 0.83 + Z * 0.56; o[2 * i + 1] = y * 0.88 - (Z * 0.83 - X * 0.56) * 0.48; } return norm(o); },
    cardioid: function (n) { return curve(polar(function (a) { return 1 - cos(a); }), n); },
    astroid: function (n) { return curve(function (t) { return [pow(cos(t * TAU), 3), pow(sin(t * TAU), 3)]; }, n); },
    blob: function (n) { return curve(polar(function (a) { return 1 + 0.18 * sin(3 * a) + 0.1 * cos(5 * a + 1); }), n); }
  };
  var EASE = { linear: function (t) { return t; }, inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2; }, outExpo: function (t) { return t >= 1 ? 1 : 1 - pow(2, -10 * t); }, outBack: function (t) { return 1 + 2.70158 * pow(t - 1, 3) + 1.70158 * pow(t - 1, 2); } };
  function points(name, n) { return (SH[name] || SH.disc)(n); }
  function textPoints(str, n) {
    if (typeof document === "undefined") return points("disc", n);
    var c = document.createElement("canvas"), x = c.getContext("2d"), f = "900 140px system-ui,sans-serif"; x.font = f; c.width = Math.ceil(x.measureText(str).width) + 20; c.height = 170; x.font = f; x.textBaseline = "top"; x.fillText(str, 10, 10);
    var d = x.getImageData(0, 0, c.width, c.height).data, idx = [], i; for (i = 0; i < c.width * c.height; i++) if (d[4 * i + 3] > 128) idx.push(i);
    var o = new Float32Array(n * 2); if (!idx.length) return points("disc", n); for (i = 0; i < n; i++) { var j = idx[Math.floor(((i + Math.random()) * idx.length) / n) % idx.length]; o[2 * i] = (j % c.width) + Math.random() - 0.5; o[2 * i + 1] = Math.floor(j / c.width) + Math.random() - 0.5; } return norm(o);
  }
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function create(target, opts) {
    opts = opts || {}; var cv = typeof target === "string" ? document.querySelector(target) : target, ctx = cv.getContext("2d"), n = opts.count || 1200, dpr = Math.min(2, root.devicePixelRatio || 1);
    var X = new Float32Array(n), Y = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n), TX = new Float32Array(n), TY = new Float32Array(n), FX = new Float32Array(n), FY = new Float32Array(n), DX = new Float32Array(n), DY = new Float32Array(n), ORD = new Float32Array(n);
    for (var i = 0; i < n; i++) { X[i] = Math.random() * 2 - 1; Y[i] = Math.random() * 2 - 1; ORD[i] = Math.random(); }
    var cols = (opts.colors || ["#22d3ee", "#f472b6"]).map(hex), mor = null, ptr = null, raf = 0, last = 0, seq = null, alive = true;
    function setT(p, o) { o = o || {}; for (var i = 0; i < n; i++) { FX[i] = TX[i]; FY[i] = TY[i]; DX[i] = p[2 * i]; DY[i] = p[2 * i + 1]; } mor = { t0: performance.now(), d: (o.duration || 1.4) * 1000, e: EASE[o.ease] || EASE.inOutCubic, s: o.stagger == null ? 0.3 : o.stagger }; }
    function resolve(s) { return typeof s === "string" ? points(s, n) : s && s.text != null ? textPoints(String(s.text), n) : s && s.shape ? points(s.shape, n) : s; }
    if (opts.interactive !== false) { cv.addEventListener("pointermove", function (e) { var r = cv.getBoundingClientRect(), sc = Math.min(r.width, r.height) * 0.45; ptr = [(e.clientX - r.left - r.width / 2) / sc, (e.clientY - r.top - r.height / 2) / sc]; }); cv.addEventListener("pointerleave", function () { ptr = null; }); }
    function tick(now) {
      if (!alive) return; var dt = Math.min(0.033, (now - (last || now)) / 1000); last = now; var w = (cv.clientWidth * dpr) | 0, h = (cv.clientHeight * dpr) | 0; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (mor) { var T = Math.min(1, (now - mor.t0) / mor.d); for (var i = 0; i < n; i++) { var lt = Math.max(0, Math.min(1, (T - ORD[i] * mor.s) / (1 - mor.s))), k = mor.e(lt); TX[i] = FX[i] + (DX[i] - FX[i]) * k; TY[i] = FY[i] + (DY[i] - FY[i]) * k; } if (T >= 1) mor = null; }
      var sp = opts.spring || 60, damp = pow(0.0009, dt), sc = Math.min(w, h) * 0.45; if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); } else ctx.clearRect(0, 0, w, h);
      var r = (opts.size || 2) * dpr, B = 8, paths = []; for (var b = 0; b < B; b++) paths.push([]);
      for (i = 0; i < n; i++) { var ax = (TX[i] - X[i]) * sp, ay = (TY[i] - Y[i]) * sp; if (ptr) { var dx = X[i] - ptr[0], dy = Y[i] - ptr[1], d2 = dx * dx + dy * dy; if (d2 < 0.12) { var fz = 2 * (1 - d2 / 0.12) / (Math.sqrt(d2) + 0.02); ax += dx * fz; ay += dy * fz; } } VX[i] = (VX[i] + ax * dt) * damp; VY[i] = (VY[i] + ay * dt) * damp; X[i] += VX[i] * dt; Y[i] += VY[i] * dt; paths[Math.min(B - 1, Math.max(0, Math.floor(((Y[i] + 1) / 2) * B)))].push(i); }
      for (b = 0; b < B; b++) { var t = (b / (B - 1)) * (cols.length - 1), j = Math.min(cols.length - 2, Math.floor(t)), u = t - j, c0 = cols[Math.max(0, j)], c1 = cols[j + 1] || c0; ctx.fillStyle = "rgb(" + [0, 1, 2].map(function (q) { return Math.round(c0[q] + (c1[q] - c0[q]) * u); }) + ")"; ctx.beginPath(); for (var m = 0; m < paths[b].length; m++) { var p = paths[b][m], px = w / 2 + X[p] * sc, py = h / 2 + Y[p] * sc; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU); } ctx.fill(); }
      raf = root.requestAnimationFrame(tick);
    }
    var api = {
      morph: function (s, o) { setT(resolve(s), o); return api; }, text: function (s, o) { setT(textPoints(String(s), n), o); return api; },
      explode: function (pw) { pw = pw || 2.5; for (var i = 0; i < n; i++) { var d = Math.hypot(X[i], Y[i]) + 0.05; VX[i] += X[i] / d * pw * (0.5 + Math.random()); VY[i] += Y[i] / d * pw * (0.5 + Math.random()); } return api; },
      play: function (steps, o) { api.stop(); var k = 0, loop = !o || o.loop !== false; (function next() { var s = steps[k]; if (!s) return; api.morph(s, s); seq = setTimeout(function () { k++; if (k >= steps.length) { if (!loop) return; k = 0; } next(); }, ((s.duration || 1.4) + (s.hold == null ? 1 : s.hold)) * 1000); })(); return api; },
      stop: function () { clearTimeout(seq); return api; }, destroy: function () { alive = false; api.stop(); root.cancelAnimationFrame(raf); }
    };
    setT(points(opts.shape || "disc", n), { duration: 0.01 }); raf = root.requestAnimationFrame(tick); return api;
  }
  var lib = { create: create, points: points, shapes: Object.keys(SH), version: "0.1.0" };
  if (typeof module === "object" && module.exports) module.exports = lib; else root.ForkbombDots = lib;
})(typeof window !== "undefined" ? window : this);
