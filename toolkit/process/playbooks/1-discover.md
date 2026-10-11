# 1. Discover — piece `discover-bricks`

**In:** wanted-board, search queries · **Out:** candidate-list · **Emit:** `stage.discover.done`

1. Pull the top asks from the wanted-bricks board (issues labeled `wanted-brick`).
2. Search GitHub: `gh search code "<capability>" --language <lang>`, `gh search repos topic:<topic> stars:>50`.
3. Keep candidates that do one job, carry a clear license, and expose clean inputs/outputs.
4. Record each as `{ url, path, commit, license, job }` in a candidate list (issue or PR description).
5. Emit `stage.discover.done` with the list → Tag.
