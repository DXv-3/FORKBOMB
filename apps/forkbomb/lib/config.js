// FORKBOMB unified server config: read ONLY from the environment, validated at boot (fail fast on bad values).
"use strict";
const path = require("path");

const LEVELS = ["debug", "info", "warn", "error", "silent"];
const int = (name, def, min, max) => (env) => {
  const raw = env[name];
  if (raw === undefined || raw === "") return def;
  if (!/^\d+$/.test(String(raw).trim())) throw new Error(`${name} must be an integer, got ${JSON.stringify(raw)}`);
  const n = Number(raw);
  if (n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}, got ${n}`);
  return n;
};
const bool = (name, def) => (env) => {
  const raw = env[name];
  if (raw === undefined || raw === "") return def;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  throw new Error(`${name} must be a boolean (1/0/true/false), got ${JSON.stringify(raw)}`);
};

const SPEC = {
  port: int("PORT", 8080, 0, 65535),
  host: (env) => {
    const h = env.HOST === undefined || env.HOST === "" ? "0.0.0.0" : String(env.HOST).trim();
    if (!/^[A-Za-z0-9.:\-\[\]]{1,253}$/.test(h)) throw new Error(`HOST is not a valid host/IP: ${JSON.stringify(env.HOST)}`);
    return h;
  },
  dataDir: (env) => path.resolve(env.DATA_DIR || "data"),
  logLevel: (env) => {
    const l = (env.LOG_LEVEL || "info").trim().toLowerCase();
    if (!LEVELS.includes(l)) throw new Error(`LOG_LEVEL must be one of ${LEVELS.join(", ")}, got ${JSON.stringify(env.LOG_LEVEL)}`);
    return l;
  },
  maxBytes: int("MAX_BYTES", 512 * 1024, 1024, 10 * 1024 * 1024),
  trustProxy: bool("TRUST_PROXY", false),
  // optional knobs (sane production defaults)
  accessLog: bool("ACCESS_LOG", true),
  hsts: (env) => (env.HSTS === undefined || env.HSTS === "" ? null : bool("HSTS", false)(env)), // null = auto (TRUST_PROXY + https)
  fsync: bool("FSYNC", true),
  maxStorageBytes: int("MAX_STORAGE_BYTES", 1024 * 1024 * 1024, 0, Number.MAX_SAFE_INTEGER),
  maxPastes: int("MAX_PASTES", 100000, 0, Number.MAX_SAFE_INTEGER),
  rateLimit: int("RATE_LIMIT", 30, 1, 1e6),
  readRateLimit: int("READ_RATE_LIMIT", 600, 1, 1e6),
  globalRateLimit: int("GLOBAL_RATE_LIMIT", 1200, 1, 1e7),
  shutdownTimeoutMs: int("SHUTDOWN_TIMEOUT_MS", 10000, 100, 600000),
};

function loadConfig(env = process.env) {
  const cfg = {}, errors = [];
  for (const [k, fn] of Object.entries(SPEC)) { try { cfg[k] = fn(env); } catch (e) { errors.push(e.message); } }
  if (errors.length) throw Object.assign(new Error(`invalid configuration:\n  - ${errors.join("\n  - ")}`), { code: "EBADCONFIG", errors });
  return Object.freeze(cfg);
}
module.exports = { loadConfig, LEVELS };
