"""Stage 4: the swapper / generator.

* ``ClassicWarpSwapper`` (default, MIT, no weights): similarity-warps the source face onto the
  target's 5-point geometry. Fully commercial-safe, lower fidelity (no expression transfer).
* ``InswapperSwapper`` (RESEARCH-ONLY): runs InsightFace ``inswapper_128.onnx``. Weights are
  non-commercial; constructing it requires the license to have been accepted.
"""

from __future__ import annotations

import cv2
import numpy as np

from . import models
from .align import align_crop, similarity
from .types import Face


class ClassicWarpSwapper:
    name = "classic"
    license = "MIT (original code, no weights)"

    def swap(self, source_img, source: Face, target_img, target: Face):
        h, w = target_img.shape[:2]
        m = similarity(source.kps, target.kps)
        warped = cv2.warpAffine(source_img, m, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
        cover = cv2.warpAffine(np.ones(source_img.shape[:2], np.float32), m, (w, h), borderValue=0)
        return warped, cover


class ArcFaceOnnxEmbedder:
    """Generic 112x112 ArcFace ONNX embedder (e.g. buffalo_l/w600k_r50.onnx, research-only)."""

    name = "arcface-onnx"

    def __init__(self, model_path: str, session=None):
        if session is None:
            import onnxruntime as ort

            session = ort.InferenceSession(str(model_path), providers=models.providers())
        self.sess = session

    def embed(self, image, face: Face) -> np.ndarray:
        crop, _ = align_crop(image, face.kps, 112)
        blob = ((crop[..., ::-1].astype(np.float32) - 127.5) / 127.5).transpose(2, 0, 1)[None]
        feat = self.sess.run(None, {self.sess.get_inputs()[0].name: blob})[0].reshape(-1)
        return feat / (np.linalg.norm(feat) + 1e-9)


class InswapperSwapper:
    name = "inswapper_128"
    license = models.REGISTRY["inswapper_128"].license

    def __init__(self, model_path: str, accepted=(), session=None, emap=None):
        models.check_license("inswapper_128", accepted)
        if session is None:
            import onnxruntime as ort

            session = ort.InferenceSession(str(model_path), providers=models.providers())
        if emap is None:
            import onnx  # optional extra: pip install fbswap[research]

            emap = onnx.numpy_helper.to_array(onnx.load(str(model_path)).graph.initializer[-1])
        self.sess, self.emap = session, np.asarray(emap, np.float32)
        ins = self.sess.get_inputs()
        self.in_target, self.in_source = ins[0].name, ins[1].name

    def swap(self, source_img, source: Face, target_img, target: Face):
        if source.embedding is None:
            raise ValueError("inswapper needs an ArcFace embedding on the source face")
        crop, m = align_crop(target_img, target.kps, 128)
        blob = (crop[..., ::-1].astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        latent = source.embedding.reshape(1, -1).astype(np.float32) @ self.emap
        latent /= np.linalg.norm(latent) + 1e-9
        pred = self.sess.run(None, {self.in_target: blob, self.in_source: latent})[0]
        face = (pred[0].transpose(1, 2, 0) * 255).clip(0, 255).astype(np.uint8)[..., ::-1]
        h, w = target_img.shape[:2]
        inv = cv2.invertAffineTransform(m)
        warped = cv2.warpAffine(face, inv, (w, h), borderValue=0)
        cover = cv2.warpAffine(np.ones((128, 128), np.float32), inv, (w, h), borderValue=0)
        return warped, cover
