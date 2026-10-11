#!/usr/bin/env node
// FORKBOMB parts scanner: search GitHub for reusable bricks, score them, emit a candidate-list.
// Zero dependencies. Auth: `gh auth token` or GITHUB_TOKEN/GH_TOKEN. Without auth it falls back to repo search.
// Usage: node toolkit/scanner/scan.js "<query>" [--kind any|function|workflow|docker|schema|module]
//        [--lang js] [--limit 20] [--min-stars 0] [--json] [--out file] [--emit-entries dir] [--mode code|repo]
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const KINDS = {
  workflow: { q: "path:.github/workflows", category: "ci", re: /\.github\/workflows\/.+\.ya?ml$/i },
  docker: { q: "filename:Dockerfile", category: "infra", re: /(^|\/)Dockerfile[^/]*$|docker-compose\.ya?ml$/i },
  schema: { q: "extension:json \"$schema\"", category: "data", re: /schema.*\.json$|\.schema\.json$|\.proto$|\.graphql$/i },
  function: { q: "", category: "reliability", re: /\.(js|ts|mjs|py|go|rs|rb|java)$/i },
  module: { q: "", category: "other", re: /(^|\/)(lib|src|pkg|packages|utils?|toolkit)\//i },
};
const REPO_HINT = { workflow: "topic:github-actions", docker: "topic:docker", schema: "topic:json-schema", function: "", module: "" };
const LANG = { js: "javascript", ts: "typescript", py: "python", rb: "ruby", rs: "rust" };
const OK_LICENSES = /^(mit|apache-2\.0|bsd-[23]-clause|isc|mpl-2\.0|unlicense|0bsd|cc0-1\.0)$/i;
const CATS = ["reliability", "ci", "data", "ui", "agent", "infra", "auth", "commerce", "other"];

function parseArgs(argv) {
  const o = { query: [], kind: "any", limit: 20, minStars: 0, json: false, mode: "auto" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === "--lang") o.lang = v();
    else if (a === "--kind") o.kind = v();
    else if (a === "--limit") o.limit = Math.min(100, +v() || 20);
    else if (a === "--min-stars") o.minStars = +v() || 0;
    else if (a === "--json") o.json = true;
    else if (a === "--out") o.out = v();
    else if (a === "--emit-entries") o.emit = v();
    else if (a === "--mode") o.mode = v();
    else if (a === "-h" || a === "--help") o.help = true;
    else o.query.push(a);
  }
  o.query = o.query.join(" ").trim();
  return o;
}

