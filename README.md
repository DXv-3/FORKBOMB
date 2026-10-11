# FORKBOMB

**Fork the world. Snap GitHub into Legos. Build the ecosystem.**

Every repo on GitHub is a bin of parts. FORKBOMB is how those parts become a market that grows forever.

## The shift

Stop opening a repo as a finished product. Open it as a parts bin.

| Old view | FORKBOMB view |
| --- | --- |
| One repo = one app | One repo = many pieces |
| Copy a project | Snap a brick |
| Glue is custom | Connectors are shared |
| Growth is a later problem | The market is the product |

## What lives here

```
FORKBOMB/
├── pieces/        # Catalog + schema for reusable bricks
├── connectors/    # Standard seams so bricks snap together
├── marketplace/   # How pieces, people, and value circulate
├── packs/         # Pieces + connectors bundled for one job (incl. forkbomb-core)
├── toolkit/       # Curated starter bricks ready to fork
└── docs/          # Vision and operating system for the ecosystem
```

## How to play

1. **Find a brick** — search GitHub for the smallest unit that does the job.
2. **Tag it** — add it to `pieces/` with license, seams, and source.
3. **Snap it** — wire it through a connector, not one-off glue.
4. **Ship value** — host it, support it, or productize the edge.
5. **Feed the bin** — upstream fixes so the next builder gets a better brick.

## FORKBOMB runs on FORKBOMB

The loop above isn't advice — it ships as a product. Every step is a cataloged piece, every hand-off rides a shared connector, and the whole operating system is one pack: [`packs/forkbomb-core`](packs/forkbomb-core/pack.json).

`discover-bricks → tag-piece → snap-via-connector → ship-edge → earn-loop → improve-upstream → (repeat)`, orchestrated by `run-cycle`.

```bash
node toolkit/scanner/scan.js "retry backoff" --lang js   # scan GitHub for ranked bricks
node toolkit/scanner/scan.js "deploy" --kind workflow --emit-entries .forkbomb/drafts
node toolkit/process/cycle.js checklist
```

Read the full inverted process in [docs/PROCESS.md](docs/PROCESS.md).

## First product: FORKBOMB Paste

"Build me the paste app from anywhere on GitHub" — done. The scanner found the bricks (Prism for highlighting, nanoid for short IDs), FORKBOMB snapped them to a zero-dependency Node server, and it ships as pack [`packs/paste`](packs/paste/pack.json).

```bash
node apps/paste/server.js   # http://localhost:3000
```

See [apps/paste](apps/paste/README.md) for the API and the full parts/provenance table.

## Second product: FORKBOMB Shaders

