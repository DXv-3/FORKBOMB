# Piece catalog

A **piece** is the smallest unit you would actually reuse somewhere else.

## Piece rules

- One clear job
- Clear license
- Named seams (inputs / outputs / events)
- Source link back to the origin
- Note on how to snap it into a project

## Schema

Every piece entry follows [`schema.json`](schema.json).

## Index

| ID | Name | Category | License | Status |
| --- | --- | --- | --- | --- |
| `retry-with-backoff` | Retry with backoff | reliability | MIT | starter |
| `ci-node-matrix` | Node CI matrix | ci | MIT | starter |

### Process pieces — pack [`forkbomb-core`](../packs/forkbomb-core/pack.json)

FORKBOMB's own operating loop, cataloged like any other brick. See [docs/PROCESS.md](../docs/PROCESS.md).

| ID | Name | Category | License | Status |
| --- | --- | --- | --- | --- |
| `discover-bricks` | Discover bricks | agent | MIT | core |
| `tag-piece` | Tag piece | data | MIT | core |
| `snap-via-connector` | Snap via connector | infra | MIT | core |
| `ship-edge` | Ship edge | ci | MIT | core |
| `earn-loop` | Earn loop | commerce | MIT | core |
| `improve-upstream` | Improve upstream | reliability | MIT | core |
| `run-cycle` | Run cycle | agent | MIT | core |

Add new rows when you drop a brick into `toolkit/` or `pieces/entries/`. `node toolkit/process/cycle.js` checks every entry has a row.
