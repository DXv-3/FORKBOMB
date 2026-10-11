#!/usr/bin/env node
// FORKBOMB run-cycle piece: walks the forkbomb-core pack and validates the system on itself.
// Usage: node toolkit/process/cycle.js [validate|next <stage>|checklist|check <entry.json|dir>]
// Zero dependencies. Exit code 1 on any invalid snap (connectors fail loud).
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..", "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const exists = (p) => fs.existsSync(path.join(root, p));

const schema = read("pieces/schema.json");
const errors = [];
const err = (m) => errors.push(m);

function validatePiece(file) {
  let e;
  try { e = read(file); } catch (x) { return err(`${file}: invalid JSON (${x.message})`); }
  for (const k of schema.required) if (!(k in e)) err(`${file}: missing "${k}"`);
  if (e.id && !/^[a-z0-9-]+$/.test(e.id)) err(`${file}: id must be kebab-case`);
  if (e.id && path.basename(file, ".json") !== e.id) err(`${file}: filename must match id`);
  const cats = schema.properties.category.enum;
  if (e.category && !cats.includes(e.category)) err(`${file}: category "${e.category}" not in ${cats.join(",")}`);
  if (e.source && !e.source.url) err(`${file}: source.url required`);
  if (e.source && e.source.url && !/^https?:\/\//.test(e.source.url)) err(`${file}: source.url must be an http(s) URI`);
  for (const k of ["id", "name", "license", "summary", "snap"]) if (k in e && typeof e[k] !== "string") err(`${file}: "${k}" must be a string`);
  if (e.seams) {
    if (typeof e.seams !== "object" || Array.isArray(e.seams)) err(`${file}: seams must be an object`);
    else for (const k of ["inputs", "outputs", "events"]) if (k in e.seams && !(Array.isArray(e.seams[k]) && e.seams[k].every((x) => typeof x === "string"))) err(`${file}: seams.${k} must be a string array`);
  }
  if (e.trust) for (const [k, v] of Object.entries(e.trust)) if (typeof v !== "boolean") err(`${file}: trust.${k} must be boolean`);
  // Pieces sourced from this repo must point at a file that exists.
  if (e.source && /github\.com\/DXv-3\/FORKBOMB\/?$/i.test(e.source.url || "") && e.source.path && !exists(e.source.path))
    err(`${file}: source.path ${e.source.path} does not exist in this repo`);
  return e;
}

function loadPieces() {
  const dir = "pieces/entries";
  const map = {};
  for (const f of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".json"))) {
    const e = validatePiece(`${dir}/${f}`);
    if (e && e.id) map[e.id] = e;
  }
  return map;
}

function validatePacks(pieces) {
  const catalog = fs.readFileSync(path.join(root, "pieces/CATALOG.md"), "utf8");
  for (const id of Object.keys(pieces)) if (!catalog.includes(`\`${id}\``)) err(`CATALOG.md: missing row for ${id}`);
  const packs = [];
  for (const name of fs.readdirSync(path.join(root, "packs"))) {
    const p = `packs/${name}/pack.json`;
    if (!exists(p)) continue;
    const pack = read(p);
    packs.push(pack);
    for (const id of pack.pieces || []) if (!pieces[id]) err(`${p}: unknown piece "${id}"`);
    for (const c of pack.connectors || []) if (!exists(`connectors/${c}/SPEC.md`))
      err(`${p}: connector "${c}" has no connectors/${c}/SPEC.md`);
    for (const s of pack.stages || []) {
      if (!pieces[s.piece]) err(`${p}: stage ${s.stage} uses unknown piece ${s.piece}`);
      if (s.playbook && !exists(s.playbook)) err(`${p}: missing playbook ${s.playbook}`);
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
  const files = fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).filter((f) => f.endsWith(".json")).map((f) => path.join(abs, f)) : [abs];
  for (const f of files) validatePiece(path.relative(root, f));
  if (errors.length) { console.error(errors.map((e) => "  - " + e).join("\n")); process.exit(1); }
  console.log(`OK: ${files.length} draft entr${files.length === 1 ? "y" : "ies"} match pieces/schema.json`);
  process.exit(0);
}

const pieces = loadPieces();
const packs = validatePacks(pieces);
const core = packs.find((p) => p.id === "forkbomb-core");
if (!core) err("packs/forkbomb-core/pack.json: core pack missing");

if (errors.length) {
  console.error("Cycle blocked. Fix these snaps:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

if (cmd === "next") {
  const s = core.stages.find((x) => x.stage === arg);
  if (!s) { console.error(`Unknown stage "${arg}". Stages: ${core.stages.map((x) => x.stage).join(", ")}`); process.exit(2); }
  const n = core.stages.find((x) => x.stage === s.next);
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
  console.log(`OK: ${Object.keys(pieces).length} pieces, ${packs.length} pack(s) valid.`);
  console.log(`forkbomb-core loop: ${core.stages.map((s) => s.stage).join(" -> ")} -> ${core.stages[0].stage}`);
}
