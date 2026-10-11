// FORKBOMB Dots Studio: scene model, JSON save/load, share-link encoding, timeline evaluation,
// embeddable snippet generation. Original MIT code.
"use strict";
(function (root) {
  const PALETTES = {
    ink: ["#f5f5f7", "#9aa0ff"], sunset: ["#ff5f6d", "#ffc371"], ocean: ["#00c6ff", "#0072ff"], mint: ["#a8ff78", "#78ffd6"],
    neon: ["#f72585", "#7209b7", "#4cc9f0"], ember: ["#ff4e00", "#ec9f05", "#fff1a8"], mono: ["#ffffff", "#ffffff"], aurora: ["#22d3ee", "#a78bfa", "#f472b6"],
  };
  const COLOR_MODES = ["gradient-y", "gradient-x", "radial", "index", "speed", "image", "solid"];
  const STEP_KINDS = ["shape", "text", "svg", "ui", "image"];
  const DEFAULT = () => ({
    version: 1, count: 1500, dotSize: 2.2, bg: "#07070c", renderer: "canvas", colorMode: "gradient-y",
    palette: PALETTES.aurora.slice(), physics: { spring: 60, damping: 0.0009, gravity: 3, pointer: "repel", pointerStrength: 2, collide: false },
    audio: { enabled: false, gain: 1 }, loop: true,
    timeline: [{ kind: "shape", value: "heart", duration: 1.6, hold: 1.4, ease: "inOutCubic", stagger: 0.35, order: "radial" },
               { kind: "shape", value: "star", duration: 1.6, hold: 1.4, ease: "outBack", stagger: 0.3, order: "angle" },
               { kind: "text", value: "DOTS", duration: 1.8, hold: 1.6, ease: "outExpo", stagger: 0.4, order: "x" }],
  });
  const ORDERS = ["radial", "angle", "x", "y", "index", "random"];
  const MAX_JSON = 512 * 1024, MAX_HASH = 256 * 1024; // scene files / share links larger than this are rejected
  const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const str = (v, d, max = 4000) => (typeof v === "string" ? v.slice(0, max) : d);
  function normalizeScene(s) {
    const d = DEFAULT(); s = s && typeof s === "object" ? s : {};
    const ph = s.physics && typeof s.physics === "object" ? s.physics : {};
    const out = {
      version: 1, count: Math.round(num(s.count, d.count, 1, 20000)), dotSize: num(s.dotSize, d.dotSize, 0.3, 12),
      bg: /^#[0-9a-f]{6}$/i.test(s.bg) ? s.bg : d.bg, renderer: s.renderer === "webgl" ? "webgl" : "canvas",
      colorMode: COLOR_MODES.includes(s.colorMode) ? s.colorMode : d.colorMode,
      palette: Array.isArray(s.palette) && s.palette.length && s.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c)) ? s.palette.slice(0, 8) : d.palette,
      physics: { spring: num(ph.spring, d.physics.spring, 1, 400), damping: num(ph.damping, d.physics.damping, 1e-6, 1), gravity: num(ph.gravity, d.physics.gravity, -20, 20),
        pointer: ["repel", "attract", "off"].includes(ph.pointer) ? ph.pointer : d.physics.pointer, pointerStrength: num(ph.pointerStrength, d.physics.pointerStrength, 0, 20), collide: !!ph.collide },
      audio: { enabled: !!(s.audio && s.audio.enabled), gain: num(s.audio && s.audio.gain, 1, 0, 10) }, loop: s.loop !== false,
      timeline: (Array.isArray(s.timeline) && s.timeline.length ? s.timeline : d.timeline).slice(0, 64).map((st) => ({
        kind: STEP_KINDS.includes(st && st.kind) ? st.kind : "shape", value: str(st && st.value, "disc", st && st.kind === "svg" ? 20000 : 400),
        duration: num(st && st.duration, 1.5, 0.05, 30), hold: num(st && st.hold, 1, 0, 60), ease: typeof (st && st.ease) === "string" && /^[A-Za-z]{1,32}$/.test(st.ease) ? st.ease : "inOutCubic", stagger: num(st && st.stagger, 0.3, 0, 0.95), order: ORDERS.includes(st && st.order) ? st.order : "index",
      })),
    };
    return out;
  }
  const toJSON = (s) => JSON.stringify(normalizeScene(s), null, 2);
  const fromJSON = (t) => {
    if (typeof t !== "string" || t.length > MAX_JSON) throw new Error(`scene JSON must be a string under ${MAX_JSON} bytes`);
    const v = JSON.parse(t);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("scene JSON must be an object");
    return normalizeScene(v);
  };
  const b64e = (t) => (typeof Buffer !== "undefined" ? Buffer.from(t, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(t)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (t) => { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; return typeof Buffer !== "undefined" ? Buffer.from(t, "base64").toString("utf8") : decodeURIComponent(escape(atob(t))); };
  const toHash = (s) => "#scene=" + b64e(JSON.stringify(normalizeScene(s)));
  // Never throws: a malformed/oversized share link yields null so the caller falls back to the default scene.
  const fromHash = (h) => {
    if (typeof h !== "string" || h.length > MAX_HASH) return null;
    const m = /scene=([A-Za-z0-9_-]+)/.exec(h); if (!m) return null;
    try { return fromJSON(b64d(m[1])); } catch (_) { return null; }
  };
  function totalDuration(tl) { return tl.reduce((a, s) => a + s.duration + s.hold, 0); }
  // where are we in the timeline at time t (seconds)? -> {index, phase:'morph'|'hold', progress 0..1}
  function evalTimeline(tl, t, loop = true) {
    const T = totalDuration(tl); if (!tl.length || T <= 0) return { index: 0, phase: "hold", progress: 1 };
    if (loop) t = ((t % T) + T) % T; else if (t >= T) return { index: tl.length - 1, phase: "hold", progress: 1, done: true };
    let acc = 0;
    for (let i = 0; i < tl.length; i++) { const s = tl[i]; if (t < acc + s.duration) return { index: i, phase: "morph", progress: (t - acc) / s.duration }; acc += s.duration; if (t < acc + s.hold) return { index: i, phase: "hold", progress: s.hold ? (t - acc) / s.hold : 1 }; acc += s.hold; }
    return { index: tl.length - 1, phase: "hold", progress: 1 };
  }
  function snippet(s, libUrl = "forkbomb-dots.js") {
    const sc = normalizeScene(s), seq = sc.timeline.filter((x) => x.kind === "shape" || x.kind === "text").map((x) => ({ [x.kind]: x.value, duration: x.duration, hold: x.hold, ease: x.ease, stagger: x.stagger }));
    return `<!-- FORKBOMB Dots embed (MIT, zero deps) -->\n<canvas id="dots" style="width:100%;height:360px;background:${sc.bg}"></canvas>\n<script src="${libUrl}"></script>\n<script>\n  const dots = ForkbombDots.create("#dots", ${JSON.stringify({ count: Math.min(sc.count, 6000), size: sc.dotSize, colors: sc.palette, interactive: sc.physics.pointer !== "off" })});\n  dots.play(${JSON.stringify(seq)}, { loop: ${sc.loop} });\n</script>`;
  }
  const api = { MAX_JSON, MAX_HASH, ORDERS, PALETTES, COLOR_MODES, STEP_KINDS, DEFAULT, normalizeScene, toJSON, fromJSON, toHash, fromHash, evalTimeline, totalDuration, snippet };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DotsScene = api;
})(this);
