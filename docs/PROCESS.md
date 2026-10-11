# PROCESS — FORKBOMB running on FORKBOMB

FORKBOMB turns GitHub into bricks, connectors, and packs. This document turns that same machine on itself: **the operating process is a pack.** Every stage is a piece in [`pieces/entries/`](../pieces/entries/), every hand-off rides a connector in [`connectors/`](../connectors/), and the whole loop ships as [`packs/forkbomb-core`](../packs/forkbomb-core/pack.json).

```
 discover-bricks ─▶ tag-piece ─▶ snap-via-connector ─▶ ship-edge ─▶ earn-loop ─▶ improve-upstream
        ▲                                                                              │
        └──────────────────────── wanted-board (process-stage) ◀───────────────────────┘
                              orchestrated by run-cycle
```

Run it:

```bash
node toolkit/process/cycle.js checklist
```

## Seams for the whole loop

- **`process-stage`** — the JSON envelope that hands outputs of one stage to inputs of the next.
- **`event-bus`** — `stage.<name>.done` and domain events (`piece.added`, `release.published`, …).
- **`gh-action`** — the [`process-cycle`](../.github/workflows/process-cycle.yml) workflow validates every PR.
- **`cli-stdin`** — `cycle.js` runs anywhere a human or agent has Node.

## Stages

### 1. Discover
- **Piece:** `discover-bricks` · **Connector:** `process-stage` · **Playbook:** [1-discover](../toolkit/process/playbooks/1-discover.md)
- Read the wanted-bricks board, search GitHub by capability and topic, keep single-job licensed candidates.
- **Ships:** a candidate list. **Emits:** `stage.discover.done`.

### 2. Tag
- **Piece:** `tag-piece` · **Connectors:** `process-stage`, `event-bus` · **Playbook:** [2-tag](../toolkit/process/playbooks/2-tag.md)
- Write `pieces/entries/<id>.json` against [`schema.json`](../pieces/schema.json), add the catalog row, run `cycle.js`.
- **Ships:** schema-valid catalog entries. **Emits:** `stage.tag.done`, `piece.added`.

### 3. Snap
- **Piece:** `snap-via-connector` · **Connectors:** any shared seam (`http-json`, `cli-stdin`, `gh-action`, `event-bus`, `process-stage`) · **Playbook:** [3-snap](../toolkit/process/playbooks/3-snap.md)
- Match outputs to inputs, wire through the connector contract, record the composition in a pack.
- **Ships:** a composed build + `pack.json`. **Emits:** `stage.snap.done`, `pack.updated`.

### 4. Ship
- **Piece:** `ship-edge` · **Connector:** `gh-action` · **Playbook:** [4-ship](../toolkit/process/playbooks/4-ship.md)
- Green `process-cycle` check → merge → tagged release → hosted runtime where it fits.
- **Ships:** a release. **Emits:** `stage.ship.done`, `release.published`.

### 5. Earn
- **Piece:** `earn-loop` · **Connector:** `event-bus` · **Playbook:** [5-earn](../toolkit/process/playbooks/5-earn.md)
- Attach sponsorships, support tiers, premium packs, and hosted runtimes to what shipped.
- **Ships:** live value paths. **Emits:** `stage.earn.done`, `value.captured`.

### 6. Improve
- **Piece:** `improve-upstream` · **Connectors:** `process-stage`, `event-bus` · **Playbook:** [6-improve](../toolkit/process/playbooks/6-improve.md)
- Send fixes upstream, refresh trust flags and commits, post new wanted bricks.
- **Ships:** upstream PRs + a fresh wanted board. **Emits:** `stage.improve.done`, `upstream.fixed` → feeds Discover.

### ∞. Run cycle
- **Piece:** `run-cycle` · **Entrypoint:** `node toolkit/process/cycle.js`
- Validates every piece, catalog row, pack, playbook, and connector, then prints the checklist or the next stage. Each cycle is itself a FORKBOMB release: new bricks in, better bricks out.

## The inversion

| FORKBOMB for GitHub | FORKBOMB for FORKBOMB |
| --- | --- |
| Repos are parts bins | The process is a parts bin |
| Pieces do one job | Each stage is one piece |
| Connectors are shared seams | Stages hand off through `process-stage` + `event-bus` |
| Packs bundle a job | `forkbomb-core` bundles the operating loop |
| Feed the bin | `improve-upstream` refills `discover-bricks` |

Fork the pack, swap a stage piece, and you have your own operating system for an ecosystem.
