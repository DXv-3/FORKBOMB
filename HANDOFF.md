# FORKBOMB system handoff (v1.0.0, Oct 11 2026)

## Contents
```
forkbomb-system/
├── FORKBOMB/        # github.com/DXv-3/FORKBOMB: unified production app + parts ecosystem
├── dspy-dropin/     # github.com/DXv-3/dspy-dropin: drop-in DSPy kit (Python)
├── HANDOFF.md       # this file
└── SYSTEM_PROMPT.md # prompt for the next engineer/LLM
```
The `.git` folders and runtime data aren't in the zip. To keep shipping, clone the GitHub repos so you have history.

## FORKBOMB
**Run:** `cd FORKBOMB && npm start`. That serves one origin: `/` landing, `/paste/`, `/shaders/`, `/gradients/`, `/dots/`, `/healthz`, `/readyz`.
**Docker:** `docker build -t forkbomb . && docker run -p 8080:8080 -v forkbomb-data:/data forkbomb`
**Config (env only, checked at boot; bad values exit 78):** PORT, HOST, DATA_DIR, LOG_LEVEL, MAX_BYTES, TRUST_PROXY, plus tuning knobs listed in the README.
**Deploy configs:** `fly.toml`, `render.yaml`, `Procfile`. **Nothing has been deployed.** Smoke-test a live URL with `BASE_URL=… bash scripts/smoke.sh`.

### Map
| Path | What it is |
|---|---|
| `apps/forkbomb/server.js` | Unified production server: logs, health, caching, brotli/gzip, CSP, rate limits, graceful drain |
| `apps/shared/http.js` | Hardened static-serving helper |
| `apps/paste` | Pastebin: `/p/<id>`, `/raw/<id>`, `POST /api/paste`, expiry, atomic fsync writes, storage caps, self-hosted Prism 1.29.0 |
| `apps/shaders` | WebGL2 playground: `lib/*.glsl` with `#include` (noise, fbm, hash, sdf, palette, raymarch, camera, lighting, post, gradient, mesh), 19 presets |
| `apps/gradients` | 556 MIT gradients (uiGradients + WebGradients) with CSS/mesh/aurora/grain/dots modes; Dots Studio at `/dots` (90 shapes, physics, dot UI, timeline, exports); `forkbomb-dots.js` embed lib |
| `toolkit/scanner/scan.js` | GitHub parts scanner: ranks candidates 0–100, `--kind`, `--json`, `--emit-entries`. Code mode needs `gh auth login` or `GITHUB_TOKEN`; without either it falls back to repo search |
| `toolkit/process/cycle.js` | Validates pieces, catalog, packs, connectors and playbooks; `checklist`, `next <stage>`, `check <dir>` |
| `pieces/`, `packs/`, `connectors/` | Registry: 32+ pieces; packs forkbomb-core, paste, shaders, gradients; connectors http-json, cli-stdin, gh-action, event-bus, process-stage |
| `docs/` | VISION, PROCESS, dotsui-feature-map |
| `.github/workflows` | test (Node 18/20/22), process-cycle, validate-pieces, discover-scan (weekly), production (e2e + docker), release (draft only, never run) |

### Status at handoff
- CI green on main. 62 unit tests, `cycle.js` and `node --check` on all JS pass. The 48-check e2e attack suite passes. axe finds 0 violations on 8 pages.
- Lighthouse perf: landing 100, paste 97, dots 99, gradients 86, shaders 79. Accessibility, best practices and SEO are 100 on every page.
- Docker image is 168 MB, non-root, with a healthcheck; tested read-only with all capabilities dropped. `docker-compose.yml` has never been run.

### Open items (fix these first)
1. Paste storage is local disk, so it runs as a single instance. Add pluggable shared storage (S3, SQLite or Postgres) behind the store interface.
2. Rate limits live in memory and reset on restart. Move them to a shared store when scaling.
3. No metrics. Add `/metrics` (Prometheus text) guarded by a token.
4. Shaders and gradients have high blocking time under CPU throttling. Compile shaders lazily or off the main thread and measure on real GPUs.
5. Shader polish: supersampling exists only on kaleido-tunnel and soap-film; soft shadows and ambient occlusion only on liquid-chrome; turing-bloom reads as marble stripes.
6. Dots features not built yet: avatars, multi-track timelines and event triggers, collisions against page text, scroll triggers, a React wrapper. Mic/WebM/image upload have never been tested by hand.
7. Scanner code mode has never run live, because there was no GitHub auth on the build box.
8. Shrink the Docker image (distroless or a slimmer runtime).
9. The release workflow has never been run.

## dspy-dropin
**Install:** `pip install git+https://github.com/DXv-3/dspy-dropin` (Python ≥3.10, `dspy>=3.4.0,<3.5`).
**Use:** `from dspy_dropin import ask, task, cot, react, classify, extract, summarize, rag, program, optimize`. The model is picked automatically from `DSPY_MODEL` or the OpenAI, Anthropic, Groq, Gemini, Mistral or Together keys, or from Ollama. `DSPY_MODEL=dummy` runs everything offline.
**CLI:** `dspy-dropin doctor|ask|run|optimize|serve`. **Server:** binds 127.0.0.1 by default; set `DSPY_DROPIN_TOKEN` to require a bearer token. Body cap is 1 MiB. Errors are generic, with secrets removed. **Action:** `action.yml`.
**Status:** 73 tests and ruff pass; CI is green on 3.10–3.12.
**Open:** no live model call has ever been made. The `mipro` and `random` optimizers and FastAPI under uvicorn are untested. The fake model relies on DSPy internals and is guarded by `hook_supported()`.

## Suggested next moves
1. A green baseline on fresh clones.
2. Open items 1–3 (scale-out readiness).
3. A real deploy, once Vincent approves the platform.
4. Turn on the scanner in code mode with auth and fill the bin with packs that grow the market.