function token() {
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try { return execFileSync("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null; }
  catch { return null; }
}

// Never let a credential reach stdout/stderr/files: scrub the token (and anything token-shaped) from every message.
let activeToken = null;
function redact(text) {
  let t = String(text);
  if (activeToken) t = t.split(activeToken).join("***");
  return t.replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "***").replace(/(authorization:?\s*(bearer|token)\s+)\S+/gi, "$1***");
}

const MAX_BODY = 20 * 1024 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long to wait before retrying a failed request, or -1 to give up. Handles GitHub primary rate limits
// (x-ratelimit-remaining: 0 + x-ratelimit-reset), secondary rate limits (403/429 + retry-after, or "secondary rate limit"
// in the message) and transient 5xx/network errors with exponential backoff. Waits are capped so CI never hangs.
function retryDelay({ status, headers = {}, message = "", attempt, now = Date.now(), maxWaitMs = 60e3 }) {
  if (attempt >= 4) return -1;
  const backoff = Math.min(maxWaitMs, 1000 * 2 ** attempt + Math.floor(Math.random() * 250));
  const ra = Number(headers["retry-after"]);
  if ((status === 403 || status === 429) && Number.isFinite(ra) && ra >= 0) return ra * 1000 <= maxWaitMs ? Math.max(1000, ra * 1000) : -1;
  if ((status === 403 || status === 429) && headers["x-ratelimit-remaining"] === "0") {
    const wait = Number(headers["x-ratelimit-reset"]) * 1000 - now + 1000;
    return Number.isFinite(wait) && wait <= maxWaitMs ? Math.max(1000, wait) : -1;
  }
  if ((status === 403 || status === 429) && /secondary rate limit|abuse/i.test(message)) return Math.max(backoff, 5000);
  if (status === 429) return backoff;
  if (status === undefined || status >= 500) return backoff; // network error / server error
  return -1; // 401, 404, 422, plain 403 (permissions) ... are not retryable
}

function request(p, tok) {
  return new Promise((resolve, reject) => {
    const headers = { "User-Agent": "forkbomb-scanner", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const req = https.get({ host: "api.github.com", path: p, headers, timeout: 20e3 }, (res) => {
      const chunks = []; let n = 0;
      res.on("data", (d) => { n += d.length; if (n > MAX_BODY) { req.destroy(new Error("response too large")); } else chunks.push(d); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
  });
}

const cache = new Map();
function api(p, tok, { send = request, wait = sleep } = {}) {
  if (cache.has(p)) return cache.get(p);
  const pr = (async () => {
    for (let attempt = 0; ; attempt++) {
      let res, netErr;
      try { res = await send(p, tok); } catch (e) { netErr = e; }
      let j = {};
      if (res) { try { j = JSON.parse(res.body); } catch { j = {}; } }
      if (res && res.status < 400) return j;
      const message = netErr ? netErr.message : (j && j.message) || "";
      const d = retryDelay({ status: res && res.status, headers: (res && res.headers) || {}, message, attempt });
      if (d >= 0) { progress(`retrying in ${Math.ceil(d / 1000)}s (${res ? res.status : "network"})`); await wait(d); continue; }
      if (netErr) throw new Error(redact(`network error on ${p.split("?")[0]}: ${netErr.message}`));
      const reset = res.headers["x-ratelimit-reset"];
      const limited = res.status === 429 || (res.status === 403 && (res.headers["x-ratelimit-remaining"] === "0" || /rate limit/i.test(message)));
      const hint = limited ? ` (rate limit; resets ${reset ? new Date(reset * 1000).toLocaleTimeString() : "soon"})` : "";
      throw new Error(redact(`GitHub ${res.status} on ${p.split("?")[0]}: ${message || res.body.slice(0, 120)}${hint}`));
    }
  })();
  pr.catch(() => cache.delete(p)); // don't cache failures
  cache.set(p, pr);
  return pr;
}

const tty = process.stderr.isTTY;
const c = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
function progress(msg) { if (tty) process.stderr.write(`\r\x1b[K${c(36, "›")} ${msg}`); }
function done() { if (tty) process.stderr.write("\r\x1b[K"); }

function buildQuery(o) {
  const parts = [o.query];
  if (o.kind !== "any" && KINDS[o.kind]) parts.push(o.mode === "repo" ? REPO_HINT[o.kind] : KINDS[o.kind].q);
  if (o.lang) parts.push(`language:${LANG[o.lang] || o.lang}`);
  return parts.filter(Boolean).join(" ");
}

function classify(p) {
  for (const k of ["workflow", "docker", "schema", "module", "function"]) if (KINDS[k].re.test(p)) return k;
  return "other";
}

function scoreCandidate(x) {
  const why = [];
  let s = 0;
  const lic = (x.license || "").toLowerCase();
  if (OK_LICENSES.test(lic)) { s += 30; why.push(`license ${x.license}`); }
  else if (lic && lic !== "noassertion" && lic !== "none") { s += 10; why.push(`license ${x.license} (check terms)`); }
  else why.push("no license (reference only)");
  const st = x.stars || 0;
  const starPts = Math.min(25, Math.round(Math.log10(st + 1) * 8)); s += starPts;
  if (st) why.push(`${st}★`);
  if (x.pushed_at) {
    const days = (Date.now() - Date.parse(x.pushed_at)) / 864e5;
    const r = days < 90 ? 20 : days < 365 ? 14 : days < 730 ? 6 : 0; s += r;
    why.push(`pushed ${Math.round(days)}d ago`);
  }
  if (x.path) {
    if (/(^|\/)(test|tests|__tests__|spec|examples?|fixtures?|vendor|node_modules|dist|build)\//i.test(x.path)) { s -= 15; why.push("test/vendor path"); }
    if (/(^|\/)(lib|src|pkg|packages|utils?|toolkit|\.github\/workflows)\//i.test(x.path)) { s += 8; why.push("reusable path"); }
    if (x.kind !== "other") s += 7;
  }
  if (x.size) {
    if (x.size >= 300 && x.size <= 15000) { s += 10; why.push("brick-sized"); }
    else if (x.size > 60000) { s -= 10; why.push("too large for one brick"); }
  }
  if (x.archived) { s -= 30; why.push("archived"); }
  if (x.fork) { s -= 10; why.push("fork"); }
  return { score: Math.max(0, Math.min(100, s)), why };
}

async function scan(o, tok) {
  activeToken = tok || null;
  const mode = o.mode === "auto" ? (tok ? "code" : "repo") : o.mode;
  if (mode === "code" && !tok) throw new Error("code search needs auth: run `gh auth login` or export GITHUB_TOKEN (or use --mode repo)");
  const q = buildQuery({ ...o, mode });
  const per = Math.min(100, Math.max(o.limit * 2, 10));
  progress(`searching ${mode}: ${q}`);
  const res = await api(`/search/${mode === "code" ? "code" : "repositories"}?q=${encodeURIComponent(q)}&per_page=${per}`, tok);
  const items = res.items || [];
  const out = [];
  let i = 0;
  for (const it of items) {
    i++;
    const repo = mode === "code" ? it.repository : it;
    progress(`enriching ${i}/${items.length} ${repo.full_name}`);
    let meta = repo;
    if (mode === "code") { try { meta = await api(`/repos/${repo.full_name}`, tok); } catch {} }
    const p = mode === "code" ? it.path : undefined;
    let size = mode === "code" ? undefined : undefined, commit = meta.default_branch;
    if (mode === "code") {
      const m = /[?&]ref=([0-9a-f]{40})/.exec(it.url || ""); if (m) commit = m[1];
      try { const f = await api(`/repos/${repo.full_name}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`, tok); size = f.size; } catch {}
    }
    const x = {
      url: meta.html_url || `https://github.com/${repo.full_name}`,
      repo: repo.full_name,
      path: p,
      commit,
      license: meta.license?.spdx_id || null,
      stars: meta.stargazers_count || 0,
      pushed_at: meta.pushed_at,
      archived: !!meta.archived,
      fork: !!meta.fork,
      size,
      kind: p ? classify(p) : "repo",
      job: (meta.description || it.name || "").slice(0, 160),
      html: it.html_url || meta.html_url,
    };
    if (x.stars < o.minStars) continue;
    Object.assign(x, scoreCandidate(x));
    out.push(x);
  }
  done();
  out.sort((a, b) => b.score - a.score);
  return { mode, q, total: res.total_count || 0, candidates: out.slice(0, o.limit) };
}

function toEntry(x) {
  const repo = String(x.repo || "unknown/unknown");
  const base = (x.path ? path.posix.basename(String(x.path)).replace(/\.[^.]+$/, "") : repo.split("/")[1] || "piece");
  const id = `${repo.split("/")[0]}-${base}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "piece";
  const category = { workflow: "ci", docker: "infra", schema: "data" }[x.kind] || "other";
  const e = {
    id, name: base, category: CATS.includes(category) ? category : "other",
    license: x.license || "UNKNOWN",
    source: { url: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(String(x.url)) ? x.url : `https://github.com/${repo.replace(/[^\w./-]/g, "")}`, ...(x.path && { path: x.path }), ...(x.commit && { commit: x.commit }) },
    seams: { inputs: [], outputs: [], events: [] },
    summary: x.job || `Candidate ${x.kind} brick from ${x.repo}`,
    snap: "TODO (tag stage): describe how to wire this piece in.",
    trust: { tests: false, maintained: !!x.pushed_at && Date.now() - Date.parse(x.pushed_at) < 365 * 864e5, security_reviewed: false },
  };
  return e;
}

// Write draft entries safely: ids are re-checked, every target must resolve inside dir, duplicate ids get a numeric
// suffix instead of overwriting each other, and files are written atomically via a temp file + rename.
function writeEntries(dir, entries) {
  fs.mkdirSync(dir, { recursive: true });
  const root = fs.realpathSync(dir), used = new Set(), written = [];
  for (const e of entries) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(e.id)) throw new Error(`refusing unsafe entry id ${JSON.stringify(e.id)}`);
    let id = e.id;
    for (let i = 2; used.has(id); i++) id = `${e.id.slice(0, 58)}-${i}`;
    used.add(id); e.id = id;
    const file = path.join(root, `${id}.json`);
    if (path.dirname(file) !== root) throw new Error(`refusing to write outside ${dir}`);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(e, null, 2) + "\n", { flag: "wx" });
    fs.renameSync(tmp, file);
    written.push(file);
  }
  return written;
}

const HELP = `forkbomb scan — find reusable GitHub bricks

  node toolkit/scanner/scan.js "<query>" [options]

  --kind <k>          any | function | workflow | docker | schema | module
  --lang <lang>       language filter (js, ts, py, go, rust, ...)
  --limit <n>         ranked results to keep (default 20, max 100)
  --min-stars <n>     drop candidates below n stars
  --mode <m>          code | repo  (default: code when authed, else repo)
  --json              print the candidate-list envelope as JSON
  --out <file>        also write the envelope to a file
  --emit-entries <d>  write draft piece entries (pieces/schema.json) into dir

  auth: gh auth login, or export GITHUB_TOKEN. Code search requires auth.
  examples:
    node toolkit/scanner/scan.js "retry backoff" --lang js --kind function
    node toolkit/scanner/scan.js "deploy" --kind workflow --limit 10
    node toolkit/scanner/scan.js "topic:github-actions stars:>500" --mode repo --json`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || (!o.query && o.kind === "any")) { console.log(HELP); process.exit(o.help ? 0 : 2); }
  if (o.kind !== "any" && !KINDS[o.kind]) { console.error(`unknown --kind ${o.kind}`); process.exit(2); }
  const tok = token();
  const r = await scan(o, tok);
  const env = {
    stage: "discover", piece: "discover-bricks", cycle: new Date().toISOString().slice(0, 10),
    outputs: { "candidate-list": r.candidates.map(({ html, ...x }) => x) },
    next: "tag",
    meta: { query: r.q, mode: r.mode, total_matches: r.total, scanned_at: new Date().toISOString() },
  };
  if (o.out) fs.writeFileSync(o.out, JSON.stringify(env, null, 2) + "\n");
  if (o.emit) writeEntries(o.emit, r.candidates.map(toEntry));
  if (o.json) return console.log(JSON.stringify(env, null, 2));
  console.log(c(1, `\n FORKBOMB scan`) + c(2, `  ${r.mode} search · "${r.q}" · ${r.total.toLocaleString()} matches · top ${r.candidates.length}\n`));
  r.candidates.forEach((x, i) => {
    const col = x.score >= 70 ? 32 : x.score >= 45 ? 33 : 31;
    const bar = "█".repeat(Math.round(x.score / 10)).padEnd(10, "░");
    console.log(` ${String(i + 1).padStart(2)}. ${c(col, bar)} ${c(1, String(x.score).padStart(3))}  ${c(36, x.kind.padEnd(8))} ${c(1, x.repo)}${x.path ? c(2, " › " + x.path) : ""}`);
    console.log(`     ${c(2, x.why.join(" · "))}`);
    if (x.html) console.log(`     ${c(4, x.html)}`);
  });
  if (!r.candidates.length) console.log("  no bricks found — broaden the query or drop --lang/--min-stars");
  if (!tok) console.log(c(33, "\n tip: gh auth login (or GITHUB_TOKEN) unlocks file-level code search + higher rate limits"));
  if (o.emit) console.log(c(32, `\n wrote ${r.candidates.length} draft entries → ${o.emit}`));
  if (o.out) console.log(c(32, ` candidate-list → ${o.out}`));
  console.log(c(2, `\n next: tag stage → node toolkit/process/cycle.js next discover`));
}

if (require.main === module) main().catch((e) => { done(); console.error(c(31, "scan failed: ") + redact(e.message)); process.exit(1); });
module.exports = { parseArgs, buildQuery, classify, scoreCandidate, toEntry, writeEntries, retryDelay, redact, api, _setToken: (t) => (activeToken = t) };
