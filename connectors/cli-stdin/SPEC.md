# Connector: cli-stdin

## Job

Pipe pieces together on the command line: one piece prints JSON, the next reads it.

## Contract

- Producers print one JSON document to stdout (`--json`); progress and diagnostics go to stderr only.
- Consumers read a file path argument or stdin.
- Envelopes follow the `process-stage` connector shape (`stage`, `piece`, `cycle`, `outputs`, `next`).
- Exit code non-zero on failure; never print partial JSON.

## Snap pattern

```bash
node toolkit/scanner/scan.js "retry backoff" --lang js --json > candidates.json
node toolkit/scanner/scan.js "retry backoff" --lang js --emit-entries .forkbomb/drafts
node toolkit/process/cycle.js check .forkbomb/drafts
```
