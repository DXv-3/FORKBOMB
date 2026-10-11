# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-11

First production release: one deployable server for every FORKBOMB app.

### Added
- `apps/forkbomb/server.js` unified server (`npm start`): landing page at `/`, Paste at `/paste/`, Shaders at `/shaders/`, Gradients at `/gradients/`, Dots Studio at `/dots` -> `/gradients/dots/`.
- Env-only configuration validated at boot (exit 78 on bad values): `PORT`, `HOST`, `DATA_DIR`, `LOG_LEVEL`, `MAX_BYTES`, `TRUST_PROXY` plus optional tuning knobs.
- `/healthz` liveness and `/readyz` readiness (DATA_DIR writable, not draining).
- Structured JSON logs with request ids (`X-Request-Id`), access log on by default, no bodies or query strings.
- Graceful shutdown (drain + timeout) and logged, clean exits on `unhandledRejection`/`uncaughtException`.
- HSTS behind an HTTPS proxy, site-wide per-IP rate limit, HTML 404/500 pages, favicon.svg/ico, robots.txt, meta descriptions.
- ETag/Last-Modified/Cache-Control, 304 revalidation, brotli/gzip compression, content-hashed immutable asset URLs.
- Paste durability: fsync option (on by default in the unified server), storage caps (`MAX_STORAGE_BYTES`, `MAX_PASTES`, HTTP 507), usage recount at boot, backup notes.
- Dockerfile (multi-stage, non-root, HEALTHCHECK, `/data` volume), docker-compose.yml, fly.toml, render.yaml, Procfile.
- `scripts/smoke.sh` curl smoke + attack suite and `scripts/e2e.js` browser checks (CSP, console, axe-core, performance, screenshots).
- CI: `production` workflow (e2e + docker jobs) and a `release` workflow (tag + draft release artifacts, no registry publishing).

### Changed
- Prism 1.29.0 is self-hosted (`apps/paste/vendor/prism-1.29.0`, MIT license included); Paste's CSP no longer allows any third-party origin.
- Apps use relative asset/API URLs so they work standalone and mounted under a prefix; Paste takes a `base` option.
- Accessibility: labels for every control, visible focus rings, contrast fixes, keyboard-operable shape grid, DOM + aria-live equivalents for the canvas-drawn Dot UI.
- Scripts load with `defer`; reserved space removes layout shift on Shaders and Gradients.