"Now build me shaders" — done, and it glows. The scanner pulled permissive GLSL bricks (Ashima/stegu simplex noise, Hoskins' hash-without-sine, SDF primitives, cosine palettes), FORKBOMB snapped them into an `#include`-able library and a WebGL2 live-coding playground with 7 demo shaders. Ships as pack [`packs/shaders`](packs/shaders/pack.json).

```bash
node apps/shaders/server.js   # http://localhost:3001
```

See [apps/shaders](apps/shaders/README.md) for the library, presets and the provenance/license table.

## Third product: FORKBOMB Gradients

"All gradients." 556 MIT gradients (uiGradients + WebGradients) as CSS linear/radial/conic, WebGL2 mesh gradients and aurora, film grain, and clean-room dot-grid/halftone/particle-morph effects (dotsui.dev-inspired, original code). Live controls, Copy CSS/GLSL, PNG export. New `gradient.glsl` + `mesh.glsl` land in the shader library too. Ships as pack [`packs/gradients`](packs/gradients/pack.json).

```bash
node apps/gradients/server.js   # http://localhost:3002
```

See [apps/gradients](apps/gradients/README.md) for the license table and the dotsui.dev decision.

## Production: one server, every app (v1.0.0)

`npm start` runs **apps/forkbomb/server.js**, a single zero-dependency Node (>=18) server that mounts everything under one origin:

| Path | What |
|---|---|
| `/` | landing page linking every app |
| `/paste/` | FORKBOMB Paste (form, `/paste/api/paste` JSON API, `/paste/p/:id`, `/paste/raw/:id`) |
| `/shaders/` | WebGL2 shader playground |
| `/gradients/` | gradient gallery |
| `/dots` | redirects to `/gradients/dots/` (Dots Studio) |
| `/healthz` | liveness: process is up (never rate limited) |
| `/readyz` | readiness: `DATA_DIR` is writable and the server is not draining (503 otherwise) |

The per-app servers (`node apps/paste/server.js` etc.) still run standalone for development.

### Run

```bash
npm start                                    # http://localhost:8080, data in ./data
PORT=3000 DATA_DIR=/var/lib/forkbomb npm start
docker compose up -d                         # or: docker build -t forkbomb . && docker run -p 8080:8080 -v forkbomb-data:/data forkbomb
```

### Configure (environment only, validated at boot; bad values exit with code 78 and a JSON error)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | 0-65535 |
| `HOST` | `0.0.0.0` | bind address |
| `DATA_DIR` | `./data` | paste storage; must be writable (checked by `/readyz`) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent` |
| `MAX_BYTES` | `524288` | max paste size in bytes (1 KiB to 10 MiB) |
| `TRUST_PROXY` | `0` | `1` only behind a proxy you control: client IP from `X-Forwarded-For`, HSTS when `X-Forwarded-Proto: https` |
| `HSTS` | auto | force `1`/`0`; auto = on for HTTPS requests |
| `ACCESS_LOG` | `1` | JSON access log line per request |
| `FSYNC` | `1` | fsync paste file + directory before acknowledging a write |
| `MAX_STORAGE_BYTES` | `1073741824` | paste storage cap (0 = unlimited); full = HTTP 507 |
| `MAX_PASTES` | `100000` | paste count cap (0 = unlimited) |
| `RATE_LIMIT` / `READ_RATE_LIMIT` | `30` / `600` | paste writes / reads per minute per IP |
| `GLOBAL_RATE_LIMIT` | `1200` | requests per minute per IP across the whole site |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | drain budget on SIGTERM/SIGINT before connections are force-closed |

### What production gets

- **Security:** strict per-app CSP with no third-party origins (Prism 1.29.0 is self-hosted under `apps/paste/vendor/` with its MIT license and checksums), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP/CORP, HSTS on HTTPS, sandboxed raw pastes, rate limits, body/URI/header size limits, realpath containment against path traversal, no stack traces to clients.
- **Caching:** ETag + Last-Modified + `Cache-Control` on static files, `304` revalidation, brotli/gzip for text assets (zlib), content-hashed `?v=` asset URLs cached as `immutable`.
- **Logs:** one JSON object per line: `ts, level, msg, id, method, path, status, ms, bytes`. Query strings, headers and bodies are never logged. `X-Request-Id` is echoed (or generated).
- **Lifecycle:** SIGTERM/SIGINT flips `/readyz` to 503, stops accepting, drains, exits 0; `unhandledRejection`/`uncaughtException` are logged and trigger the same shutdown with exit 1.
- **Accessibility:** labelled controls, visible focus, keyboard-operable shape grid and timeline, DOM + `aria-live` equivalents for the canvas-drawn Dot UI. axe-core: zero serious/critical violations on every page (CI-enforced).

### Deploy

Configs are included but nothing is deployed for you:

- **Docker:** multi-stage `Dockerfile` (tests run in the build stage; runtime is `node:22-alpine`, non-root `node` user, `/data` volume, `HEALTHCHECK` on `/readyz`). `docker-compose.yml` adds a read-only root FS, dropped capabilities and `no-new-privileges`.
- **Fly.io:** `fly.toml` (`fly launch --no-deploy --copy-config`, `fly volumes create forkbomb_data --size 1`, `fly deploy`).
- **Render:** `render.yaml` blueprint with a persistent disk.
- **Heroku-style / any PaaS:** `Procfile` (`web: node apps/forkbomb/server.js`). Remember that paste data needs a persistent disk.

Run **one instance per data volume**: paste storage is local files, so horizontal scaling needs shared storage first.

### Operate

- **Probes:** liveness `GET /healthz`, readiness `GET /readyz`.
- **Backups:** each paste is one JSON file in `DATA_DIR`, written atomically (temp file + rename, fsync'd), so a plain file copy is consistent: `tar czf forkbomb-$(date +%F).tgz -C /data .` (or snapshot the volume). Restore by extracting into an empty `DATA_DIR` before start. Expired pastes and stale temp files are swept every minute.
- **Storage full:** writes answer `507 storage_full`; raise `MAX_STORAGE_BYTES`/`MAX_PASTES` or wait for expiry.
- **Verify a deployment:** `BASE_URL=https://your.host bash scripts/smoke.sh` (48 curl checks including the attack suite) and `BASE_URL=... node scripts/e2e.js` (needs `npm i --no-save puppeteer-core axe-core` and Chrome).
- **Releases:** the `release` workflow tags `vX.Y.Z` (must match `package.json` and CHANGELOG.md) and attaches a source tarball, a `docker save` image tarball and SHA256SUMS to a draft GitHub release. Nothing is pushed to a registry.

See [CHANGELOG.md](CHANGELOG.md).

## Start now

- Read [docs/VISION.md](docs/VISION.md)
- Run the loop with [docs/PROCESS.md](docs/PROCESS.md)
- Browse [pieces/CATALOG.md](pieces/CATALOG.md)
- Drop a brick into [toolkit/](toolkit/)
- Shape the market in [marketplace/](marketplace/)

## License

MIT. Fork freely. Build loudly.
