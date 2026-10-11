# 2. Tag — piece `tag-piece`

**In:** candidate-list · **Out:** `pieces/entries/<id>.json`, catalog row · **Emit:** `stage.tag.done`, `piece.added`

1. Choose a kebab-case `id`; filename = id.
2. Fill every required field in [`pieces/schema.json`](../../../pieces/schema.json): name, category, license, source (url + commit), seams, summary.
3. Write the `snap` line: one sentence on how to wire it in.
4. Add the row to [`pieces/CATALOG.md`](../../../pieces/CATALOG.md).
5. Run `node toolkit/process/cycle.js` until it prints OK → Snap.
