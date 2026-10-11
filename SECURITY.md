# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately via GitHub's **[private vulnerability reporting](https://github.com/DXv-3/FORKBOMB/security/advisories/new)**
(Security tab → "Report a vulnerability"). Include affected path/app, steps to reproduce, impact, and a suggested fix if you
have one. You should get an acknowledgement within 7 days; fixes for confirmed issues are prioritised over new features.

## Supported versions

Only the latest `main` is supported. There are no maintained release branches.

## Scope

In scope:

- `apps/paste` (HTTP pastebin): XSS, path traversal via ids, size/ratelimit bypass, CSP bypass, information leaks.
- `apps/shaders`, `apps/gradients` (static servers + browser code): traversal, header/CSP issues, unsafe handling of
  share links, scene JSON, SVG or image input.
- `apps/shared/http.js` (hardened static-serve helper).
- `toolkit/scanner/scan.js`: token leakage, unsafe file writes from `--emit-entries`, rate-limit handling.
- `toolkit/process/cycle.js` and `.github/workflows/*`: validation bypass, workflow injection, excessive permissions.

Out of scope:

- Third-party code loaded at runtime (Prism from jsDelivr) and the upstream projects pieces point to; report those upstream.
- Denial of service that needs more traffic than the documented per-IP limits allow, or deployments that disable the
  defaults (e.g. `TRUST_PROXY=1` without a trusted proxy).
- Findings that require a malicious local user or a compromised GitHub token.

## Hardening defaults (for operators)

- Paste: `MAX_BYTES` (default 512 KiB), `RATE_LIMIT` writes/min/IP (30), `READ_RATE_LIMIT` (600), strict CSP with no
  `unsafe-inline` scripts, raw pastes served as sandboxed `text/plain`. Set `TRUST_PROXY=1` only behind your own proxy.
- All servers: GET/HEAD-only static serving with realpath containment, 30 s request timeout, generic error bodies,
  graceful shutdown on SIGTERM/SIGINT. Bind with `HOST=127.0.0.1` when you don't need LAN access.
