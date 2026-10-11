# Connectors

Connectors are the studs on the Legos. Pieces stay free to invent; seams stay boring and shared.

## Principles

1. **One seam, many bricks** — a piece speaks a connector language, not a one-off contract.
2. **Version in the open** — connectors evolve with semver and migration notes.
3. **Language-agnostic where possible** — JSON schemas, HTTP, events, and files travel farther than a single runtime.
4. **Fail loud** — invalid snaps should break early with clear errors.

## Starter connector set

| Connector | Purpose |
| --- | --- |
| `http-json` | Request/response over HTTP with JSON bodies |
| `cli-stdin` | Unix-style stdin/stdout/stderr pipes |
| `gh-action` | GitHub Actions inputs/outputs/secrets |
| `event-bus` | Named events with JSON payloads |
| `process-stage` | Stage-to-stage hand-off envelopes |

Add a connector by dropping a folder here with a `SPEC.md` (required — `cycle.js` fails if a pack references a connector without one) and optionally a `schema.json`.
