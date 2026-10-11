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

## Start now

- Read [docs/VISION.md](docs/VISION.md)
- Run the loop with [docs/PROCESS.md](docs/PROCESS.md)
- Browse [pieces/CATALOG.md](pieces/CATALOG.md)
- Drop a brick into [toolkit/](toolkit/)
- Shape the market in [marketplace/](marketplace/)

## License

MIT. Fork freely. Build loudly.
