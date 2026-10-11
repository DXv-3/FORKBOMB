# FORKBOMB Paste

FORKBOMB's first product pack: a fast, clean pastebin **assembled from parts found across GitHub**. Paste text, pick a language and expiry, get a short link like `/p/NRJ8hb1N` with syntax highlighting, a copy button, a raw view and a JSON API. Zero npm dependencies.

## Run

```bash
node apps/paste/server.js            # http://localhost:3000
cd apps/paste && npm start           # same
PORT=8080 DATA_DIR=/var/paste MAX_BYTES=1048576 node apps/paste/server.js
cd apps/paste && npm test            # node --test
docker build -t forkbomb-paste apps/paste && docker run -p 3000:3000 -v paste:/data forkbomb-paste
```

| Env | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | listen port |
| `DATA_DIR` | `apps/paste/data` | one JSON file per paste |
| `MAX_BYTES` | `524288` | max paste size (413 above) |
| `HOST` | all interfaces | bind address (e.g. `127.0.0.1`) |
| `RATE_LIMIT` | `30` | paste creations per minute per IP (429 + `Retry-After` above) |
| `READ_RATE_LIMIT` | `600` | requests per minute per IP |
| `TRUST_PROXY` | off | `1` = rate-limit by first `X-Forwarded-For` hop (only behind your own proxy) |

Security: strict CSP (no `unsafe-inline` scripts; the one inline script is hash-allowed), raw pastes are sandboxed `text/plain`, ids are validated before touching disk, 30 s request timeout, graceful shutdown on SIGTERM. See [SECURITY.md](../../SECURITY.md).

## Routes

| Route | What |
|---|---|
| `GET /` | create form |
| `POST /new` | form submit → 303 to `/p/<id>` |
| `GET /p/<id>` | highlighted view, Copy / Copy link / Raw |
| `GET /raw/<id>` | `text/plain` content |
| `POST /api/paste` | JSON `{content, language?, expiry?, title?}` → 201 paste |
| `GET /api/paste/<id>` | JSON paste, 404 `{error:{code,message}}` |
| `GET /healthz` | `{ok:true}` |

Expiry: `never`, `10m`, `1h`, `1d`, `1w`. Errors follow the [`http-json`](../../connectors/http-json/SPEC.md) connector contract.

```bash
curl -s localhost:3000/api/paste -H 'content-type: application/json' \
  -d '{"content":"print(\"hi\")","language":"python","expiry":"1d"}'
cat file.py | curl -s localhost:3000/api/paste -H 'content-type: application/json' \
  -d "$(node -e 'process.stdout.write(JSON.stringify({content:require("fs").readFileSync(0,"utf8")}))')"
```

## Safety

All user text is HTML-escaped; language is allow-listed; IDs are validated (`^[0-9A-Za-z]{4,32}$`) so no path traversal; strict CSP, `nosniff`, `X-Frame-Options: DENY`; body size capped; atomic file writes; expired pastes are removed on read and swept every minute.

## Parts and provenance

Found with `node toolkit/scanner/scan.js "<query>" --lang js --mode repo`.

| Piece | Upstream | License | Scanner | How it's used |
|---|---|---|---|---|
| [`prism-highlight`](../../pieces/entries/prism-highlight.json) | [PrismJS/prism](https://github.com/PrismJS/prism) | MIT | rank 75 for "syntax highlighting" | jsDelivr CDN, pinned `prismjs@1.29.0`, autoloader + tomorrow theme |
| [`nanoid-short-id`](../../pieces/entries/nanoid-short-id.json) | [ai/nanoid](https://github.com/ai/nanoid) | MIT | rank 75 for "nanoid" | algorithm adapted into [`lib/nanoid.js`](lib/nanoid.js) (crypto bytes, mask + rejection) |
| [`paste-file-store`](../../pieces/entries/paste-file-store.json) | this repo | MIT | — | [`lib/store.js`](lib/store.js): file storage + expiry |
| [`paste-app`](../../pieces/entries/paste-app.json) | this repo | MIT | — | [`server.js`](server.js): Node `http` wiring |

Considered and passed on: highlight.js (BSD-3-Clause, great but heavier), psitransfer (BSD-2, file transfer not paste), 0bin (WTFPL), kilink (GPL-3.0). Pack: [`packs/paste/pack.json`](../../packs/paste/pack.json).
