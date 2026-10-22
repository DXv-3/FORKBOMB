import hashlib
import io

import numpy as np
import pytest

from fbswap import cli, models
from fbswap.swap import InswapperSwapper
from fbswap.types import Face


def test_default_set_is_permissive_only():
    assert models.DEFAULT_SET == ["yunet", "sface", "mp_multiclass"]
    assert all(models.REGISTRY[n].commercial_ok for n in models.DEFAULT_SET)
    for n in ("inswapper_128", "buffalo_l"):
        assert not models.REGISTRY[n].commercial_ok and "RESEARCH-ONLY" in models.REGISTRY[n].label


def test_noncommercial_requires_accept():
    with pytest.raises(models.LicenseNotAccepted):
        models.check_license("inswapper_128")
    with pytest.raises(models.LicenseNotAccepted):
        models.fetch("buffalo_l", opener=lambda u: pytest.fail("must not download"))
    assert models.check_license("inswapper_128", ["inswapper_128"]).name == "inswapper_128"


def test_inswapper_without_url_needs_manual_path(tmp_path):
    with pytest.raises(models.ModelUnavailable):
        models.fetch("inswapper_128", ["inswapper_128"], log=lambda *_: None)
    f = tmp_path / "m.onnx"
    f.write_bytes(b"x")
    assert models.fetch("inswapper_128", ["inswapper_128"], str(f), log=lambda *_: None).exists()


def test_fetch_verifies_sha(monkeypatch):
    data = b"fake-model"
    spec = models.REGISTRY["yunet"]
    monkeypatch.setitem(models.REGISTRY, "yunet", models.ModelSpec(**{**spec.__dict__, "sha256": "0" * 64}))
    with pytest.raises(ValueError, match="sha256"):
        models.fetch("yunet", opener=lambda u: io.BytesIO(data), log=lambda *_: None)
    assert not models.model_path("yunet").exists()
    good = hashlib.sha256(data).hexdigest()
    monkeypatch.setitem(models.REGISTRY, "yunet", models.ModelSpec(**{**spec.__dict__, "sha256": good}))
    p = models.fetch("yunet", opener=lambda u: io.BytesIO(data), log=lambda *_: None)
    assert p.read_bytes() == data


def test_fetch_prints_license(capsys, monkeypatch):
    spec = models.REGISTRY["sface"]
    monkeypatch.setitem(models.REGISTRY, "sface", models.ModelSpec(**{**spec.__dict__, "sha256": None}))
    models.fetch("sface", opener=lambda u: io.BytesIO(b"m"))
    out = capsys.readouterr().out
    assert "Apache-2.0" in out and "permissive" in out


def test_cli_models_list_labels(capsys):
    assert cli.main(["models", "list"]) == 0
    out = capsys.readouterr().out
    assert "RESEARCH-ONLY" in out and "inswapper_128" in out


def test_cli_inswapper_gated(capsys):
    rc = cli.main(["image", "--source", "a.jpg", "--target", "b.jpg", "-o", "o.png", "--i-have-consent",
                   "--swapper", "inswapper_128"])
    assert rc == 2


class _Inp:
    def __init__(self, n):
        self.name = n


class _Sess:
    def get_inputs(self):
        return [_Inp("target"), _Inp("source")]

    def run(self, _, feeds):
        assert feeds["target"].shape == (1, 3, 128, 128) and feeds["source"].shape == (1, 512)
        return [feeds["target"]]


def test_inswapper_gated_then_runs_with_mock():
    with pytest.raises(models.LicenseNotAccepted):
        InswapperSwapper("x", session=_Sess(), emap=np.eye(512))
    sw = InswapperSwapper("x", accepted=["inswapper_128"], session=_Sess(), emap=np.eye(512))
    from conftest import KPS, synth_face_img

    img = synth_face_img()
    f = Face(bbox=np.zeros(4), kps=KPS(), embedding=np.ones(512, np.float32))
    out, cover = sw.swap(img, f, img, f)
    assert out.shape == img.shape and cover.max() > 0.99
