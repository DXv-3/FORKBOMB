// FORKBOMB Dots Studio: app glue. Original MIT code. Shapes/text/SVG/image/UI targets, staggered eased morphs,
// physics (spring, gravity rain, pointer repel/attract, collisions-lite, explode/reform), palettes + dataset gradients,
// audio-reactive mode, PNG / WebM export, embed snippet, JSON save/load, share link, timeline sequence editor.
"use strict";
(function () {
  const Sh = window.DotsShapes, M = window.DotsMorph, Ph = window.DotsPhysics, Sc = window.DotsScene, U = window.DotsUI, R = window.DotsRender;
  const $ = (s) => document.querySelector(s), panel = $("#panel"), c2d = $("#c2d"), cgl = $("#cgl"), stage = $("#stage");
  const qs = new URLSearchParams(location.search);
  let scene = Sc.fromHash(location.hash) || Sc.DEFAULT();
  let sw = new Ph.Swarm(scene.count), rgb = new Uint8Array(scene.count * 3), imageColors = null, renderer = null;
  const ST = { view: "studio", playing: true, t: 0, idx: -1, morph: null, pointer: null, ui: null, uiDyn: false, audio: null, level: 0, rec: null, last: performance.now(), fps: 0 };
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  // ---------- targets ----------
  function pointsFor(step, n) {
    if (step.kind === "text") return Sh.textPoints(step.value || " ", n);
    if (step.kind === "svg") return Sh.svgPoints(step.value, n);
    if (step.kind === "image" && ST.image) { const r = Sh.imagePoints(ST.image, n); imageColors = r.colors; return r.points; }
    if (step.kind === "ui") { ST.ui = uiLayout(); return U.build(ST.ui, n).points; }
    return Sh.shape(step.value, n);
  }
  function morphTo(points, o = {}) {
    const from = sw.positions(), to = o.nomatch ? points : M.match(from, points);
    ST.morph = { from: o.fromTargets ? Float32Array.from({ length: sw.n * 2 }, (_, i) => (i % 2 ? sw.ty : sw.tx)[i >> 1]) : from, to, start: performance.now(), dur: (o.duration ?? 1.4) * 1000, ease: o.ease || "inOutCubic", stagger: o.stagger ?? 0.3, order: M.staggerOrder(to, o.order || "radial") };
    sw.reform();
  }
  function goStep(i) { const s = scene.timeline[i]; if (!s) return; ST.idx = i; ST.uiDyn = s.kind === "ui"; morphTo(pointsFor(s, sw.n), s); markStep(); }

  // ---------- UI controls in dots ----------
  const uiState = { slider: 0.4, toggle: true, check: true, progress: 0.65, pressed: false, dropdown: 0 };
  const DROP = ["Cloud", "Heart", "Star"];
  function uiLayout() {
    const p = (performance.now() / 1000) * 3;
    return [
      { type: "button", x: -0.45, y: -0.7, w: 0.8, h: 0.22, pressed: uiState.pressed, label: uiState.pressed ? "Done ✓" : "Make something" },
      { type: "slider", x: 0.5, y: -0.7, w: 0.8, value: uiState.slider, label: `slider ${(uiState.slider * 100) | 0}%` },
      { type: "toggle", x: -0.6, y: -0.2, value: uiState.toggle, label: uiState.toggle ? "on" : "off" },
      { type: "checkbox", x: -0.15, y: -0.2, value: uiState.check, label: "checkbox" },
      { type: "dropdown", x: 0.55, y: -0.2, w: 0.6, label: DROP[uiState.dropdown] + "  (click)" },
      { type: "progress", x: -0.1, y: 0.3, w: 1.4, value: uiState.progress, label: `progress ${(uiState.progress * 100) | 0}%` },
      { type: "spinner", x: -0.5, y: 0.72, phase: p, label: "spinner" },
      { type: "loader", x: 0.45, y: 0.72, phase: p, label: "loader" },
    ];
  }
  function uiClick(x, y) {
    const L = uiLayout(), i = U.hitTest(L, x, y); if (i < 0) return false; const c = L[i];
    if (c.type === "button") { uiState.pressed = !uiState.pressed; if (uiState.pressed) sw.explode(c.x, c.y, 0.6); }
    if (c.type === "slider") uiState.slider = Math.min(1, Math.max(0, (x - (c.x - c.w / 2)) / c.w));
    if (c.type === "toggle") uiState.toggle = !uiState.toggle; if (c.type === "checkbox") uiState.check = !uiState.check;
    if (c.type === "dropdown") uiState.dropdown = (uiState.dropdown + 1) % DROP.length; if (c.type === "progress") uiState.progress = Math.min(1, Math.max(0, (x - (c.x - c.w / 2)) / c.w));
    return true;
  }
  function uiLabels(L) {
    const box = $("#uiLabels"); if (!L) { box.innerHTML = ""; return; } const w = stage.clientWidth, h = stage.clientHeight, s = Math.min(w, h) * 0.45;
    box.innerHTML = L.map((c) => `<span style="left:${w / 2 + c.x * s}px;top:${h / 2 + (c.y + (c.type === "button" || c.type === "dropdown" ? 0 : 0.13)) * s}px">${c.label}</span>`).join("");
  }

  // ---------- renderer ----------
  function setRenderer(kind) {
    scene.renderer = kind; c2d.style.display = kind === "canvas" ? "" : "none"; cgl.style.display = kind === "webgl" ? "" : "none";
    try { renderer = kind === "webgl" ? (ST.gl = ST.gl || new R.WebGLRenderer(cgl)) : (ST.c = ST.c || new R.Canvas2DRenderer(c2d)); } catch (e) { if (kind === "canvas") throw e; log("WebGL2 unavailable, using canvas2D"); setRenderer("canvas"); }
  }
  const canvasEl = () => (scene.renderer === "webgl" ? cgl : c2d);
  function setCount(n) { scene.count = n; sw.resize(n); rgb = new Uint8Array(n * 3); imageColors = null; if (ST.idx >= 0) goStep(ST.idx); }

  // ---------- pointer ----------
  const toN = (e) => { const r = stage.getBoundingClientRect(), s = Math.min(r.width, r.height) * 0.45; return [(e.clientX - r.left - r.width / 2) / s, (e.clientY - r.top - r.height / 2) / s]; };
  stage.addEventListener("pointermove", (e) => { const [x, y] = toN(e); ST.pointer = { x, y }; });
  stage.addEventListener("pointerleave", () => (ST.pointer = null));
  stage.addEventListener("click", (e) => { const [x, y] = toN(e); if (ST.uiDyn && uiClick(x, y)) return; sw.explode(x, y, 0.8); });

  // ---------- audio ----------
  async function startAudio(file) {
    const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(); an.fftSize = 256; let src;
    if (file) { const a = new Audio(URL.createObjectURL(file)); a.loop = true; await a.play(); src = ac.createMediaElementSource(a); src.connect(ac.destination); }
    else src = ac.createMediaStreamSource(await navigator.mediaDevices.getUserMedia({ audio: true }));
    src.connect(an); ST.audio = { an, buf: new Uint8Array(an.frequencyBinCount), ac }; scene.audio.enabled = true;
  }

  // ---------- frame ----------
  function frame(now) {
    const dt = Math.min(0.033, (now - ST.last) / 1000); ST.last = now; ST.fps = ST.fps * 0.9 + (1 / Math.max(dt, 1e-3)) * 0.1;
    const cv = canvasEl(), w = (stage.clientWidth * DPR) | 0, h = (stage.clientHeight * DPR) | 0; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    if (ST.playing && ST.view === "studio") { ST.t += dt; const e = Sc.evalTimeline(scene.timeline, ST.t, scene.loop); if (e.index !== ST.idx) goStep(e.index); syncScrub(); }
    if (ST.uiDyn) { const L = uiLayout(); sw.setTargets(U.build(L, sw.n).points); ST.morph = null; uiLabels(L); } else uiLabels(null);
    if (ST.morph) { const m = ST.morph, t = Math.min(1, (now - m.start) / m.dur); ST.base = M.interpolate(m.from, m.to, t, ST.base && ST.base.length === m.to.length ? ST.base : null, { ease: m.ease, stagger: m.stagger, order: m.order }); sw.setTargets(ST.base); if (t >= 1) ST.morph = null; }
    // audio
    if (ST.audio) { ST.audio.an.getByteFrequencyData(ST.audio.buf); let s = 0; for (const v of ST.audio.buf) s += v; ST.level = (s / ST.audio.buf.length / 255) * scene.audio.gain; const b = ST.audio.buf, L = b.length; for (let i = 0; i < sw.n; i++) sw.size[i] = 1 + (b[i % L] / 255) * 1.8 * scene.audio.gain; }
    const ph = scene.physics, P = ST.pointer && ph.pointer !== "off" ? { x: ST.pointer.x, y: ST.pointer.y, r: 0.35, strength: (ph.pointer === "attract" ? -1 : 1) * ph.pointerStrength * (1 + ST.level * 4) } : null;
    if (ST.settle) { ST.settle = false; if (ST.morph) { sw.setTargets(ST.morph.to); ST.morph = null; } for (let k = 0; k < 400; k++) sw.step(1 / 60, { spring: ph.spring, damping: ph.damping }); }
    sw.step(dt, { spring: ph.spring, damping: ph.damping, gravity: ph.gravity, floor: 1.05, wall: 1.9, pointer: P, collide: ph.collide && sw.n <= 6000, radius: 0.012 });
    R.colorize(rgb, sw, scene.colorMode, scene.palette, imageColors);
    renderer.draw(sw, rgb, { bg: scene.bg, dotSize: scene.dotSize * (sw.n > 4000 ? 0.7 : 1), dpr: DPR });
    $("#fps").textContent = `${sw.n} dots · ${scene.renderer} · ${ST.fps.toFixed(0)} fps`;
    requestAnimationFrame(frame);
  }

  // ---------- panel ----------
  const h3 = (t) => panel.insertAdjacentHTML("beforeend", `<h3>${t}</h3>`);
  function el(html, on) { const d = document.createElement("div"); d.innerHTML = html; const e = d.firstElementChild; panel.append(e); if (on) on(e); return e; }
  const btns = (list) => { const r = el(`<div class="row"></div>`); for (const [t, f] of list) { const b = document.createElement("button"); b.textContent = t; b.onclick = f; r.append(b); } return r; };
  const range = (label, get, set, min, max, step) => el(`<label>${label}<input type=range min=${min} max=${max} step=${step} value=${get()}></label>`, (e) => (e.querySelector("input").oninput = (ev) => set(+ev.target.value)));
  const MAX_IMAGE = 16 << 20, MAX_AUDIO = 64 << 20;
  const escAttr = (v) => String(v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function log(t) { $("#out").textContent = t; console.log(t); }
  const download = (name, href) => { const a = document.createElement("a"); a.download = name; a.href = href; a.click(); };
  const copy = (t) => { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); log(t); };
  const live = (step) => { scene.timeline.push(step); renderSteps(); ST.playing = false; goStep(scene.timeline.length - 1); };
  function buildPanel() {
    panel.innerHTML = "";
    h3(`Shapes (${Sh.NAMES.length})`);
    const cats = Sh.categories();
    el(`<select id="shapeSel">${Object.entries(cats).map(([c, l]) => `<optgroup label="${c}">${l.map((n) => `<option>${n}</option>`).join("")}</optgroup>`).join("")}</select>`, (e) => (e.onchange = () => { ST.playing = false; ST.uiDyn = false; morphTo(Sh.shape(e.value, sw.n), { ease: $("#easeSel").value, stagger: +$("#stagSel").value, order: $("#ordSel").value }); }));
    el(`<label>ease<select id="easeSel">${Object.keys(M.EASE).map((k) => `<option ${k === "inOutCubic" ? "selected" : ""}>${k}</option>`).join("")}</select></label>`);
    el(`<label>stagger<input id="stagSel" type=range min=0 max=0.9 step=0.05 value=0.35></label>`);
    el(`<label>order<select id="ordSel">${["radial", "angle", "x", "y", "index", "random"].map((k) => `<option>${k}</option>`).join("")}</select></label>`);
    btns([["+ add to timeline", () => live({ kind: "shape", value: $("#shapeSel").value, duration: 1.5, hold: 1.2, ease: $("#easeSel").value, stagger: +$("#stagSel").value, order: $("#ordSel").value })]]);
    h3("Text → particles");
    el(`<input id="txt" value="FORKBOMB" maxlength="60">`);
    btns([["Form text", () => { ST.playing = false; ST.uiDyn = false; morphTo(Sh.textPoints($("#txt").value, sw.n), { order: "x", ease: "outExpo" }); }],
          ["Explode + reassemble", () => { sw.explode(0, 0, 3); setTimeout(() => morphTo(Sh.textPoints($("#txt").value, sw.n), { order: "random", stagger: 0.6, duration: 1.8, ease: "outBack" }), 450); }],
          ["+ timeline", () => live({ kind: "text", value: $("#txt").value, duration: 1.8, hold: 1.5, ease: "outExpo", stagger: 0.4, order: "x" })]]);
    h3("SVG icon (paste your own)");
    el(`<textarea id="svg" placeholder='<svg viewBox="0 0 24 24"><path d="..."/></svg> or a path d'>M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z</textarea>`);
    btns([["Form SVG", () => { ST.playing = false; ST.uiDyn = false; morphTo(Sh.svgPoints($("#svg").value, sw.n)); }], ["+ timeline", () => live({ kind: "svg", value: $("#svg").value, duration: 1.5, hold: 1.2, ease: "inOutCubic", stagger: 0.3, order: "radial" })]]);
    h3("Image → dots");
    el(`<input type=file accept="image/*">`, (e) => (e.onchange = () => { const f = e.files[0]; if (!f) return; if (!/^image\//.test(f.type) || f.size > MAX_IMAGE) return log(`image rejected: must be an image under ${MAX_IMAGE >> 20} MB`); const img = new Image(), url = URL.createObjectURL(f); img.onerror = () => { URL.revokeObjectURL(url); log("image could not be decoded"); }; img.onload = () => { URL.revokeObjectURL(url); if (img.width * img.height > 40e6) return log("image rejected: too many pixels"); ST.image = img; ST.playing = false; ST.uiDyn = false; const r = Sh.imagePoints(img, sw.n); imageColors = r.colors; scene.colorMode = "image"; buildPanel(); morphTo(r.points, { order: "random", stagger: 0.5 }); }; img.src = url; }));
    h3("Physics");
    btns([["Explode", () => sw.explode(0, 0, 2.5)], ["Rain", () => { sw.release(); for (let i = 0; i < sw.n; i++) sw.vy[i] = -Math.random() * 0.5; }], ["Reform", () => sw.reform()], ["Dot UI", () => { ST.playing = false; ST.uiDyn = true; }]]);
    range("spring", () => scene.physics.spring, (v) => (scene.physics.spring = v), 5, 200, 1);
    range("gravity", () => scene.physics.gravity, (v) => (scene.physics.gravity = v), -6, 12, 0.1);
    range("pointer force", () => scene.physics.pointerStrength, (v) => (scene.physics.pointerStrength = v), 0, 8, 0.1);
    el(`<label>pointer<select>${["repel", "attract", "off"].map((k) => `<option ${k === scene.physics.pointer ? "selected" : ""}>${k}</option>`).join("")}</select></label>`, (e) => (e.querySelector("select").onchange = (ev) => (scene.physics.pointer = ev.target.value)));
    el(`<label>collisions-lite<input type=checkbox ${scene.physics.collide ? "checked" : ""}></label>`, (e) => (e.querySelector("input").onchange = (ev) => (scene.physics.collide = ev.target.checked)));
    h3("Dots & rendering");
    range("count", () => scene.count, (v) => setCount(v), 100, 10000, 100);
    range("dot size", () => scene.dotSize, (v) => (scene.dotSize = v), 0.4, 6, 0.1);
    el(`<label>renderer<select>${["canvas", "webgl"].map((k) => `<option ${k === scene.renderer ? "selected" : ""}>${k}</option>`).join("")}</select></label>`, (e) => (e.querySelector("select").onchange = (ev) => setRenderer(ev.target.value)));
    h3("Color");
    el(`<label>mode<select>${Sc.COLOR_MODES.map((k) => `<option ${k === scene.colorMode ? "selected" : ""}>${k}</option>`).join("")}</select></label>`, (e) => (e.querySelector("select").onchange = (ev) => (scene.colorMode = ev.target.value)));
    btns(Object.entries(Sc.PALETTES).map(([k, p]) => [k, () => (scene.palette = p.slice())]));
    el(`<select id="gradSel"><option>gradient from dataset…</option></select>`, (e) => { fetch("/api/gradients").then((r) => r.json()).then((d) => { e.innerHTML += d.gradients.map((g) => `<option value="${escAttr(g.stops.map((s) => s.color).join(","))}">${escAttr(g.name)}</option>`).join(""); }).catch(() => {}); e.onchange = () => { if (e.value.startsWith("#")) scene.palette = e.value.split(","); }; });
    h3("Audio-reactive (optional)");
    btns([["Mic", () => startAudio().catch((e) => log("audio: " + e.message))]]);
    el(`<input type=file accept="audio/*">`, (e) => (e.onchange = () => e.files[0] && (e.files[0].size > MAX_AUDIO ? Promise.reject(new Error(`file over ${MAX_AUDIO >> 20} MB`)) : startAudio(e.files[0])).catch((x) => log("audio: " + x.message))));
    h3("Export");
    btns([["PNG", () => download("forkbomb-dots.png", canvasEl().toDataURL("image/png"))], ["Record WebM", (ev) => record(ev.target)], ["Copy embed", () => copy(Sc.snippet(scene, location.origin + "/dots/forkbomb-dots.js"))]]);
    btns([["Save JSON", () => download("dots-scene.json", "data:application/json," + encodeURIComponent(Sc.toJSON(scene)))], ["Share link", () => { location.hash = Sc.toHash(scene); copy(location.href); }]]);
    el(`<label>Load JSON<input type=file accept="application/json,.json"></label>`, (e) => (e.querySelector("input").onchange = async (ev) => { const f = ev.target.files[0]; if (!f) return; if (f.size > Sc.MAX_JSON) return log(`scene rejected: over ${Sc.MAX_JSON >> 10} KB`); try { load(Sc.fromJSON(await f.text())); } catch (x) { log("scene rejected: " + x.message); } }));
  }
  function record(btn) {
    if (ST.rec) { ST.rec.stop(); return; }
    if (!window.MediaRecorder) return log("MediaRecorder unsupported");
    const chunks = [], mr = new MediaRecorder(canvasEl().captureStream(60), { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data); mr.onstop = () => { ST.rec = null; btn.textContent = "Record WebM"; download("forkbomb-dots.webm", URL.createObjectURL(new Blob(chunks, { type: "video/webm" }))); };
    mr.start(); ST.rec = mr; btn.textContent = "■ Stop"; setTimeout(() => ST.rec === mr && mr.stop(), 15000);
  }
  function load(s) { scene = s; setCount(s.count); setRenderer(s.renderer); ST.t = 0; ST.idx = -1; ST.playing = true; buildPanel(); renderSteps(); }

  // ---------- timeline editor ----------
  const stepsEl = $("#steps");
  function renderSteps() {
    stepsEl.innerHTML = "";
    scene.timeline.forEach((s, i) => {
      const d = document.createElement("div"); d.className = "step" + (i === ST.idx ? " on" : "");
      const valueInput = s.kind === "shape" ? `<select data-k="value">${Sh.NAMES.map((n) => `<option ${n === s.value ? "selected" : ""}>${n}</option>`).join("")}</select>` : `<input data-k="value" value="${escAttr(String(s.value).slice(0, 200))}">`;
      d.innerHTML = `<b>#${i + 1}</b><select data-k="kind">${Sc.STEP_KINDS.map((k) => `<option ${k === s.kind ? "selected" : ""}>${k}</option>`).join("")}</select>${valueInput}
        <select data-k="ease">${Object.keys(M.EASE).map((k) => `<option ${k === s.ease ? "selected" : ""}>${k}</option>`).join("")}</select>
        <label>dur<input data-k="duration" type=number step=0.1 value=${s.duration}></label><label>hold<input data-k="hold" type=number step=0.1 value=${s.hold}></label>
        <label>stag<input data-k="stagger" type=number step=0.05 min=0 max=0.95 value=${s.stagger}></label><select data-k="order">${["radial", "angle", "x", "y", "index", "random"].map((k) => `<option ${k === s.order ? "selected" : ""}>${k}</option>`).join("")}</select>
        <span class="row"><button data-a="go">▸</button><button data-a="up">←</button><button data-a="down">→</button><button data-a="del">✕</button></span>`;
      d.querySelectorAll("[data-k]").forEach((inp) => (inp.onchange = () => { const k = inp.dataset.k; s[k] = inp.type === "number" ? +inp.value : inp.value; if (k === "kind") s.value = s.kind === "shape" ? "disc" : s.kind === "text" ? "HELLO" : s.value; scene = Sc.normalizeScene(scene); renderSteps(); goStep(i); }));
      d.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => { const a = b.dataset.a, tl = scene.timeline;
        if (a === "go") { ST.playing = false; ST.t = tl.slice(0, i).reduce((x, y) => x + y.duration + y.hold, 0); goStep(i); }
        if (a === "up" && i > 0) [tl[i - 1], tl[i]] = [tl[i], tl[i - 1]]; if (a === "down" && i < tl.length - 1) [tl[i + 1], tl[i]] = [tl[i], tl[i + 1]];
        if (a === "del" && tl.length > 1) tl.splice(i, 1); renderSteps(); }));
      stepsEl.append(d);
    });
  }
  function markStep() { stepsEl.querySelectorAll(".step").forEach((d, i) => d.classList.toggle("on", i === ST.idx)); }
  function syncScrub() { const T = Sc.totalDuration(scene.timeline); $("#scrub").value = T ? (((ST.t % T) / T) * 1000) | 0 : 0; $("#tltime").textContent = `${(ST.t % T).toFixed(1)} / ${T.toFixed(1)}s`; }
  $("#play").onclick = () => { ST.playing = !ST.playing; ST.uiDyn = false; $("#play").textContent = ST.playing ? "❚❚ Pause" : "▶ Play"; };
  $("#scrub").oninput = (e) => { ST.playing = false; ST.uiDyn = false; ST.t = (e.target.value / 1000) * Sc.totalDuration(scene.timeline); const ev = Sc.evalTimeline(scene.timeline, ST.t); if (ev.index !== ST.idx) goStep(ev.index); syncScrub(); };
  $("#addStep").onclick = () => live({ kind: "shape", value: Sh.NAMES[(Math.random() * Sh.NAMES.length) | 0], duration: 1.5, hold: 1.2, ease: "inOutCubic", stagger: 0.3, order: "radial" });

  // ---------- shape grid view ----------
  function buildGrid() {
    const g = $("#gridView"); if (g.childElementCount) return; const pal = R.rampSampler(scene.palette);
    for (const name of Sh.NAMES) {
      const f = document.createElement("figure"), cv = document.createElement("canvas"); cv.width = cv.height = 120; const x = cv.getContext("2d"), p = Sh.shape(name, 600);
      x.fillStyle = "#0d0d16"; x.fillRect(0, 0, 120, 120);
      for (let i = 0; i < 600; i++) { const c = pal((p[2 * i + 1] + 1) / 2); x.fillStyle = `rgb(${c.map(Math.round)})`; x.fillRect(60 + p[2 * i] * 52 - 1, 60 + p[2 * i + 1] * 52 - 1, 2, 2); }
      f.append(cv); f.insertAdjacentHTML("beforeend", `<figcaption>${name}</figcaption>`); f.onclick = () => { setView("studio"); ST.playing = false; morphTo(Sh.shape(name, sw.n)); }; g.append(f);
    }
  }
  function setView(v) {
    ST.view = v; document.querySelectorAll("#views button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
    $("#gridView").style.display = v === "grid" ? "grid" : "none"; if (v === "grid") buildGrid();
    if (v === "ui") { ST.playing = false; ST.uiDyn = true; } else if (v === "studio") ST.uiDyn = false;
  }
  document.querySelectorAll("#views button").forEach((b) => (b.onclick = () => setView(b.dataset.view)));

  // ---------- boot ----------
  setRenderer(qs.get("renderer") === "webgl" ? "webgl" : scene.renderer); buildPanel(); renderSteps();
  if (qs.get("count")) setCount(+qs.get("count"));
  if (qs.get("text")) { ST.playing = false; $("#txt").value = qs.get("text"); morphTo(Sh.textPoints(qs.get("text"), sw.n), { order: "x", duration: 0.6 }); }
  if (qs.get("shape")) { ST.playing = false; morphTo(Sh.shape(qs.get("shape"), sw.n), { duration: 0.6 }); }
  setView(qs.get("view") || "studio"); ST.settle = qs.has("settle"); // ?settle: pre-converge (headless screenshots)
  requestAnimationFrame(frame);
  window.DotsStudio = { scene: () => scene, swarm: () => sw, goStep, load };
})();
