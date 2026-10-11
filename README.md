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

## Start now

- Read [docs/VISION.md](docs/VISION.md)
- Run the loop with [docs/PROCESS.md](docs/PROCESS.md)
- Browse [pieces/CATALOG.md](pieces/CATALOG.md)
- Drop a brick into [toolkit/](toolkit/)
- Shape the market in [marketplace/](marketplace/)

## License

MIT. Fork freely. Build loudly.
