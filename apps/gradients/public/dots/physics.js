// FORKBOMB Dots Studio: typed-array particle swarm. Spring-to-target, gravity, pointer repel/attract,
// floor bounce, collisions-lite (uniform-grid neighbour separation), explode / rain / reform. Original MIT code.
"use strict";
(function (root) {
  class Swarm {
    constructor(n) { this.resize(n); this.mode = "home"; }
    resize(n) {
      const o = this.x; this.n = n; const mk = () => new Float32Array(n);
      const nx = mk(), ny = mk(); for (let i = 0; i < n; i++) { nx[i] = o && i < o.length ? o[i] : (Math.random() * 2 - 1); ny[i] = o && i < o.length ? this.y[i] : (Math.random() * 2 - 1); }
      this.x = nx; this.y = ny; this.vx = mk(); this.vy = mk(); this.tx = mk(); this.ty = mk(); this.size = new Float32Array(n).fill(1);
      return this;
    }
    setTargets(p) { for (let i = 0; i < this.n; i++) { this.tx[i] = p[2 * i]; this.ty[i] = p[2 * i + 1]; } }
    positions(out) { out = out || new Float32Array(this.n * 2); for (let i = 0; i < this.n; i++) { out[2 * i] = this.x[i]; out[2 * i + 1] = this.y[i]; } return out; }
    explode(cx = 0, cy = 0, power = 2.5) { for (let i = 0; i < this.n; i++) { const dx = this.x[i] - cx, dy = this.y[i] - cy, d = Math.hypot(dx, dy) + 0.05, k = power * (0.6 + Math.random() * 0.8) / d; this.vx[i] += dx * k * 0.6; this.vy[i] += dy * k * 0.6; } }
    release() { this.mode = "free"; } reform() { this.mode = "home"; }
    // dt in seconds; o: {spring, damping, gravity, floor, restitution, pointer:{x,y,r,strength}, collide, radius}
    step(dt, o = {}) {
      const n = this.n, { x, y, vx, vy, tx, ty } = this, sp = o.spring ?? 60, damp = Math.pow(o.damping ?? 0.0009, dt), g = this.mode === "free" ? (o.gravity ?? 3) : (o.gravity && o.gravityHome ? o.gravity : 0);
      const fl = o.floor ?? 1, rest = o.restitution ?? 0.55, P = o.pointer, pr2 = P ? P.r * P.r : 0;
      for (let i = 0; i < n; i++) {
        let ax = 0, ay = g;
        if (this.mode === "home") { ax += (tx[i] - x[i]) * sp; ay += (ty[i] - y[i]) * sp; }
        if (P && P.strength) { const dx = x[i] - P.x, dy = y[i] - P.y, d2 = dx * dx + dy * dy; if (d2 < pr2) { const f = P.strength * (1 - d2 / pr2) / (Math.sqrt(d2) + 0.02); ax += dx * f; ay += dy * f; } }
        vx[i] = (vx[i] + ax * dt) * damp; vy[i] = (vy[i] + ay * dt) * damp; x[i] += vx[i] * dt; y[i] += vy[i] * dt;
        if (this.mode === "free") { if (y[i] > fl) { y[i] = fl; vy[i] = -vy[i] * rest; vx[i] *= 0.9; } if (x[i] < -o.wall || x[i] > o.wall) { x[i] = Math.max(-o.wall, Math.min(o.wall, x[i])); vx[i] = -vx[i] * rest; } }
      }
      if (o.collide) this.collide(o.radius || 0.012);
    }
    collide(r) {
      const n = this.n, cell = r * 2, G = 1 / cell, head = new Map(), next = new Int32Array(n).fill(-1), { x, y } = this, key = (cx, cy) => cx * 73856093 ^ cy * 19349663;
      for (let i = 0; i < n; i++) { const k = key(Math.floor(x[i] * G), Math.floor(y[i] * G)); const h = head.get(k); next[i] = h === undefined ? -1 : h; head.set(k, i); }
      const d0 = cell, d02 = d0 * d0;
      for (let i = 0; i < n; i++) { const cx = Math.floor(x[i] * G), cy = Math.floor(y[i] * G);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { let j = head.get(key(cx + ox, cy + oy)); while (j !== undefined && j !== -1) { if (j > i) { const dx = x[j] - x[i], dy = y[j] - y[i], d2 = dx * dx + dy * dy; if (d2 < d02 && d2 > 1e-12) { const d = Math.sqrt(d2), p = (d0 - d) / d * 0.25; x[i] -= dx * p; y[i] -= dy * p; x[j] += dx * p; y[j] += dy * p; } } j = next[j]; } } }
    }
    energy() { let e = 0; for (let i = 0; i < this.n; i++) e += this.vx[i] ** 2 + this.vy[i] ** 2; return e / Math.max(1, this.n); }
    maxError() { let m = 0; for (let i = 0; i < this.n; i++) m = Math.max(m, Math.hypot(this.x[i] - this.tx[i], this.y[i] - this.ty[i])); return m; }
  }
  const api = { Swarm };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DotsPhysics = api;
})(this);
