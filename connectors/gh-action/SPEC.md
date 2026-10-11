# Connector: gh-action

## Job

Run a FORKBOMB piece as a GitHub Actions step so every push/PR snaps the system together and fails loud.

## Contract

- A piece exposes a single command (e.g. `node toolkit/process/cycle.js validate`, `node toolkit/scanner/scan.js "<q>" --json --out candidates.json`).
- Exit code `0` = snap holds; non-zero = the job fails and blocks the merge.
- Human-readable output goes to `$GITHUB_STEP_SUMMARY`; machine output (JSON envelopes) goes to an artifact or file under `.forkbomb/cycles/`.
- Auth: `GITHUB_TOKEN` from the workflow (`env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`).

## Snap pattern

See `.github/workflows/process-cycle.yml` (validate + checklist) and `.github/workflows/discover-scan.yml` (scheduled/manual scanner run).
