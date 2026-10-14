"""Stage 3: identity embedding. Default part: SFace (Apache-2.0) via cv2.FaceRecognizerSF."""

from __future__ import annotations

import cv2
import numpy as np

from .types import Face


class SFaceEmbedder:
    name = "sface"
    license = "Apache-2.0"

    def __init__(self, model_path: str):
        self._rec = cv2.FaceRecognizerSF.create(str(model_path), "")

    def embed(self, image: np.ndarray, face: Face) -> np.ndarray:
        row = np.concatenate([face.bbox, face.kps.reshape(-1), [face.score]]).astype(np.float32)[None]
        feat = self._rec.feature(self._rec.alignCrop(image, row)).reshape(-1)
        return feat / (np.linalg.norm(feat) + 1e-9)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
