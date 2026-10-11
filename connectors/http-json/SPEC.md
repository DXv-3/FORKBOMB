# Connector: http-json

## Job

Move structured data between pieces over HTTP using JSON.

## Contract

- Content-Type: `application/json`
- Success: `2xx` with JSON body (or empty)
- Failure: `4xx`/`5xx` with `{ "error": { "code": string, "message": string } }`
- Optional headers: `X-Piece-Id`, `X-Request-Id`

## Snap pattern

Piece A exposes an endpoint. Piece B calls it. Both validate against a shared JSON schema for the payload.
