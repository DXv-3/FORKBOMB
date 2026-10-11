# Connector: process-stage

## Job

Hand work from one FORKBOMB process stage to the next so stages snap like any other bricks.

## Contract

Every stage hand-off is a JSON envelope:

```json
{
  "stage": "discover | tag | snap | ship | earn | improve",
  "piece": "<piece id that produced it>",
  "cycle": "<cycle id, e.g. 2026-10-11>",
  "outputs": { "<seam name>": "<value or path>" },
  "next": "<next stage>"
}
```

- `outputs` keys must match the producing piece's `seams.outputs`.
- The consuming stage reads them as its `seams.inputs`.
- Carriers: a PR/issue body, a file under `.forkbomb/cycles/`, or an `event-bus` event `stage.<name>.done`.
- Invalid envelopes fail loud: `node toolkit/process/cycle.js` exits non-zero.

## Snap pattern

`discover-bricks` emits `stage.discover.done` with `candidate-list` → `tag-piece` consumes it → … → `improve-upstream` emits `wanted-board` → `discover-bricks` consumes it. The loop closes.
