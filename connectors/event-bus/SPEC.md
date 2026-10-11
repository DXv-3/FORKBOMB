# Connector: event-bus

## Job

Broadcast named events with JSON payloads so any piece can react without direct wiring.

## Contract

```json
{ "event": "<domain>.<name>[.<state>]", "source": "<piece id>", "at": "<ISO 8601>", "data": { } }
```

- Names are dot-separated, lowercase: `piece.added`, `stage.tag.done`, `release.published`.
- Payloads are additive: new fields are fine, removing fields is a major version.
- Carriers: GitHub `repository_dispatch`, webhooks over `http-json`, or newline-delimited JSON on `cli-stdin`.

## Process events (forkbomb-core)

`cycle.started`, `stage.<discover|tag|snap|ship|earn|improve>.done`, `piece.added`, `pack.updated`, `release.published`, `value.captured`, `upstream.fixed`, `cycle.completed`.
