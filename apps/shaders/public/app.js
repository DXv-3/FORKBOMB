// FORKBOMB Shaders playground: WebGL2 renderer, live editor, gallery, screenshots, URL-hash sharing.
(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("gl"), src = $("src"), log = $("log");
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) { log.textContent = "WebGL2 is not available in this browser."; return; }
  const { lib, presets } = await (await fetch("/api/library")).json();
  const VS = "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  let prog = null, uni = {}, t0 = performance.now(), paused = false, pausedAt = 0, mouse = [0, 0, 0, 0];

  function compile(type, code) {
    const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(s); gl.deleteShader(s); throw e; }
    return s;
  }
  // Map "ERROR: 0:LINE:" back to the file/line the user wrote (or the library file it came from).
  function mapErrors(text, map) {
    return String(text).replace(/(ERROR|WARNING): \d+:(\d+):/g, (all, kind, n) => {
      const m = map[Number(n) - 1]; return m ? `${kind}: ${m.file === "main" ? "line" : m.file + ":"} ${m.line}:` : all;
    });
  }
  function run() {
    let built;
    try { built = ShaderInclude.build(src.value, lib); } catch (e) { return fail(e.message); }
    try {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
      try { gl.attachShader(p, compile(gl.FRAGMENT_SHADER, built.code)); } catch (e) { return fail(mapErrors(e, built.map)); }
      gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return fail(gl.getProgramInfoLog(p));
      if (prog) gl.deleteProgram(prog);
      prog = p; uni = {}; for (const u of ["iTime", "iResolution", "iMouse"]) uni[u] = gl.getUniformLocation(p, u);
      log.className = "ok"; log.textContent = "Compiled OK.";
    } catch (e) { fail(String(e)); }
  }
  function fail(msg) { log.className = ""; log.textContent = msg; }

  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth * d | 0, h = canvas.clientHeight * d | 0;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  let frames = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!prog || paused) return;
    resize(); gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(prog);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uni.iTime, (now - t0) / 1000); gl.uniform3f(uni.iResolution, canvas.width, canvas.height, 1); gl.uniform4fv(uni.iMouse, mouse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++; if (now - last > 500) { $("fps").textContent = `${Math.round(frames * 1000 / (now - last))} fps`; frames = 0; last = now; }
  }
  const setMouse = (e, down) => { const r = canvas.getBoundingClientRect(), d = canvas.width / r.width;
    mouse[0] = (e.clientX - r.left) * d; mouse[1] = (r.bottom - e.clientY) * d; if (down !== undefined) mouse[2] = down ? 1 : 0; };
  canvas.addEventListener("pointerdown", (e) => setMouse(e, true));
  canvas.addEventListener("pointermove", (e) => { if (mouse[2]) setMouse(e); });
  window.addEventListener("pointerup", () => { mouse[2] = 0; });

  const enc = (s) => btoa(unescape(encodeURIComponent(s))), dec = (s) => decodeURIComponent(escape(atob(s)));
  function load(id) {
    const p = presets.find((x) => x.id === id) || presets[0];
    src.value = p.source; t0 = performance.now();
    document.querySelectorAll("#gallery button").forEach((b) => b.classList.toggle("on", b.dataset.id === p.id));
    run();
  }
  for (const p of presets) { const b = document.createElement("button"); b.textContent = p.id; b.title = p.title; b.dataset.id = p.id; b.onclick = () => { history.replaceState(null, "", "#p=" + p.id); load(p.id); }; $("gallery").append(b); }
  for (const name of Object.keys(lib)) if (name.endsWith(".glsl")) { const li = document.createElement("li"); li.innerHTML = `<a href="/lib/${name}" target="_blank">${name}</a>`; $("libs").append(li); }

  $("run").onclick = run;
  src.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
    if (e.key === "Tab") { e.preventDefault(); src.setRangeText("  ", src.selectionStart, src.selectionEnd, "end"); }
  });
  let timer; src.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 400); });
  $("pause").onclick = () => { paused = !paused; if (paused) pausedAt = performance.now(); else t0 += performance.now() - pausedAt; $("pause").textContent = paused ? "Play" : "Pause"; };
  $("shot").onclick = () => canvas.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "forkbomb-shader.png"; a.click(); });
  $("share").onclick = async () => { history.replaceState(null, "", "#s=" + enc(src.value)); try { await navigator.clipboard.writeText(location.href); log.textContent = "Share link copied to clipboard."; } catch { log.textContent = "Share link is in the address bar."; } };
  $("full").onclick = () => $("stage").requestFullscreen && $("stage").requestFullscreen();

  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("s")) { try { src.value = dec(h.get("s")); run(); } catch { load(); } } else load(h.get("p"));
  window.__forkbombShaders = { run, load, presets };
  requestAnimationFrame(frame);
})();
