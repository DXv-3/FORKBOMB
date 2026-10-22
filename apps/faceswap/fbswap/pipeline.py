"""Pipeline: wires stage parts together. Every stage is injectable so parts are swappable."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import cv2
import numpy as np

from . import models, safeguards
from .blend import FeatherBlender, PoissonBlender
from .embed import cosine
from .mask import LandmarkEllipseMasker
from .restore import NoopRestorer, UnsharpRestorer
from .swap import ClassicWarpSwapper
from .types import Face

log = logging.getLogger("fbswap")


class NoFaceFound(ValueError):
    pass


@dataclass
class Pipeline:
    detector: object
    swapper: object = field(default_factory=ClassicWarpSwapper)
    masker: object = field(default_factory=LandmarkEllipseMasker)
    blender: object = field(default_factory=FeatherBlender)
    restorer: object = field(default_factory=NoopRestorer)
    embedder: object | None = None
    swap_embedder: object | None = None  # embedder the swapper needs (ArcFace for inswapper)

    def parts(self) -> dict:
        return {k: getattr(getattr(self, k), "name", type(getattr(self, k)).__name__)
                for k in ("detector", "swapper", "masker", "blender", "restorer", "embedder")
                if getattr(self, k) is not None}

    def source_face(self, source_img: np.ndarray) -> Face:
        faces = self.detector.detect(source_img)
        if not faces:
            raise NoFaceFound("no face found in source")
        face = faces[0]
        if self.swap_embedder is not None:
            face.embedding = self.swap_embedder.embed(source_img, face)
        elif self.embedder is not None:
            face.embedding = self.embedder.embed(source_img, face)
        return face

    def swap_frame(self, source_img: np.ndarray, src: Face, target_img: np.ndarray, *,
                   all_faces: bool = False, smoother=None) -> np.ndarray:
        faces = self.detector.detect(target_img)
        if not faces:
            return target_img
        out = target_img
        for tgt in faces if all_faces else faces[:1]:
            if smoother is not None:
                tgt.kps = smoother(tgt.kps)
            swapped, cover = self.swapper.swap(source_img, src, out, tgt)
            mask = self.masker.mask(out, tgt) * np.clip(cover, 0, 1)
            out = self.blender.blend(out, swapped, mask)
            out = self.restorer.restore(out, tgt)
        return out

    def run_image(self, source_img: np.ndarray, target_img: np.ndarray, *, consent: bool,
                  all_faces: bool = False) -> np.ndarray:
        safeguards.require_consent(consent)
        t0 = time.perf_counter()
        src = self.source_face(source_img)
        out = self.swap_frame(source_img, src, target_img, all_faces=all_faces)
        if self.embedder is not None and src.embedding is not None and self.swap_embedder is None:
            res = self.detector.detect(out)
            if res:
                log.info("identity similarity to source: %.3f", cosine(src.embedding, self.embedder.embed(out, res[0])))
        log.info("image swap done in %.0f ms (%dx%d), parts=%s", (time.perf_counter() - t0) * 1000,
                 target_img.shape[1], target_img.shape[0], self.parts())
        return safeguards.watermark(out)


def build(swapper: str = "classic", blender: str = "feather", restorer: str = "none",
          accept: tuple[str, ...] = (), detector=None, masker: str = "ellipse") -> Pipeline:
    """Build a pipeline from registry models. Default = fully permissive set."""
    from .detect import YuNetDetector
    from .embed import SFaceEmbedder

    det = detector or YuNetDetector(str(models.require("yunet")))
    emb = SFaceEmbedder(str(models.require("sface"))) if models.model_path("sface").exists() else None
    blend_part = {"feather": FeatherBlender, "poisson": PoissonBlender}[blender]()
    rest_part = {"none": NoopRestorer, "unsharp": UnsharpRestorer}[restorer]()
    swap_emb = None
    if swapper == "classic":
        sw = ClassicWarpSwapper()
    elif swapper == "inswapper_128":
        import zipfile

        from .swap import ArcFaceOnnxEmbedder, InswapperSwapper

        sw = InswapperSwapper(str(models.require("inswapper_128", accept)), accepted=accept)
        z = models.require("buffalo_l", accept)
        arc = z.parent / "buffalo_l" / "w600k_r50.onnx"
        if not arc.exists():
            with zipfile.ZipFile(z) as zf:
                member = next(n for n in zf.namelist() if n.endswith("w600k_r50.onnx"))
                arc.parent.mkdir(exist_ok=True)
                arc.write_bytes(zf.read(member))
        swap_emb = ArcFaceOnnxEmbedder(str(arc))
    else:
        raise ValueError(f"unknown swapper {swapper}")
    if masker == "ellipse":
        mask_part = LandmarkEllipseMasker()
    elif masker == "parser":
        from .mask import SegmenterMasker

        mask_part = SegmenterMasker(str(models.require("mp_multiclass")))
    else:
        raise ValueError(f"unknown masker {masker}")
    return Pipeline(detector=det, swapper=sw, masker=mask_part, blender=blend_part, restorer=rest_part,
                    embedder=emb, swap_embedder=swap_emb)


def imread(path: str) -> np.ndarray:
    safeguards.local_only(path)
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"cannot read image: {path}")
    return img
