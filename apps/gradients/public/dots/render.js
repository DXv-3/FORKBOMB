// FORKBOMB Dots Studio: renderers. Canvas2D (colour-bucketed batched paths) and WebGL2 GL_POINTS
// (one draw call, round sprites) for ~10k dots at 60fps. Plus colour helpers. Original MIT code.
"use strict";
(function (root) {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function rampSampler(stops) { const c = stops.map(hex); return (t) => { t = Math.min(1, Math.max(0, t)) * (c.length - 1); const i = Math.min(c.length - 2, Math.floor(t)), u = t - i, a = c[i], b = c[i + 1] || a; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }; }
  // fill rgb (Uint8Array n*3) from swarm state according to mode
  function colorize(rgb, sw, mode, palette, image) {
    const s = rampSampler(palette.length > 1 ? palette : [palette[0], palette[0]]), n = sw.n;
    for (let i = 0; i < n; i++) {
      let c;
      if (mode === "image" && image && image.length >= 3 * n) { rgb[3 * i] = image[3 * i]; rgb[3 * i + 1] = image[3 * i + 1]; rgb[3 * i + 2] = image[3 * i + 2]; continue; }
      if (mode === "gradient-x") c = s((sw.x[i] + 1) / 2); else if (mode === "radial") c = s(Math.hypot(sw.x[i], sw.y[i]) / 1.2);
      else if (mode === "index") c = s(i / n); else if (mode === "speed") c = s(Math.min(1, Math.hypot(sw.vx[i], sw.vy[i]) / 2)); else if (mode === "solid") c = s(0);
      else c = s((sw.y[i] + 1) / 2);
      rgb[3 * i] = c[0]; rgb[3 * i + 1] = c[1]; rgb[3 * i + 2] = c[2];
    }
    return rgb;
  }
  class Canvas2DRenderer {
    constructor(canvas) { this.c = canvas; this.x = canvas.getContext("2d"); this.kind = "canvas"; }
    draw(sw, rgb, o) {
      const { c, x } = this, w = c.width, h = c.height, sc = Math.min(w, h) * (o.scale || 0.45), cx = w / 2, cy = h / 2, r = Math.max(0.5, o.dotSize * (o.dpr || 1)), round = sw.n <= 3000;
      x.fillStyle = o.bg; x.fillRect(0, 0, w, h);
      const buckets = new Map();
      for (let i = 0; i < sw.n; i++) { const k = ((rgb[3 * i] >> 3) << 10) | ((rgb[3 * i + 1] >> 3) << 5) | (rgb[3 * i + 2] >> 3); let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(i); }
      for (const [k, list] of buckets) {
        x.fillStyle = `rgb(${(k >> 10) << 3},${((k >> 5) & 31) << 3},${(k & 31) << 3})`; x.beginPath();
        for (const i of list) { const px = cx + sw.x[i] * sc, py = cy + sw.y[i] * sc, rr = r * sw.size[i]; if (round) { x.moveTo(px + rr, py); x.arc(px, py, rr, 0, 6.2832); } else x.rect(px - rr, py - rr, rr * 2, rr * 2); }
        x.fill();
      }
    }
  }
  class WebGLRenderer {
    constructor(canvas) {
      const g = (this.g = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false })); if (!g) throw new Error("WebGL2 unavailable"); this.c = canvas; this.kind = "webgl";
      const vs = `#version 300 es\nin vec2 a_p; in vec3 a_c; in float a_s; uniform vec2 u_scale; uniform float u_r; out vec3 v_c;\nvoid main(){ gl_Position = vec4(a_p * u_scale * vec2(1.0, -1.0), 0.0, 1.0); gl_PointSize = u_r * a_s * 2.0; v_c = a_c; }`;
      const fs = `#version 300 es\nprecision mediump float; in vec3 v_c; out vec4 o;\nvoid main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; o = vec4(v_c, smoothstep(0.25, 0.18, r)); }`;
      const mk = (t, s) => { const sh = g.createShader(t); g.shaderSource(sh, s); g.compileShader(sh); if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh)); return sh; };
      const p = (this.p = g.createProgram()); g.attachShader(p, mk(g.VERTEX_SHADER, vs)); g.attachShader(p, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
      this.bp = g.createBuffer(); this.bc = g.createBuffer(); this.bs = g.createBuffer(); this.pos = null;
      this.vao = g.createVertexArray(); g.bindVertexArray(this.vao);
      const bind = (buf, name, size, type, norm) => { const l = g.getAttribLocation(p, name); g.bindBuffer(g.ARRAY_BUFFER, buf); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, size, type, norm, 0, 0); };
      bind(this.bp, "a_p", 2, g.FLOAT, false); bind(this.bc, "a_c", 3, g.UNSIGNED_BYTE, true); bind(this.bs, "a_s", 1, g.FLOAT, false);
      g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    }
    draw(sw, rgb, o) {
      const g = this.g, w = this.c.width, h = this.c.height, s = (o.scale || 0.45) * Math.min(w, h), bg = hex(o.bg);
      if (!this.pos || this.pos.length !== sw.n * 2) this.pos = new Float32Array(sw.n * 2); sw.positions(this.pos);
      g.viewport(0, 0, w, h); g.clearColor(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1); g.clear(g.COLOR_BUFFER_BIT); g.useProgram(this.p); g.bindVertexArray(this.vao);
      g.bindBuffer(g.ARRAY_BUFFER, this.bp); g.bufferData(g.ARRAY_BUFFER, this.pos, g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, this.bc); g.bufferData(g.ARRAY_BUFFER, rgb.subarray(0, sw.n * 3), g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, this.bs); g.bufferData(g.ARRAY_BUFFER, sw.size, g.DYNAMIC_DRAW);
      g.uniform2f(g.getUniformLocation(this.p, "u_scale"), (2 * s) / w, (2 * s) / h); g.uniform1f(g.getUniformLocation(this.p, "u_r"), Math.max(1, o.dotSize * (o.dpr || 1)));
      g.drawArrays(g.POINTS, 0, sw.n);
    }
  }
  const api = { hex, rampSampler, colorize, Canvas2DRenderer, WebGLRenderer };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DotsRender = api;
})(this);
