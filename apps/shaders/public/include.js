// FORKBOMB shaders: #include "file.glsl" preprocessor. Works in Node (require) and the browser (window.ShaderInclude).
// resolve(source, lib) -> { code, map }  where lib is { "name.glsl": "source" } and map[i] = { file, line } for output line i+1.
// Includes are recursive and include-once; cycles and missing files throw.
(function (root) {
  "use strict";
  const RE = /^\s*#\s*include\s+["<]([^">]+)[">]\s*$/;
  function resolve(source, lib, entryName) {
    const out = [], map = [], seen = new Set(), stack = [];
    (function walk(src, file) {
      if (stack.includes(file)) throw new Error(`include cycle: ${stack.concat(file).join(" -> ")}`);
      stack.push(file);
      src.split("\n").forEach((text, i) => {
        const m = text.match(RE);
        if (!m) { out.push(text); map.push({ file, line: i + 1 }); return; }
        const name = m[1];
        if (!(name in lib)) throw new Error(`${file}:${i + 1}: unknown include "${name}"`);
        if (stack.includes(name)) throw new Error(`include cycle: ${stack.concat(name).join(" -> ")}`);
        if (seen.has(name)) return;
        seen.add(name);
        walk(lib[name], name);
      });
      stack.pop();
    })(source, entryName || "main");
    return { code: out.join("\n"), map };
  }
  function includesOf(source) {
    return source.split("\n").map((l) => l.match(RE)).filter(Boolean).map((m) => m[1]);
  }
  const PRELUDE = "#version 300 es\nprecision highp float;\nuniform float iTime;\nuniform vec3 iResolution;\nuniform vec4 iMouse;\nout vec4 forkbombFragColor;\n";
  const EPILOGUE = "\nvoid main() { mainImage(forkbombFragColor, gl_FragCoord.xy); }\n";
  // Full WebGL2 fragment shader; map is offset by the prelude so driver line numbers map back to user lines.
  function build(source, lib) {
    const r = resolve(source, lib);
    const pre = PRELUDE.split("\n").length - 1;
    const map = Array(pre).fill({ file: "prelude", line: 0 }).concat(r.map);
    return { code: PRELUDE + r.code + EPILOGUE, map };
  }
  // Rough syntax sanity, no GL required: balanced (){} [] and a mainImage entry point.
  function lint(code) {
    const errs = [], pairs = { ")": "(", "]": "[", "}": "{" }, st = [];
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const ch of clean) {
      if ("([{".includes(ch)) st.push(ch);
      else if (ch in pairs) { if (st.pop() !== pairs[ch]) { errs.push(`unbalanced "${ch}"`); break; } }
    }
    if (!errs.length && st.length) errs.push(`unclosed "${st[st.length - 1]}"`);
    if (!/void\s+mainImage\s*\(/.test(clean)) errs.push("missing mainImage()");
    return errs;
  }
  const api = { resolve, includesOf, build, lint, PRELUDE, EPILOGUE };
  if (typeof module === "object" && module.exports) module.exports = api; else root.ShaderInclude = api;
})(typeof window !== "undefined" ? window : globalThis);
