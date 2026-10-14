"""Stage 1: face detection. Default part: YuNet (MIT) via cv2.FaceDetectorYN."""

from __future__ import annotations

import cv2
import numpy as np

from .types import Face


class YuNetDetector:
    name = "yunet"
    license = "MIT"

    def __init__(self, model_path: str, score_threshold: float = 0.6, max_side: int = 1280):
        self._det = cv2.FaceDetectorYN.create(str(model_path), "", (320, 320), score_threshold)
        self.max_side = max_side

    def detect(self, image: np.ndarray) -> list[Face]:
        h, w = image.shape[:2]
        scale = min(1.0, self.max_side / max(h, w))
        img = cv2.resize(image, (int(w * scale), int(h * scale))) if scale < 1 else image
        self._det.setInputSize((img.shape[1], img.shape[0]))
        _, rows = self._det.detect(img)
        faces = []
        for r in rows if rows is not None else []:
            faces.append(Face(bbox=(r[:4] / scale).astype(np.float32),
                              kps=(r[4:14].reshape(5, 2) / scale).astype(np.float32), score=float(r[14])))
        return sorted(faces, key=lambda f: -float(f.bbox[2] * f.bbox[3]))
