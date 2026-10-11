#!/usr/bin/env node
// FORKBOMB run-cycle piece: walks the forkbomb-core pack and validates the system on itself.
// Usage: node toolkit/process/cycle.js [validate|next <stage>|checklist|check <entry.json|dir>]
// Zero dependencies. Exit code 1 on any invalid snap (connectors fail loud).
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..", "..");
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p), "utf8"));
const exists = (p) => fs.existsSync(path.join(root, p));

const schema = read("pieces/schema.json");
const errors = [];
const err = (m) => errors.push(m);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const SELF_REPO = /^https?:\/\/github\.com\/DXv-3\/FORKBOMB(\.git)?(\/.*)?$/i;

function validatePiece(file) {
  let e;
  try { e = read(file); } catch (x) { return err(`${file}: invalid JSON (${x.message})`); }
  if (!isObj(e)) return err(`${file}: entry must be a JSON object`);
  for (const k of schema.required) if (!(k in e)) err(`${file}: missing "${k}"`);
  if ("category" in e && typeof e.category !== "string") err(`${file}: "category" must be a string`);
  if ("source" in e && !isObj(e.source)) { err(`${file}: source must be an object`); e.source = null; }
  if (e.source) for (const k of ["url", "path", "commit"]) if (k in e.source && typeof e.source[k] !== "string") err(`${file}: source.${k} must be a string`);
  if ("trust" in e && !isObj(e.trust)) { err(`${file}: trust must be an object`); e.trust = null; }
  if (e.id && !/^[a-z0-9-]+$/.test(e.id)) err(`${file}: id must be kebab-case`);
  if (e.id && path.basename(file, ".json") !== e.id) err(`${file}: filename must match id`);
  const cats = schema.properties.category.enum;
  if (e.category && !cats.includes(e.category)) err(`${file}: category "${e.category}" not in ${cats.join(",")}`);
  if (e.source && !e.source.url) err(`${file}: source.url required`);
  if (e.source && typeof e.source.url === "string" && !/^https?:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/.test(e.source.url)) err(`${file}: source.url must be an http(s) URI`);
  for (const k of ["id", "name", "license", "summary", "snap"]) if (k in e && typeof e[k] !== "string") err(`${file}: "${k}" must be a string`);
  if ("seams" in e) {
    if (!isObj(e.seams)) err(`${file}: seams must be an object`);
    else for (const k of ["inputs", "outputs", "events"]) if (k in e.seams && !(Array.isArray(e.seams[k]) && e.seams[k].every((x) => typeof x === "string"))) err(`${file}: seams.${k} must be a string array`);
  }
  if (e.trust) for (const [k, v] of Object.entries(e.trust)) if (typeof v !== "boolean") err(`${file}: trust.${k} must be boolean`);
  // source.path is a repo-relative path: never absolute, never escaping with "..".
  if (e.source && typeof e.source.path === "string" && (path.isAbsolute(e.source.path) || e.source.path.split(/[\\/]/).includes("..")))
    err(`${file}: source.path must be repo-relative without ".."`);
  // Pieces sourced from this repo (any URL form: bare, .git, /tree/<ref>/...) must point at a file that exists.
  else if (e.source && SELF_REPO.test(e.source.url || "") && typeof e.source.path === "string" && !exists(e.source.path))
    err(`${file}: source.path ${e.source.path} does not exist in this repo`);
  return e;
}

let entryFiles = 0;
function loadPieces() {
  const dir = "pieces/entries";
  const map = {};
  const all = fs.readdirSync(path.join(root, dir));
  for (const f of all) if (!f.endsWith(".json") && !f.startsWith(".")) err(`${dir}/${f}: not a .json entry (would be silently skipped)`);
  for (const f of all.filter((f) => f.endsWith(".json"))) {
    entryFiles++;
    const e = validatePiece(`${dir}/${f}`);
    if (!e || typeof e.id !== "string") continue;
    if (Object.prototype.hasOwnProperty.call(map, e.id)) err(`${dir}/${f}: duplicate id "${e.id}"`);
    map[e.id] = e;
  }
  return map;
}

