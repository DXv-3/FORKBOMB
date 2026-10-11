// File-backed paste store: one JSON file per paste, atomic writes (temp file + rename), lazy + periodic expiry.
// Options: fsync (flush file + directory before acknowledging a write), maxBytes / maxFiles (storage cap; writes beyond it
// fail with HTTP 507 after an expiry sweep has had a chance to free space). 0 = unlimited.
"use strict";
const fs = require("fs");
const path = require("path");
const { nanoid } = require("./nanoid");
const ID_RE = /^[0-9A-Za-z]{4,32}$/;
const EXPIRY = { never: 0, "10m": 600e3, "1h": 3600e3, "1d": 86400e3, "1w": 604800e3 };

class Store {
  constructor(dir, { fsync = false, maxBytes = 0, maxFiles = 0 } = {}) {
    this.dir = dir; this.fsync = fsync; this.maxBytes = maxBytes; this.maxFiles = maxFiles;
    fs.mkdirSync(dir, { recursive: true });
    this.recount();
  }
  // Recompute usage from disk (cheap: one readdir + stat per paste); called at boot and after each sweep.
  recount() {
    let bytes = 0, files = 0;
    for (const f of fs.readdirSync(this.dir)) if (f.endsWith(".json")) { try { bytes += fs.statSync(path.join(this.dir, f)).size; files++; } catch {} }
    this.usage = { bytes, files }; return this.usage;
  }
  full(extra) {
    return (this.maxFiles && this.usage.files + 1 > this.maxFiles) || (this.maxBytes && this.usage.bytes + extra > this.maxBytes);
  }
  file(id) {
    if (!ID_RE.test(id)) throw Object.assign(new Error("invalid id"), { code: "bad_id" }); // ids never reach the filesystem unchecked
    return path.join(this.dir, id + ".json");
  }
  create({ content, language = "plaintext", expiry = "never", title = "" }, now = Date.now()) {
    if (typeof expiry !== "string" || !Object.prototype.hasOwnProperty.call(EXPIRY, expiry)) throw Object.assign(new Error(`expiry must be one of ${Object.keys(EXPIRY).join(", ")}`), { code: "bad_expiry" });
    let id; do id = nanoid(); while (fs.existsSync(this.file(id)));
    const paste = { id, title: String(title).slice(0, 120), language, content, createdAt: new Date(now).toISOString(),
      expiresAt: EXPIRY[expiry] ? new Date(now + EXPIRY[expiry]).toISOString() : null };
    const data = Buffer.from(JSON.stringify(paste));
    if (this.full(data.length)) { this.sweep(now); if (this.full(data.length)) throw Object.assign(new Error("paste storage is full, try again later"), { status: 507, code: "storage_full" }); }
    const tmp = this.file(id) + ".tmp";
    const fd = fs.openSync(tmp, "wx", 0o600);
    try { fs.writeSync(fd, data); if (this.fsync) fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, this.file(id));
    if (this.fsync) { try { const d = fs.openSync(this.dir, "r"); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } } catch {} }
    this.usage.bytes += data.length; this.usage.files++;
    return paste;
  }
  get(id, now = Date.now()) {
    if (!ID_RE.test(id)) return null;
    let p; try { p = JSON.parse(fs.readFileSync(this.file(id), "utf8")); } catch { return null; }
    if (p.expiresAt && Date.parse(p.expiresAt) <= now) { this.remove(id); return null; }
    return p;
  }
  remove(id) { try { fs.unlinkSync(this.file(id)); } catch {} }
  // Remove expired pastes and orphaned temp files (from a crash mid-write) older than an hour.
  sweep(now = Date.now()) {
    let n = 0;
    for (const f of fs.readdirSync(this.dir)) {
      if (f.endsWith(".json")) { const id = f.slice(0, -5); if (ID_RE.test(id) && fs.existsSync(this.file(id)) && !this.get(id, now)) n++; }
      else if (f.endsWith(".json.tmp")) {
        try { if (now - fs.statSync(path.join(this.dir, f)).mtimeMs > 3600e3) { fs.unlinkSync(path.join(this.dir, f)); n++; } } catch {}
      }
    }
    this.recount();
    return n;
  }
  // Writable check for readiness probes: create + remove a probe file.
  writable() {
    const f = path.join(this.dir, `.probe-${process.pid}`);
    try { fs.writeFileSync(f, "ok"); fs.unlinkSync(f); return true; } catch { return false; }
  }
}
module.exports = { Store, EXPIRY, ID_RE };
