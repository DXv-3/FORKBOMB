// HTML views. Everything user-supplied goes through esc(); highlighting by Prism (MIT) from jsDelivr.
"use strict";
const PRISM = "https://cdn.jsdelivr.net/npm/prismjs@1.29.0";
const LANGS = ["plaintext","javascript","typescript","python","go","rust","java","c","cpp","csharp","ruby","php","bash","json","yaml","markdown","sql","html","css","diff"];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeLang = (l) => (LANGS.includes(l) ? l : "plaintext");
const prismLang = (l) => ({ html: "markup", plaintext: "none" }[l] || l);

const CSS = `:root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--fg:#e6edf3;--mut:#8b949e;--acc:#ff5f1f}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg)}
header{display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid var(--line)}
header a{color:var(--fg);text-decoration:none;font-weight:700}header .b{color:var(--acc)}header small{color:var(--mut)}
main{max-width:980px;margin:24px auto;padding:0 20px}
textarea,input,select{width:100%;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit}
textarea{min-height:360px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}
.row{display:flex;gap:12px;margin:12px 0}.row>*{flex:1}
button,.btn{background:var(--acc);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--fg)}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px;color:var(--mut)}.meta .sp{flex:1}
pre[class*=language-]{border-radius:8px;border:1px solid var(--line);margin:0;max-height:75vh}
footer{text-align:center;color:var(--mut);padding:30px;font-size:13px}footer a{color:var(--mut)}`;

const page = (title, body, head = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · FORKBOMB Paste</title>
<style>${CSS}</style>${head}</head><body>
<header><a href="/"><span class="b">FORKBOMB</span> Paste</a><small>assembled from parts found across GitHub</small></header>
<main>${body}</main>
<footer>Built from GitHub parts: <a href="https://github.com/PrismJS/prism">Prism</a> · <a href="https://github.com/ai/nanoid">nanoid</a> · <a href="https://github.com/DXv-3/FORKBOMB">FORKBOMB</a></footer></body></html>`;

function home(maxBytes) {
  const opts = LANGS.map((l) => `<option value="${l}">${l}</option>`).join("");
  return page("New paste", `<form method="post" action="/new">
<input name="title" maxlength="120" placeholder="Title (optional)">
<div class="row"><textarea name="content" required placeholder="Paste anything. Up to ${Math.round(maxBytes / 1024)} KB."></textarea></div>
<div class="row"><select name="language">${opts}</select>
<select name="expiry"><option value="never">Never expires</option><option value="10m">10 minutes</option><option value="1h">1 hour</option><option value="1d">1 day</option><option value="1w">1 week</option></select>
<button type="submit">Create paste</button></div></form>`);
}

function view(p) {
  const lang = safeLang(p.language);
  const head = `<link rel="stylesheet" href="${PRISM}/themes/prism-tomorrow.min.css">`;
  const body = `<div class="meta"><strong>${esc(p.title || "Untitled")}</strong><span>${esc(lang)}</span>
<span>${esc(p.createdAt)}</span>${p.expiresAt ? `<span>expires ${esc(p.expiresAt)}</span>` : ""}<span class="sp"></span>
<button id="copy" class="btn ghost" type="button">Copy</button><button id="link" class="btn ghost" type="button">Copy link</button>
<a class="btn ghost" href="/raw/${esc(p.id)}">Raw</a><a class="btn" href="/">New</a></div>
<pre><code id="code" class="language-${esc(prismLang(lang))}">${esc(p.content)}</code></pre>
<script src="${PRISM}/components/prism-core.min.js"></script>
<script src="${PRISM}/plugins/autoloader/prism-autoloader.min.js"></script>
<script>
const flash=(b,t)=>{const o=b.textContent;b.textContent=t;setTimeout(()=>b.textContent=o,1200)};
const cp=(b,s)=>navigator.clipboard.writeText(s).then(()=>flash(b,"Copied!"),()=>flash(b,"Failed"));
document.getElementById("copy").onclick=e=>cp(e.target,document.getElementById("code").textContent);
document.getElementById("link").onclick=e=>cp(e.target,location.href);
</script>`;
  return page(p.title || "Paste " + p.id, body, head);
}
const notFound = () => page("Not found", `<h2>Paste not found</h2><p>It may have expired. <a class="btn" href="/">Make a new one</a></p>`);
module.exports = { esc, home, view, notFound, safeLang, LANGS };
