"""Model registry + runtime fetcher with license gating.

Weights are NEVER vendored in the repo. They are downloaded from their official sources into
``$FBSWAP_HOME`` (default ``~/.cache/fbswap``) and verified by SHA-256 when a pin is known.
Non-commercial models require an explicit ``accept_license=[name]`` (CLI: ``--accept-license name``).
"""

from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ModelSpec:
    name: str
    stage: str
    filename: str
    license: str
    commercial_ok: bool
    url: str | None
    sha256: str | None
    license_url: str
    note: str = ""

    @property
    def label(self) -> str:
        return "permissive" if self.commercial_ok else "RESEARCH-ONLY (non-commercial)"


REGISTRY: dict[str, ModelSpec] = {
    "yunet": ModelSpec(
        name="yunet", stage="detect", filename="face_detection_yunet_2023mar.onnx",
        license="MIT", commercial_ok=True,
        url="https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        sha256="8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
        license_url="https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE",
        note="YuNet (Shiqi Yu), 5 landmarks. Default detector.",
    ),
    "sface": ModelSpec(
        name="sface", stage="embed", filename="face_recognition_sface_2021dec.onnx",
        license="Apache-2.0", commercial_ok=True,
        url="https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        sha256="0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
        license_url="https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE",
        note="SFace 128-d identity embedding. Default embedder.",
    ),
    "mp_multiclass": ModelSpec(
        name="mp_multiclass", stage="mask", filename="selfie_multiclass_256x256.tflite",
        license="Apache-2.0", commercial_ok=True,
        url="https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/"
            "selfie_multiclass_256x256.tflite",
        sha256="c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0",
        license_url="https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf",
        note="MediaPipe selfie multiclass segmenter (face-skin class). Optional: pip install fbswap[parser].",
    ),
    "buffalo_l": ModelSpec(
        name="buffalo_l", stage="embed", filename="buffalo_l.zip",
        license="InsightFace models: non-commercial research only", commercial_ok=False,
        url="https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip",
        sha256=None,
        license_url="https://github.com/deepinsight/insightface#license",
        note="ArcFace w600k_r50 + SCRFD. Needed only by the research-only inswapper path.",
    ),
    "inswapper_128": ModelSpec(
        name="inswapper_128", stage="swap", filename="inswapper_128.onnx",
        license="InsightFace: non-commercial research only; commercial licensing via contact@insightface.ai",
        commercial_ok=False, url=None, sha256=None,
        license_url="https://github.com/deepinsight/insightface#license",
        note="No official public download URL exists; obtain from InsightFace and register with --path.",
    ),
}

DEFAULT_SET = [n for n, s in REGISTRY.items() if s.commercial_ok]


class LicenseNotAccepted(PermissionError):
    pass


class ModelUnavailable(FileNotFoundError):
    pass


def home() -> Path:
    return Path(os.environ.get("FBSWAP_HOME", Path.home() / ".cache" / "fbswap"))


def model_path(name: str) -> Path:
    return home() / REGISTRY[name].filename


def check_license(name: str, accepted: list[str] | tuple[str, ...] = ()) -> ModelSpec:
    spec = REGISTRY[name]
    if not spec.commercial_ok and name not in accepted:
        raise LicenseNotAccepted(
            f"{name} is {spec.label}: {spec.license} ({spec.license_url}). "
            f"Re-run with --accept-license {name} only if your use complies."
        )
    return spec


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(name: str, accepted: list[str] | tuple[str, ...] = (), src_path: str | None = None,
          opener=urllib.request.urlopen, log=print) -> Path:
    """Download (or register a local copy of) one model after license checks."""
    spec = check_license(name, accepted)
    log(f"[{spec.label}] {name}: {spec.license} -> {spec.license_url}")
    dest = model_path(name)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src_path:
        shutil.copyfile(src_path, dest)
    elif dest.exists() and (spec.sha256 is None or sha256_file(dest) == spec.sha256):
        return dest
    elif spec.url is None:
        raise ModelUnavailable(f"{name} has no official download URL. {spec.note}")
    else:
        fd, tmp = tempfile.mkstemp(dir=dest.parent, suffix=".part")
        try:
            with os.fdopen(fd, "wb") as out, opener(spec.url) as resp:
                shutil.copyfileobj(resp, out)
            got = sha256_file(Path(tmp))
            if spec.sha256 and got != spec.sha256:
                raise ValueError(f"{name}: sha256 mismatch (got {got})")
            os.replace(tmp, dest)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
    if spec.sha256 is None:
        log(f"{name}: no pinned hash; sha256={sha256_file(dest)}")
    return dest


def require(name: str, accepted: list[str] | tuple[str, ...] = ()) -> Path:
    check_license(name, accepted)
    p = model_path(name)
    if not p.exists():
        raise ModelUnavailable(f"{name} not found at {p}. Run: fbswap models fetch {name}")
    return p


def providers() -> list[str]:
    import onnxruntime as ort

    avail = ort.get_available_providers()
    return [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in avail] or avail
