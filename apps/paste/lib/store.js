// File-backed paste store: one JSON file per paste, atomic writes, lazy + periodic expiry.
"use strict";
const fs = require("fs");
const path = require("path");
const { nanoid } = require("./nanoid");
const ID_RE = /^[0-9A-Za-z]{4,32}$/;
const EXPIRY = { never: 0, "10m": 600e3, "1h": 3600e3, "1d": 86400e3, "1w": 604800e3 };

class Store {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); }
  file(id) { return path.join(this.dir, id + ".json"); }
  create({ content, language = "plaintext", expiry = "never", title = "" }, now = Date.now()) {
    if (!(expiry in EXPIRY)) throw Object.assign(new Error(`expiry must be one of ${Object.keys(EXPIRY).join(", ")}`), { code: "bad_expiry" });
    let id; do id = nanoid(); while (fs.existsSync(this.file(id)));
    const paste = { id, title: String(title).slice(0, 120), language, content, createdAt: new Date(now).toISOString(),
      expiresAt: EXPIRY[expiry] ? new Date(now + EXPIRY[expiry]).toISOString() : null };
    const tmp = this.file(id) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(paste));
    fs.renameSync(tmp, this.file(id));
    return paste;
  }
  get(id, now = Date.now()) {
    if (!ID_RE.test(id)) return null;
    let p; try { p = JSON.parse(fs.readFileSync(this.file(id), "utf8")); } catch { return null; }
    if (p.expiresAt && Date.parse(p.expiresAt) <= now) { this.remove(id); return null; }
    return p;
  }
  remove(id) { try { fs.unlinkSync(this.file(id)); } catch {} }
  sweep(now = Date.now()) {
    let n = 0;
    for (const f of fs.readdirSync(this.dir)) if (f.endsWith(".json") && !this.get(f.slice(0, -5), now)) n++;
    return n;
  }
}
module.exports = { Store, EXPIRY, ID_RE };
