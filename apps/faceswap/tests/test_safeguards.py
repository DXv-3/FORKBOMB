import io
import json
import logging

import numpy as np
import pytest
from PIL import Image

from conftest import EmptyDetector, MockDetector
from fbswap import cli, safeguards
from fbswap.pipeline import NoFaceFound, Pipeline, imread
from fbswap.web import make_handler, parse_multipart


def test_consent_required_in_pipeline(imgs):
    pipe = Pipeline(detector=MockDetector())
    for bad in (False, None, "yes", 1):
        with pytest.raises(safeguards.ConsentRequired):
            pipe.run_image(imgs[0], imgs[1], consent=bad)


def test_consent_required_in_cli(tmp_path, capsys):
    rc = cli.main(["image", "--source", "a.jpg", "--target", "b.jpg", "-o", str(tmp_path / "o.png")])
    assert rc == 2 and "Consent attestation required" in capsys.readouterr().err
    assert not (tmp_path / "o.png").exists()


def test_cli_parser_has_no_watermark_off_switch():
    with pytest.raises(SystemExit):
        cli.main(["image", "--source", "a", "--target", "b", "-o", "o.png", "--i-have-consent", "--no-watermark"])


def test_remote_inputs_refused():
    for u in ("http://x/y.jpg", "https://x/y.jpg", "www.example.com/a.png", "data:image/png;base64,AA"):
        with pytest.raises(safeguards.RemoteInputRefused):
            imread(u)


def test_no_face_raises(imgs):
    with pytest.raises(NoFaceFound):
        Pipeline(detector=EmptyDetector()).run_image(imgs[0], imgs[1], consent=True)


def test_watermark_visible(imgs):
    img = np.full((300, 400, 3), 200, np.uint8)
    out = safeguards.watermark(img)
    x0, y0, x1, y1 = safeguards.watermark_box(img.shape)
    region = out[y0:y1, x0:x1]
    assert (region < 10).mean() > 0.4 and (region > 240).any()  # black banner with white text
    assert np.array_equal(out[:50, :50], img[:50, :50])
    out2 = Pipeline(detector=MockDetector()).run_image(imgs[0], imgs[1], consent=True)
    bx = safeguards.watermark_box(out2.shape)
    assert (out2[bx[1]:bx[3], bx[0]:bx[2]] > 240).any()


@pytest.mark.parametrize("ext", ["png", "jpg"])
def test_metadata_marks_output_as_synthetic(tmp_path, imgs, ext):
    p = safeguards.save_image(tmp_path / f"o.{ext}", safeguards.watermark(imgs[1]), {"swapper": "classic"})
    marks = safeguards.read_marks(p)
    assert "AI-GENERATED" in marks["exif_description"]
    assert marks["software"].startswith("fbswap/")
    assert marks["xmp_digital_source_type"] is True
    if ext == "png":
        assert marks["png_ai_generated"] == "true"
    side = marks["sidecar"]
    assert side["assertions"][1]["data"]["ai_generated"] is True
    import hashlib

    assert side["output_sha256"] == hashlib.sha256(p.read_bytes()).hexdigest()


def test_logs_never_contain_image_data(imgs, caplog):
    caplog.set_level(logging.DEBUG, logger="fbswap")
    Pipeline(detector=MockDetector()).run_image(imgs[0], imgs[1], consent=True)
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert len(text) < 2000 and "[[" not in text and "PNG" not in text


class _FakeReq:
    def __init__(self, raw):
        self.raw = raw

    def makefile(self, mode, *a, **k):
        return io.BytesIO(self.raw) if "r" in mode else io.BytesIO()


def _multipart(fields):
    b = "XXbnd"
    parts = []
    for k, v in fields.items():
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{k}"\r\n'
                     f"Content-Type: application/octet-stream\r\n\r\n".encode() + v + b"\r\n")
    return f"multipart/form-data; boundary={b}", b"".join(parts) + f"--{b}--\r\n".encode()


def _png(img):
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, format="PNG")
    return buf.getvalue()


def _post(handler_cls, ctype, body):
    raw = (f"POST /api/swap HTTP/1.1\r\nHost: x\r\nContent-Type: {ctype}\r\n"
           f"Content-Length: {len(body)}\r\n\r\n").encode() + body
    out = io.BytesIO()

    class H(handler_cls):
        def setup(self):
            self.rfile, self.wfile = io.BytesIO(raw), out

        def finish(self):
            pass

    H(None, ("127.0.0.1", 0), None)
    head, _, payload = out.getvalue().partition(b"\r\n\r\n")
    return int(head.split()[1]), payload


def test_web_enforces_consent_and_marks_output(imgs):
    h = make_handler(lambda: Pipeline(detector=MockDetector()))
    ctype, body = _multipart({"source": _png(imgs[0]), "target": _png(imgs[1])})
    assert _post(h, ctype, body)[0] == 403
    ctype, body = _multipart({"source": _png(imgs[0]), "target": _png(imgs[1]), "consent": b"yes"})
    code, payload = _post(h, ctype, body)
    assert code == 200 and payload[:4] == b"\x89PNG"
    assert b"trainedAlgorithmicMedia" in payload and b"AI-Generated" in payload


def test_web_rejects_non_multipart_and_garbage(imgs):
    h = make_handler(lambda: Pipeline(detector=MockDetector()))
    assert _post(h, "application/json", b"{}")[0] == 415
    ctype, body = _multipart({"source": b"nope", "target": b"nope", "consent": b"yes"})
    code, payload = _post(h, ctype, body)
    assert code == 422 and b"Traceback" not in payload


def test_parse_multipart():
    ctype, body = _multipart({"a": b"1", "b": b"\x00\xff"})
    assert parse_multipart(ctype, body) == {"a": b"1", "b": b"\x00\xff"}


def test_web_page_has_consent_checkbox():
    from fbswap.web import PAGE

    assert 'name="consent"' in PAGE and "required" in PAGE and json.dumps(True)
