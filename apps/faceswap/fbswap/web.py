"""Tiny local web UI (stdlib only). Binds 127.0.0.1 by default. Images are processed in memory and
never written to disk or logged."""

from __future__ import annotations

import logging
from email.parser import BytesParser
from email.policy import HTTP
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np

from . import safeguards

log = logging.getLogger("fbswap")
MAX_BYTES = 20 * 1024 * 1024

PAGE = f"""<!doctype html><html lang="en"><meta charset="utf-8"><title>fbswap</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font:16px system-ui;max-width:720px;margin:2rem auto;padding:0 1rem}}img{{max-width:100%}}</style>
<h1>fbswap <small>(local only)</small></h1>
<p>Outputs are watermarked <b>AI-GENERATED</b> and tagged as synthetic. Do not use for non-consensual,
sexual, minor-involving, impersonation or fraudulent content.</p>
<form method="post" action="/api/swap" enctype="multipart/form-data">
<p><label>Source face <input type="file" name="source" accept="image/*" required></label></p>
<p><label>Target image <input type="file" name="target" accept="image/*" required></label></p>
<p><label><input type="checkbox" name="consent" value="yes" required> {safeguards.CONSENT_TEXT}</label></p>
<button>Swap</button></form></html>"""


def parse_multipart(ctype: str, body: bytes) -> dict[str, bytes]:
    msg = BytesParser(policy=HTTP).parsebytes(b"Content-Type: " + ctype.encode() + b"\r\n\r\n" + body)
    out = {}
    if msg.is_multipart():
        for part in msg.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if name:
                out[name] = part.get_payload(decode=True) or b""
    return out


def decode(b: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("bad image")
    return img


def make_handler(get_pipe):
    class H(BaseHTTPRequestHandler):
        server_version = "fbswap"
        sys_version = ""

        def log_message(self, fmt, *args):  # no request bodies or images in logs
            log.info("%s %s", self.command, self.path.split("?")[0])

        def _send(self, code, body: bytes, ctype="text/plain; charset=utf-8"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; "
                             "img-src data:; form-action 'self'")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                return self._send(200, PAGE.encode(), "text/html; charset=utf-8")
            if self.path == "/healthz":
                return self._send(200, b"ok")
            self._send(404, b"not found")

        def do_POST(self):
            if self.path != "/api/swap":
                return self._send(404, b"not found")
            try:
                n = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                n = -1
            if n <= 0 or n > MAX_BYTES:
                return self._send(413, b"payload too large or missing")
            ctype = self.headers.get("Content-Type", "")
            if not ctype.startswith("multipart/form-data"):
                return self._send(415, b"multipart/form-data required")
            fields = parse_multipart(ctype, self.rfile.read(n))
            if fields.get("consent", b"").strip() != b"yes":
                return self._send(403, b"consent attestation required")
            try:
                pipe = get_pipe()
                out = pipe.run_image(decode(fields.get("source", b"")), decode(fields.get("target", b"")),
                                     consent=True)
                return self._send(200, safeguards.encode_image(out, pipe.parts(), "png"), "image/png")
            except Exception as e:  # generic errors only; never echo internals
                log.warning("swap failed: %s", type(e).__name__)
                return self._send(422, b"could not process: no face found or bad image")

        def do_PUT(self):
            self._send(405, b"method not allowed")

        do_DELETE = do_PATCH = do_PUT

    return H


def serve(host: str = "127.0.0.1", port: int = 3901, get_pipe=None):  # pragma: no cover - blocking
    if get_pipe is None:
        from .pipeline import build

        cache = {}

        def get_pipe():
            if "p" not in cache:
                cache["p"] = build()
            return cache["p"]
    httpd = ThreadingHTTPServer((host, port), make_handler(get_pipe))
    print(f"fbswap web UI on http://{host}:{port}")
    httpd.serve_forever()