function validatePacks(pieces) {
  const catalog = fs.readFileSync(path.join(root, "pieces/CATALOG.md"), "utf8");
  const rows = [...catalog.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)].map((m) => m[1]);
  for (const id of Object.keys(pieces)) if (!rows.includes(id)) err(`CATALOG.md: missing row for ${id}`);
  for (const id of rows) if (!Object.prototype.hasOwnProperty.call(pieces, id)) err(`CATALOG.md: row for unknown piece ${id}`);
  for (const id of new Set(rows)) if (rows.indexOf(id) !== rows.lastIndexOf(id)) err(`CATALOG.md: duplicate row for ${id}`);
  const packs = [], packIds = new Set();
  for (const name of fs.readdirSync(path.join(root, "packs"))) {
    const p = `packs/${name}/pack.json`;
    if (!exists(p)) continue;
    let pack;
    try { pack = read(p); } catch (x) { err(`${p}: invalid JSON (${x.message})`); continue; }
    if (!isObj(pack)) { err(`${p}: pack must be a JSON object`); continue; }
    if (typeof pack.id !== "string" || !pack.id) err(`${p}: missing "id"`);
    else if (packIds.has(pack.id)) err(`${p}: duplicate pack id "${pack.id}"`);
    packIds.add(pack.id);
    for (const k of ["pieces", "connectors", "stages"]) if (k in pack && !Array.isArray(pack[k])) { err(`${p}: "${k}" must be an array`); pack[k] = []; }
    packs.push(pack);
    for (const id of pack.pieces || []) if (!Object.prototype.hasOwnProperty.call(pieces, id)) err(`${p}: unknown piece "${id}"`);
    for (const c of pack.connectors || []) if (!exists(`connectors/${c}/SPEC.md`))
      err(`${p}: connector "${c}" has no connectors/${c}/SPEC.md`);
    const stageNames = (pack.stages || []).map((s) => s && s.stage);
    for (const s of pack.stages || []) {
      if (!isObj(s)) { err(`${p}: stage entries must be objects`); continue; }
      if (!pieces[s.piece]) err(`${p}: stage ${s.stage} uses unknown piece ${s.piece}`);
      if (s.playbook && !exists(s.playbook)) err(`${p}: missing playbook ${s.playbook}`);
      if (s.next && !stageNames.includes(s.next)) err(`${p}: stage ${s.stage} -> next "${s.next}" is not a stage`);
    }
  }
  return packs;
}

const [cmd = "validate", arg] = process.argv.slice(2);
const CMDS = ["validate", "next", "checklist", "check"];
if (!CMDS.includes(cmd)) { console.error(`Unknown command "${cmd}". Use: ${CMDS.join(" | ")}`); process.exit(2); }

if (cmd === "check") {
  // Validate draft entries (e.g. from the scanner's --emit-entries) without touching the catalog.
  if (!arg) { console.error("Usage: cycle.js check <entry.json|dir>"); process.exit(2); }
  const abs = path.resolve(arg);
  if (!fs.existsSync(abs)) { console.error(`check: ${arg} does not exist`); process.exit(2); }
  const files = fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).filter((f) => f.endsWith(".json")).map((f) => path.join(abs, f)) : [abs];
  const seen = new Set();
  for (const f of files) { const e = validatePiece(path.relative(root, f)); if (e && e.id) { if (seen.has(e.id)) err(`${f}: duplicate id "${e.id}"`); seen.add(e.id); } }
  if (errors.length) { console.error(errors.map((e) => "  - " + e).join("\n")); process.exit(1); }
  console.log(`OK: ${files.length} draft entr${files.length === 1 ? "y" : "ies"} match pieces/schema.json`);
  process.exit(0);
}

const pieces = loadPieces();
const packs = validatePacks(pieces);
const core = packs.find((p) => p.id === "forkbomb-core");
if (!core) err("packs/forkbomb-core/pack.json: core pack missing");
else if (!core.stages || !core.stages.length) err("packs/forkbomb-core/pack.json: core pack has no stages");
if (Object.keys(pieces).length !== entryFiles) err(`pieces/entries: ${entryFiles} files but ${Object.keys(pieces).length} valid unique pieces`);

if (errors.length) {
  console.error("Cycle blocked. Fix these snaps:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

if (cmd === "next") {
  const s = core.stages.find((x) => x.stage === arg);
  if (!s) { console.error(`Unknown stage "${arg}". Stages: ${core.stages.map((x) => x.stage).join(", ")}`); process.exit(2); }
  const n = core.stages.find((x) => x.stage === s.next);
  if (!n) { console.error(`Stage "${s.stage}" has no next stage`); process.exit(2); }
  console.log(`After ${s.stage} -> ${n.stage}: run piece "${n.piece}" with ${n.playbook}, then emit ${n.emits}`);
} else if (cmd === "checklist") {
  console.log(`# ${core.name} — one cycle\n`);
  core.stages.forEach((s, i) => {
    const p = pieces[s.piece];
    console.log(`- [ ] ${i + 1}. ${s.stage.toUpperCase()} — ${p.name}: ${p.summary}`);
    console.log(`      in: ${p.seams.inputs.join(", ")}  out: ${p.seams.outputs.join(", ")}  emit: ${s.emits}`);
  });
  console.log(`- [ ] loop: improve feeds discover. Run again.`);
} else {
  console.log(`OK: ${Object.keys(pieces).length} pieces (${entryFiles} entry files), ${packs.length} pack(s) valid.`);
  console.log(`forkbomb-core loop: ${core.stages.map((s) => s.stage).join(" -> ")} -> ${core.stages[0].stage}`);
}
