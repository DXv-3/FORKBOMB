#!/usr/bin/env node
// FORKBOMB run-cycle piece: walks the forkbomb-core pack and validates the system on itself.
// Usage: node toolkit/process/cycle.js [validate|next <stage>|checklist]
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
    for (const c of pack.connectors || []) if (!exists(`connectors/${c}/SPEC.md`) && !["gh-action", "cli-stdin"].includes(c))
      err(`${p}: connector "${c}" has no connectors/${c}/SPEC.md`);
    for (const s of pack.stages || []) {
      if (!pieces[s.piece]) err(`${p}: stage ${s.stage} uses unknown piece ${s.piece}`);
      if (s.playbook && !exists(s.playbook)) err(`${p}: missing playbook ${s.playbook}`);
    }
  }
  return packs;
}

const [cmd = "validate", arg] = process.argv.slice(2);
const pieces = loadPieces();
const packs = validatePacks(pieces);
const core = packs.find((p) => p.id === "forkbomb-core");

if (errors.length) {
  console.error("Cycle blocked. Fix these snaps:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

if (cmd === "next") {
  const s = core.stages.find((x) => x.stage === arg) || core.stages[0];
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
