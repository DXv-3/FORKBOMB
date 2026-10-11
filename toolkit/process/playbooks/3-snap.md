# 3. Snap — piece `snap-via-connector`

**In:** piece ids, connector id · **Out:** composed build, `pack.json` · **Emit:** `stage.snap.done`, `pack.updated`

1. Match seams: outputs of piece A → inputs of piece B.
2. Pick the shared connector that carries them: `http-json`, `cli-stdin`, `gh-action`, `event-bus`, or `process-stage`.
3. Wire through the connector contract only — no one-off glue.
4. Record the composition in `packs/<name>/pack.json` (pieces + connectors + job).
5. Validate with `cycle.js` → Ship.
