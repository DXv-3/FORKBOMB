# 1. Discover — piece `discover-bricks`

**In:** wanted-board, search queries · **Out:** candidate-list (+ draft piece entries) · **Emit:** `stage.discover.done`

Engine: [`toolkit/scanner/scan.js`](../../scanner/scan.js) — zero-dep GitHub parts scanner.

1. Pull the top asks from the wanted-bricks board (issues labeled `wanted-brick`) and turn each into a query.
2. Scan:
   ```bash
   node toolkit/scanner/scan.js "retry backoff" --lang js --kind function --limit 15
   node toolkit/scanner/scan.js "deploy" --kind workflow --out candidates.json
   node toolkit/scanner/scan.js "topic:github-actions stars:>500" --mode repo --json
   ```
   Authenticated (`gh auth login` or `GITHUB_TOKEN`) = file-level code search; otherwise repo search.
3. The scanner ranks every hit 0–100: permissive license, stars, recency, reusable path (`src/`, `lib/`, `.github/workflows/`), brick-sized files; penalizes test/vendor paths, archived repos, forks.
4. `--out candidates.json` writes a `process-stage` envelope whose `outputs.candidate-list` items are `{ url, repo, path, commit, license, stars, kind, job, score, why }`.
5. `--emit-entries .forkbomb/drafts` writes draft entries; check them with `node toolkit/process/cycle.js check .forkbomb/drafts`.
6. Emit `stage.discover.done` with the list → Tag.
