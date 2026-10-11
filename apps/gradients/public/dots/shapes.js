// FORKBOMB Dots Studio: procedural shape library. Original MIT code, standard math only
// (parametric curves, polar curves, superformula, signed-distance fills, pixel-mask sampling).
// No shape data from dotsui.dev / dots-swarm / @dots-swarm/pro is used.
// Every generator returns Float32Array [x0,y0,x1,y1,...] of exactly n points inside [-1,1]^2.
"use strict";
(function (root) {
  const TAU = Math.PI * 2, { sin, cos, abs, sqrt, pow, atan2, hypot, min, max } = Math;
  // seeded PRNG (mulberry32)
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

  // fit points into [-fit,fit] keeping aspect, centered
  function normalize(p, fit = 0.92) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { x0 = min(x0, p[i]); x1 = max(x1, p[i]); y0 = min(y0, p[i + 1]); y1 = max(y1, p[i + 1]); }
    const s = (2 * fit) / max(x1 - x0, y1 - y0, 1e-9), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let i = 0; i < p.length; i += 2) { p[i] = (p[i] - cx) * s; p[i + 1] = (p[i + 1] - cy) * s; }
    return p;
  }
  // n points evenly spaced by arc length along one or more polylines produced by f(t), t in [0,1]
  function curve(f, n, closed = true, res = 2048) {
    const xs = new Float64Array(res + 1), ys = new Float64Array(res + 1), L = new Float64Array(res + 1);
    for (let i = 0; i <= res; i++) { const q = f(i / res); xs[i] = q[0]; ys[i] = q[1]; if (i) { const d = hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]); L[i] = L[i - 1] + (d > 0.5 ? 0 : d); } }
    const out = new Float32Array(n * 2), total = L[res] || 1; let j = 0;
    for (let k = 0; k < n; k++) {
      const s = closed ? (k / n) * total : (k / max(1, n - 1)) * total;
      while (j < res && L[j + 1] < s) j++;
      const seg = L[j + 1] - L[j] || 1, u = min(1, max(0, (s - L[j]) / seg)), j1 = min(res, j + 1);
      out[2 * k] = xs[j] + (xs[j1] - xs[j]) * u; out[2 * k + 1] = ys[j] + (ys[j1] - ys[j]) * u;
    }
    return normalize(out);
  }
  // several curves sharing n points proportionally to their length
  function multi(fs, n) {
    const lens = fs.map((f) => { let l = 0, p = f(0); for (let i = 1; i <= 256; i++) { const q = f(i / 256); l += hypot(q[0] - p[0], q[1] - p[1]); p = q; } return l; });
    const tot = lens.reduce((a, b) => a + b, 0), out = new Float32Array(n * 2); let o = 0;
    fs.forEach((f, idx) => {
      const k = idx === fs.length - 1 ? n - o / 2 : Math.round((lens[idx] / tot) * n); if (k <= 0) return;
      for (let i = 0; i < k; i++) { const q = f(i / k); out[o++] = q[0]; out[o++] = q[1]; }
    });
    return normalize(out);
  }
  // fill a region given inside(x,y) over [-1,1]^2 via Halton low-discrepancy sampling
  function fill(inside, n) {
    const out = new Float32Array(n * 2); let k = 0, i = 1;
    const cap = n * 400 + 10000;
    while (k < n && i < cap) { const x = halton(i, 2) * 2 - 1, y = halton(i, 3) * 2 - 1; i++; if (inside(x, y)) { out[2 * k] = x; out[2 * k + 1] = y; k++; } }
    for (let j = k; j < n; j++) { out[2 * j] = out[2 * (j % max(1, k))]; out[2 * j + 1] = out[2 * (j % max(1, k)) + 1]; }
    return normalize(out);
  }
  const poly = (sides, rot = -Math.PI / 2) => (t) => { const s = t * sides, i = Math.floor(s) % sides, u = s - Math.floor(s), a0 = rot + (i / sides) * TAU, a1 = rot + ((i + 1) / sides) * TAU; return [cos(a0) + (cos(a1) - cos(a0)) * u, sin(a0) + (sin(a1) - sin(a0)) * u]; };
  const star = (k, inner) => (t) => { const s = t * 2 * k, i = Math.floor(s) % (2 * k), u = s - Math.floor(s), r = (j) => (j % 2 ? inner : 1), a = (j) => -Math.PI / 2 + (j / (2 * k)) * TAU; const p0 = [r(i) * cos(a(i)), r(i) * sin(a(i))], p1 = [r(i + 1) * cos(a(i + 1)), r(i + 1) * sin(a(i + 1))]; return [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u]; };
  const polar = (rf, turns = 1) => (t) => { const a = t * TAU * turns, r = rf(a); return [r * cos(a), r * sin(a)]; };
  // Gielis superformula
  const superR = (m, n1, n2, n3, a = 1, b = 1) => (phi) => { const t1 = pow(abs(cos((m * phi) / 4) / a), n2), t2 = pow(abs(sin((m * phi) / 4) / b), n3); return pow(t1 + t2, -1 / n1) || 0; };
  const inPoly = (x, y, sides, rot = -Math.PI / 2) => { const a = atan2(y, x) - rot, seg = TAU / sides, r = cos(Math.PI / sides) / cos(((a % seg) + seg) % seg - seg / 2); return hypot(x, y) <= r * 0.98; };
  const inStar = (x, y, k, inner) => { const a = atan2(y, x) + Math.PI / 2, seg = TAU / k, f = abs((((a % seg) + seg) % seg) / seg - 0.5) * 2; return hypot(x, y) <= inner + (1 - inner) * f * f * 0.9 + 0.02; };
  const heartF = (t) => { const a = t * TAU; return [16 * pow(sin(a), 3), -(13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a))]; };
  const inHeart = (x, y) => { const X = x * 1.2, Y = -y * 1.2 + 0.25; return pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0; };
  const proj = (x, y, z, rx = 0.5, ry = 0.6) => { const cy = cos(ry), sy = sin(ry), cx = cos(rx), sx = sin(rx); const X = x * cy + z * sy, Z = -x * sy + z * cy; const Y = y * cx - Z * sx; return [X, Y]; };
  const seg = (pts) => (t) => { const m = pts.length - 1, s = t * m, i = min(m - 1, Math.floor(s)), u = s - i; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; };

  const S = {};
  const add = (name, cat, fn) => { S[name] = { cat, fn }; };
  // ---- basics
  add("disc", "basic", (n) => { const o = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const g = 2.399963229728653 * i, r = sqrt((i + 0.5) / n); o[2 * i] = cos(g) * r; o[2 * i + 1] = sin(g) * r; } return normalize(o); });
  add("ring", "basic", (n) => curve((t) => [cos(t * TAU), sin(t * TAU)], n));
  add("double-ring", "basic", (n) => multi([(t) => [cos(t * TAU), sin(t * TAU)], (t) => [0.6 * cos(t * TAU), 0.6 * sin(t * TAU)]], n));
  add("target", "basic", (n) => multi([1, 0.7, 0.4, 0.12].map((r) => (t) => [r * cos(t * TAU), r * sin(t * TAU)]), n));
  add("square-grid", "basic", (n) => { const o = new Float32Array(n * 2), c = Math.ceil(sqrt(n)); for (let i = 0; i < n; i++) { o[2 * i] = (i % c) / (c - 1 || 1) * 2 - 1; o[2 * i + 1] = Math.floor(i / c) / (c - 1 || 1) * 2 - 1; } return normalize(o); });
  add("line", "basic", (n) => { const o = new Float32Array(n * 2); for (let i = 0; i < n; i++) { o[2 * i] = (i / max(1, n - 1)) * 2 - 1; o[2 * i + 1] = 0; } return normalize(o); });
  add("wave", "basic", (n) => curve((t) => [t * 2 - 1, 0.35 * sin(t * TAU * 2)], n, false));
  add("sine-stack", "basic", (n) => multi([-0.6, -0.2, 0.2, 0.6].map((o) => (t) => [t * 2 - 1, o + 0.12 * sin(t * TAU * 3 + o * 4)]), n));
  // ---- polygons & stars (outline + filled)
  for (const [k, nm] of [[3, "triangle"], [4, "square"], [5, "pentagon"], [6, "hexagon"], [7, "heptagon"], [8, "octagon"]]) add(nm, "polygon", (n) => curve(poly(k, k === 4 ? -Math.PI / 4 : -Math.PI / 2), n));
  for (const [k, nm] of [[3, "triangle-fill"], [4, "square-fill"], [6, "hexagon-fill"]]) add(nm, "polygon", (n) => fill((x, y) => inPoly(x, y, k, k === 4 ? -Math.PI / 4 : -Math.PI / 2), n));
  add("diamond", "polygon", (n) => curve((t) => { const p = poly(4, 0)(t); return [p[0] * 0.7, p[1]]; }, n));
  for (const [k, inr, nm] of [[5, 0.42, "star"], [6, 0.55, "star-6"], [8, 0.6, "star-8"], [12, 0.75, "starburst"], [4, 0.3, "sparkle"]]) add(nm, "star", (n) => curve(star(k, inr), n));
  add("star-fill", "star", (n) => fill((x, y) => inStar(x, y, 5, 0.42), n));
  // ---- superformula family
  for (const [nm, a] of [["sf-flower", [6, 1, 1, 1]], ["sf-gear", [12, 15, 20, 3]], ["sf-shield", [4, 12, 15, 15]], ["sf-blob", [5, 2, 7, 7]], ["sf-crystal", [8, 0.5, 0.5, 8]], ["sf-cross", [4, 0.4, 1.4, 1.4]], ["sf-leaf", [2, 1, 4, 8]], ["sf-shell", [3, 4.5, 10, 10]]]) add(nm, "superformula", (n) => curve(polar(superR(...a)), n));
  // ---- lissajous
  for (const [p, q, d] of [[1, 2, 0], [3, 2, 0.5], [3, 4, 0.25], [5, 4, 0.5], [5, 6, 0.3], [7, 6, 0.2]]) add(`lissajous-${p}-${q}`, "lissajous", (n) => curve((t) => [sin(p * t * TAU + d * Math.PI), sin(q * t * TAU)], n));
  // ---- roses r = cos(k a)
  for (const [num, den] of [[2, 1], [3, 1], [4, 1], [5, 1], [7, 1], [3, 2], [5, 3], [7, 4]]) { const k = num / den, turns = (num * den) % 2 ? den : 2 * den; add(`rose-${num}${den > 1 ? "-" + den : ""}`, "rose", (n) => curve(polar((a) => cos(k * a), turns), n)); }
  // ---- hearts & organic
  add("heart", "organic", (n) => curve(heartF, n));
  add("heart-fill", "organic", (n) => fill(inHeart, n));
  add("double-heart", "organic", (n) => multi([heartF, (t) => heartF(t).map((v) => v * 0.6)], n));
  add("cardioid", "organic", (n) => curve(polar((a) => 1 - cos(a)), n));
  add("infinity", "organic", (n) => curve((t) => { const a = t * TAU, d = 1 + sin(a) ** 2; return [cos(a) / d, (sin(a) * cos(a)) / d]; }, n));
  add("butterfly", "organic", (n) => curve(polar((a) => Math.exp(cos(a)) - 2 * cos(4 * a) - pow(sin(a / 12), 5), 12), n));
  add("drop", "organic", (n) => curve((t) => { const a = t * TAU; return [sin(a) * pow(sin(a / 2), 1.2) * 0.9, -cos(a)]; }, n));
  add("crescent", "organic", (n) => fill((x, y) => hypot(x, y) < 0.95 && hypot(x - 0.38, y - 0.12) > 0.75, n));
  add("cloud", "organic", (n) => fill((x, y) => [[-0.45, 0.1, 0.38], [0, -0.15, 0.5], [0.45, 0.08, 0.4], [0.05, 0.25, 0.35], [-0.2, 0.3, 0.3], [0.3, 0.3, 0.3]].some(([a, b, r]) => hypot(x - a, (y - b) * 1.2) < r) && y < 0.48, n));
  add("leaf", "organic", (n) => fill((x, y) => { const X = x / 0.6, Y = y; return X * X + Y * Y < 1 && abs(X) < (1 - Y * Y) * 0.9 + 0.05; }, n));
  add("flower", "organic", (n) => fill((x, y) => hypot(x, y) < 0.25 + 0.7 * abs(cos(2.5 * atan2(y, x))), n));
  add("blob", "organic", (n) => curve(polar((a) => 1 + 0.18 * sin(3 * a) + 0.1 * cos(5 * a + 1) + 0.06 * sin(7 * a)), n));
  // ---- spirals & math curves
  add("spiral", "curve", (n) => curve((t) => { const r = sqrt(t), a = t * TAU * 4; return [r * cos(a), r * sin(a)]; }, n, false));
  add("archimedes", "curve", (n) => curve((t) => { const a = t * TAU * 5; return [t * cos(a), t * sin(a)]; }, n, false));
  add("galaxy", "curve", (n) => { const r = rng(7), o = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const arm = i % 3, u = pow(r(), 0.7), a = u * 7 + (arm * TAU) / 3 + (r() - 0.5) * 0.5 * (1 - u), rr = u + (r() - 0.5) * 0.06; o[2 * i] = rr * cos(a); o[2 * i + 1] = rr * sin(a); } return normalize(o); });
  add("phyllotaxis", "curve", (n) => { const o = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const a = i * 137.508 * Math.PI / 180, r = sqrt(i / n); o[2 * i] = r * cos(a); o[2 * i + 1] = r * sin(a) * 0.999; } return normalize(o); });
  add("astroid", "curve", (n) => curve((t) => [pow(cos(t * TAU), 3), pow(sin(t * TAU), 3)], n));
  add("deltoid", "curve", (n) => curve((t) => { const a = t * TAU; return [2 * cos(a) + cos(2 * a), 2 * sin(a) - sin(2 * a)]; }, n));
  add("epicycloid", "curve", (n) => curve((t) => { const a = t * TAU, k = 5; return [(k + 1) * cos(a) - cos((k + 1) * a), (k + 1) * sin(a) - sin((k + 1) * a)]; }, n));
  add("hypotrochoid", "curve", (n) => curve((t) => { const a = t * TAU * 3, R = 5, r = 3, d = 5; return [(R - r) * cos(a) + d * cos(((R - r) / r) * a), (R - r) * sin(a) - d * sin(((R - r) / r) * a)]; }, n));
  add("trefoil", "curve", (n) => curve((t) => { const a = t * TAU; return [sin(a) + 2 * sin(2 * a), cos(a) - 2 * cos(2 * a)]; }, n));
  add("lemniscate", "curve", (n) => curve((t) => { const a = t * TAU; return [cos(a), sin(2 * a) / 2]; }, n));
  add("spirograph", "curve", (n) => curve((t) => { const a = t * TAU * 7; return [cos(a) + 0.6 * cos(a * 3.43), sin(a) + 0.6 * sin(a * 3.43)]; }, n));
  // ---- 3D projected
  add("sphere", "3d", (n) => { const o = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = sqrt(1 - y * y), a = i * 2.399963; const p = proj(r * cos(a), y, r * sin(a)); o[2 * i] = p[0]; o[2 * i + 1] = p[1]; } return normalize(o); });
  add("wire-globe", "3d", (n) => multi([...[0, 1, 2, 3, 4, 5].map((k) => (t) => { const a = t * TAU, b = (k / 6) * Math.PI; return proj(cos(a) * cos(b), sin(a), cos(a) * sin(b)); }), ...[-0.6, 0, 0.6].map((y) => (t) => { const a = t * TAU, r = sqrt(1 - y * y); return proj(r * cos(a), y, r * sin(a)); })], n));
  add("torus", "3d", (n) => { const o = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const u = halton(i + 1, 2) * TAU, v = halton(i + 1, 3) * TAU, p = proj((1 + 0.4 * cos(v)) * cos(u), 0.4 * sin(v), (1 + 0.4 * cos(v)) * sin(u), 1.0, 0.3); o[2 * i] = p[0]; o[2 * i + 1] = p[1]; } return normalize(o); });
  add("helix", "3d", (n) => multi([0, Math.PI].map((ph) => (t) => proj(0.5 * cos(t * TAU * 3 + ph), t * 2 - 1, 0.5 * sin(t * TAU * 3 + ph), 0.2, 0.1)), n));
  add("cube", "3d", (n) => { const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]; return multi(e.map(([a, b]) => (t) => proj(...v[a].map((c, i) => c + (v[b][i] - c) * t), 0.55, 0.7)), n); });
  add("atom", "3d", (n) => multi([0, 1, 2].map((k) => (t) => { const a = t * TAU, r = (k * Math.PI) / 3, x = cos(a), y = 0.35 * sin(a); return [x * cos(r) - y * sin(r), x * sin(r) + y * cos(r)]; }), n));
  // ---- icons / glyph-like
  add("plus", "icon", (n) => fill((x, y) => (abs(x) < 0.25 && abs(y) < 0.9) || (abs(y) < 0.25 && abs(x) < 0.9), n));
  add("cross-x", "icon", (n) => fill((x, y) => (abs(x - y) < 0.3 || abs(x + y) < 0.3) && abs(x) < 0.85 && abs(y) < 0.85, n));
  add("check", "icon", (n) => curve(seg([[-0.8, 0], [-0.25, 0.55], [0.85, -0.6]]), n, false));
  add("arrow-right", "icon", (n) => curve(seg([[-0.9, 0], [0.85, 0], [0.35, -0.45], [0.85, 0], [0.35, 0.45]]), n, false));
  add("play", "icon", (n) => fill((x, y) => x > -0.6 && abs(y) < (0.8 - x) * 0.62, n));
  add("pause", "icon", (n) => fill((x, y) => abs(y) < 0.8 && abs(abs(x) - 0.38) < 0.17, n));
  add("smile", "icon", (n) => multi([(t) => [cos(t * TAU), sin(t * TAU)], (t) => [-0.35 + 0.08 * cos(t * TAU), -0.3 + 0.08 * sin(t * TAU)], (t) => [0.35 + 0.08 * cos(t * TAU), -0.3 + 0.08 * sin(t * TAU)], (t) => { const a = 0.15 * Math.PI + t * 0.7 * Math.PI; return [0.55 * cos(a), 0.55 * sin(a) - 0.05]; }], n));
  add("gear", "icon", (n) => fill((x, y) => { const r = hypot(x, y), a = atan2(y, x); return r > 0.3 && r < 0.72 + 0.2 * (cos(a * 8) > 0.3 ? 1 : 0); }, n));
  add("bolt", "icon", (n) => curve(seg([[0.15, -1], [-0.55, 0.1], [-0.05, 0.1], [-0.2, 1], [0.55, -0.15], [0.05, -0.15], [0.15, -1]]), n));
  add("house", "icon", (n) => curve(seg([[-0.7, 0.9], [-0.7, -0.1], [0, -0.8], [0.7, -0.1], [0.7, 0.9], [-0.7, 0.9]]), n));
  add("bell", "icon", (n) => fill((x, y) => (y > -0.7 && y < 0.55 && abs(x) < 0.25 + 0.5 * pow((y + 0.7) / 1.25, 1.6)) || hypot(x, y - 0.75) < 0.15 || hypot(x, y + 0.8) < 0.12, n));
  add("chat-bubble", "icon", (n) => fill((x, y) => { const X = x / 0.95, Y = (y + 0.15) / 0.65; return X * X + Y * Y < 1 || (y > 0.3 && y < 0.85 && x > -0.55 && x < -0.2 && x - -0.55 < (0.85 - y) * 0.9); }, n));
  add("eye", "icon", (n) => multi([(t) => { const a = t * TAU; return [cos(a), 0.5 * sin(a) * abs(sin(a))]; }, (t) => [0.28 * cos(t * TAU), 0.28 * sin(t * TAU)]], n));
  add("pin", "icon", (n) => multi([(t) => { const a = t * TAU; return [0.8 * sin(a) * pow(abs(sin(a / 2)), 0.6), -0.4 - 0.8 * cos(a) * (cos(a) > 0 ? 0.75 : 1.4)]; }, (t) => [0.25 * cos(t * TAU), -0.5 + 0.25 * sin(t * TAU)]], n));
  add("dna", "icon", (n) => multi([0, Math.PI].map((ph) => (t) => [0.5 * sin(t * TAU * 2 + ph), t * 2 - 1]).concat([0, 1, 2, 3, 4, 5, 6, 7].map((k) => (t) => { const y = (k + 0.5) / 8, a = y * TAU * 2; return [0.5 * sin(a) * (1 - 2 * t), y * 2 - 1]; })), n));

  const NAMES = Object.keys(S);
  function shape(name, n) { const s = Object.prototype.hasOwnProperty.call(S, name) ? S[name] : S.disc; return s.fn(Math.max(1, Math.min(20000, n | 0))); }
  const categories = () => { const c = {}; for (const k of NAMES) (c[S[k].cat] = c[S[k].cat] || []).push(k); return c; };

  // ---- pixel-mask sampling (pure; used for text, SVG, images). mask: Uint8 alpha-ish values w*h.
  function maskPoints(mask, w, h, n, thresh = 128, seed = 1) {
    const idx = []; for (let i = 0; i < w * h; i++) if (mask[i] >= thresh) idx.push(i);
    const out = new Float32Array(n * 2), src = new Uint32Array(n); if (!idx.length) return { points: shape("disc", n), src };
    const r = rng(seed), step = idx.length / n;
    for (let k = 0; k < n; k++) { const i = idx[Math.min(idx.length - 1, Math.floor((k + r()) * step))]; src[k] = i; out[2 * k] = (i % w) + r() - 0.5; out[2 * k + 1] = Math.floor(i / w) + r() - 0.5; }
    normalize(out); return { points: out, src };
  }
  // browser helpers (need a canvas)
  function makeCanvas(w, h) { if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h); const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function alphaOf(ctx, w, h, lum) { const d = ctx.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = lum ? (255 - (0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2])) * d[4 * i + 3] / 255 : d[4 * i + 3]; return m; }
  function textPoints(text, n, font = "900 160px system-ui, sans-serif") {
    const lines = String(text || " ").split("\n"), m = makeCanvas(8, 8).getContext("2d"); m.font = font;
    const lh = parseInt(/(\d+)px/.exec(font)?.[1] || 160, 10) * 1.1, w = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width), 10)) + 20, h = Math.ceil(lh * lines.length) + 20;
    const c = makeCanvas(w, h), x = c.getContext("2d"); x.font = font; x.textBaseline = "top"; x.fillStyle = "#000"; lines.forEach((l, i) => x.fillText(l, 10, 10 + i * lh));
    return maskPoints(alphaOf(x, w, h), w, h, n).points;
  }
  // SVG input is treated as untrusted text: it is never parsed as markup or inserted into the DOM. We only extract
  // path data (d="...") and the viewBox numbers, and drop anything that is not pure path grammar.
  const SVG_MAX = 20000, PATH_RE = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]*$/;
  function svgPathData(svgOrPath) {
    const t = String(svgOrPath == null ? "" : svgOrPath).slice(0, SVG_MAX);
    const ds = /<svg|<path/i.test(t) ? [...t.matchAll(/\sd\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]) : [t];
    const vb = /viewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/.exec(t);
    let vw = vb ? Number(vb[3]) : 24, vh = vb ? Number(vb[4]) : 24;
    if (!(vw > 0 && vw < 1e6)) vw = 24; if (!(vh > 0 && vh < 1e6)) vh = 24;
    return { paths: ds.map((d) => d.trim()).filter((d) => d && PATH_RE.test(d)).slice(0, 64), vw, vh };
  }
  function svgPoints(svgOrPath, n, size = 256) {
    const { paths: ds, vw, vh } = svgPathData(svgOrPath);
    if (!ds.length) return shape("disc", n);
    const c = makeCanvas(size, size), x = c.getContext("2d"), s = size / Math.max(vw, vh); x.setTransform(s, 0, 0, s, 0, 0); x.lineWidth = Math.max(vw, vh) / 40; x.fillStyle = x.strokeStyle = "#000";
    for (const d of ds) { try { const p = new Path2D(d); x.fill(p); x.stroke(p); } catch (_) {} }
    return maskPoints(alphaOf(x, size, size), size, size, n).points;
  }
  function imagePoints(img, n, size = 220) {
    const ar = (img.width || 1) / (img.height || 1), w = ar >= 1 ? size : Math.round(size * ar), h = ar >= 1 ? Math.round(size / ar) : size;
    const c = makeCanvas(w, h), x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
    const { points, src } = maskPoints(alphaOf(x, w, h, true), w, h, n, 40); const colors = new Uint8Array(n * 3);
    for (let k = 0; k < n; k++) { const i = src[k]; colors[3 * k] = d[4 * i]; colors[3 * k + 1] = d[4 * i + 1]; colors[3 * k + 2] = d[4 * i + 2]; }
    return { points, colors };
  }
  const api = { shape, NAMES, categories, normalize, curve, fill, maskPoints, textPoints, svgPathData, svgPoints, imagePoints, rng };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DotsShapes = api;
})(this);
