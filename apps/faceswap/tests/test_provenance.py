import io
import os
import stat
import subprocess
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from fbswap import cli, models, provenance, safeguards


def _signed_png(tmp_path, img=None):
    img = np.full((64, 96, 3), 120, np.uint8) if img is None else img
    return safeguards.save_image(tmp_path / "o.png", safeguards.watermark(img), {"swapper": "classic"})


def test_dev_credentials_generated_at_runtime_outside_repo():
    creds = provenance.credentials()
    assert creds.dev and b"BEGIN CERTIFICATE" in creds.chain_pem and creds.chain_pem.count(b"BEGIN CERTIFICATE") == 2
    key = models.home() / "c2pa-dev" / "signer.key"
    assert key.exists() and stat.S_IMODE(os.stat(key).st_mode) == 0o600
    repo = Path(__file__).resolve().parents[3]
    assert repo not in key.resolve().parents
    assert not (models.home() / "c2pa-dev" / "ca.key").exists()  # CA key is discarded


def test_no_keys_or_certs_committed():
    repo = Path(__file__).resolve().parents[3]
    try:
        files = subprocess.run(["git", "ls-files"], cwd=repo, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("not a git checkout")
    bad = [f for f in files.splitlines() if f.endswith((".key", ".pem", ".p12", ".pfx"))]
    assert bad == []


def test_signature_valid_and_trusted(tmp_path):
    v = provenance.verify_file(_signed_png(tmp_path))
    assert v["state"] == "Trusted" and v["signature_valid"] and v["ai_generated"]
    assert "fbswap" in v["claim_generator"]


def test_tampered_pixels_fail_verification(tmp_path):
    p = _signed_png(tmp_path)
    d = bytearray(p.read_bytes())
    i = d.find(b"IDAT") + 40
    d[i] ^= 0xFF
    v = provenance.verify_bytes(bytes(d), "image/png")
    assert v["state"] == "Invalid" and not v["signature_valid"]
    assert "assertion.dataHash.mismatch" in v["failures"]


def test_unsigned_file_reports_missing(tmp_path):
    p = tmp_path / "plain.png"
    Image.new("RGB", (8, 8)).save(p)
    v = provenance.verify_file(p)
    assert v["state"] == "missing" and not v["signature_valid"]


def test_other_machine_sees_valid_but_untrusted(tmp_path, monkeypatch):
    data = _signed_png(tmp_path).read_bytes()
    monkeypatch.setenv("FBSWAP_HOME", str(tmp_path / "elsewhere"))
    monkeypatch.setattr(provenance, "credentials", lambda: (_ for _ in ()).throw(OSError()))
    v = provenance.verify_bytes(data, "image/png")
    assert v["signature_valid"] and not v["trusted"]


def test_inspect_cli_verifies(tmp_path, capsys):
    p = _signed_png(tmp_path)
    assert cli.main(["inspect", str(p)]) == 0
    assert '"Trusted"' in capsys.readouterr().out
    d = bytearray(p.read_bytes())
    d[d.find(b"IDAT") + 40] ^= 0xFF
    bad = tmp_path / "bad.png"
    bad.write_bytes(bytes(d))
    assert cli.main(["inspect", str(bad)]) == 3
    plain = tmp_path / "plain.png"
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, format="PNG")
    plain.write_bytes(buf.getvalue())
    assert cli.main(["inspect", str(plain)]) == 3


def test_manifest_declares_synthetic():
    m = provenance.manifest_definition({"swapper": "classic"}, "t", "image/png")
    act = m["assertions"][0]["data"]["actions"][0]
    assert act["digitalSourceType"].endswith("trainedAlgorithmicMedia")
    assert m["assertions"][1]["data"]["ai_generated"] is True
