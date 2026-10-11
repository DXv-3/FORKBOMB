# toolkit/scanner — FORKBOMB parts scanner

Finds reusable GitHub bricks — functions, workflows, Dockerfiles, schemas, modules — ranks them, and hands a `candidate-list` to the Tag stage. Zero dependencies (Node 18+). Engine of the `discover-bricks` piece.

```bash
node toolkit/scanner/scan.js --help
node toolkit/scanner/scan.js "retry backoff" --lang js --kind function
node toolkit/scanner/scan.js "deploy" --kind workflow --limit 10 --out candidates.json
node toolkit/scanner/scan.js "json schema" --kind schema --emit-entries .forkbomb/drafts
node toolkit/process/cycle.js check .forkbomb/drafts
node toolkit/scanner/test.js   # offline tests
```

| Flag | Meaning |
|---|---|
| `--kind` | `any`, `function`, `workflow`, `docker`, `schema`, `module` |
| `--lang` | language filter (`js`, `ts`, `py`, `go`, …) |
| `--limit` / `--min-stars` | ranked results kept / star floor |
| `--mode` | `code` (file-level, needs auth) or `repo`; auto-picks |
| `--json` / `--out` | candidate-list envelope to stdout / file |
| `--emit-entries <dir>` | draft entries matching `pieces/schema.json` |

**Auth:** `gh auth token`, `GITHUB_TOKEN`, or `GH_TOKEN`. **Scoring (0–100):** license (30), stars (log, 25), recency (20), reusable path (+8), recognized kind (+7), brick size (+10); penalties for test/vendor paths, oversize, archived, forks. Every result lists its `why`.
