#!/usr/bin/env bash
# FORKBOMB curl smoke + attack suite against a running unified server.
# Usage: BASE_URL=http://localhost:8080 bash scripts/smoke.sh
set -u
B="${BASE_URL:-http://localhost:8080}"
pass=0; fail=0
ok() { pass=$((pass+1)); printf 'PASS %s\n' "$1"; }
ko() { fail=$((fail+1)); printf 'FAIL %s (%s)\n' "$1" "$2"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() { local want="$1" name="$2"; shift 2; local got; got=$(code "$@"); [[ "$got" =~ ^($want)$ ]] && ok "$name -> $got" || ko "$name" "got $got want $want"; }
hdr() { curl -s -D - -o /dev/null "$@"; }

# --- availability
expect 200 "liveness /healthz" "$B/healthz"
expect 200 "readiness /readyz" "$B/readyz"
for p in / /paste/ /shaders/ /gradients/ /gradients/dots/ /favicon.ico /favicon.svg /robots.txt \
         /shaders/api/library /gradients/api/gradients /paste/vendor/prism-1.29.0/components/prism-core.min.js; do
  expect 200 "GET $p" "$B$p"; done
expect 301 "/dots redirects" "$B/dots"
expect 404 "unknown path" "$B/definitely-not-here"

# --- paste round trip
id=$(curl -s -X POST -H 'content-type: application/json' --data '{"content":"smoke <b>test</b>","language":"html"}' "$B/paste/api/paste" | sed -n 's/.*"id":"\([0-9A-Za-z]*\)".*/\1/p')
[ -n "$id" ] && ok "create paste ($id)" || ko "create paste" "no id"
expect 200 "view paste" "$B/paste/p/$id"
body=$(curl -s "$B/paste/p/$id"); [[ "$body" == *"&lt;b&gt;test&lt;/b&gt;"* ]] && ok "paste HTML is escaped" || ko "paste HTML is escaped" "raw markup in page"
hdr "$B/paste/raw/$id" | grep -qi "content-security-policy: default-src 'none'; sandbox" && ok "raw paste is sandboxed" || ko "raw paste sandbox" "missing CSP sandbox"

# --- security headers
H=$(hdr "$B/paste/")
for h in "content-security-policy: default-src 'none'" "x-content-type-options: nosniff" "x-frame-options: DENY" "referrer-policy: no-referrer" "x-request-id:"; do
  grep -qi "$h" <<<"$H" && ok "header $h" || ko "header $h" "missing"; done
grep -qi "jsdelivr\|https://" <<<"$(grep -i content-security-policy <<<"$H")" && ko "CSP has no third-party origins" "found one" || ok "CSP has no third-party origins"
hdr -H 'x-forwarded-proto: https' "$B/" | grep -qi strict-transport-security && ok "HSTS behind https proxy (TRUST_PROXY=1)" || ko "HSTS behind https proxy" "missing (is TRUST_PROXY=1?)"

# --- traversal / injection
for p in '/shaders/../../etc/passwd' '/gradients/%2e%2e/%2e%2e/package.json' '/gradients/..%2f..%2fserver.js' \
         '/paste/vendor/prism-1.29.0/..%2f..%2fserver.js' '/shaders/lib/..%2f..%2fserver.js' '/paste/raw/..%2F..%2Fetc%2Fpasswd' \
         '/gradients/dots/%00studio.js' '/shaders/%5c..%5cserver.js'; do
  r=$(curl -s --path-as-is -w '\n%{http_code}' "$B$p"); c=${r##*$'\n'}
  if [[ "$c" =~ ^(400|404)$ ]] && ! grep -q 'root:\|use strict' <<<"$r"; then ok "traversal $p -> $c"; else ko "traversal $p" "got $c"; fi
done
expect 405 "POST to static app" -X POST --data x "$B/shaders/"
expect 405 "DELETE landing" -X DELETE "$B/"
expect 405 "PUT paste api" -X PUT "$B/paste/api/paste"
expect 414 "very long URI" "$B/$(head -c 4000 </dev/zero | tr '\0' a)"
expect 413 "oversized JSON paste" -X POST -H 'content-type: application/json' -H 'content-length: 99999999' --data '{}' "$B/paste/api/paste"
expect 400 "malformed JSON" -X POST -H 'content-type: application/json' --data '{nope' "$B/paste/api/paste"
expect 400 "bad expiry" -X POST -H 'content-type: application/json' --data '{"content":"x","expiry":"forever"}' "$B/paste/api/paste"
expect 404 "invalid paste id" "$B/paste/p/../../x"
expect "400|404" "asterisk request target" --request-target '*' "$B/"
expect "431|400" "huge header" -H "X-Big: $(head -c 20000 </dev/zero | tr '\0' a)" "$B/"

# --- caching + compression
E=$(hdr "$B/gradients/app.js" | tr -d '\r' | sed -n 's/^[Ee][Tt]ag: //p')
expect 304 "If-None-Match revalidation" -H "if-none-match: $E" "$B/gradients/app.js"
hdr -H 'accept-encoding: br' "$B/gradients/app.js" | grep -qi "content-encoding: br" && ok "brotli for text assets" || ko "brotli" "no content-encoding: br"
hdr -H 'accept-encoding: gzip' "$B/shaders/api/library" | grep -qi "content-encoding: gzip" && ok "gzip for JSON" || ko "gzip" "missing"
hdr "$B/gradients/style.css" | grep -qi "content-type: text/css" && ok "MIME text/css" || ko "MIME css" "wrong"

echo; echo "smoke: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
