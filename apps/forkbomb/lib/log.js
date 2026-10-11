// Structured JSON-lines logger. One object per line on stdout (errors on stderr). Never log bodies, headers or secrets.
"use strict";
const { LEVELS } = require("./config");

function createLogger({ level = "info", base = {}, out = process.stdout, err = process.stderr } = {}) {
  const min = LEVELS.indexOf(level);
  const emit = (lvl, msg, fields) => {
    if (LEVELS.indexOf(lvl) < min) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg: String(msg), ...base, ...fields });
    (lvl === "error" ? err : out).write(line + "\n");
  };
  const fmt = (args) => args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  const log = {
    debug: (m, f) => emit("debug", m, f), info: (m, f) => emit("info", m, f), warn: (m, f) => emit("warn", m, f),
    // error(msg, fields) or console-style error(...args) (used by the mounted apps)
    error: (m, f, ...rest) => (f && typeof f === "object" && !(f instanceof Error) && !rest.length ? emit("error", m, f) : emit("error", fmt([m, f, ...rest].filter((x) => x !== undefined)))),
    log: (...a) => emit("info", fmt(a)),
  };
  return log;
}
module.exports = { createLogger };
