"""Stage 5: face masking. Default: landmark-driven feathered ellipse (original code, MIT, no weights).

A semantic parser (e.g. BiSeNet face-parsing, MIT code) can be plugged in via the Masker protocol;
note its public weights are trained on CelebAMask-HQ (non-commercial dataset terms).
"""

from __future__ import annotations

import cv2
import numpy as np

from .types import Face


class LandmarkEllipseMasker:
    name = "landmark-ellipse"

    def __init__(self, scale: float = 1.0, feather: float = 0.12):
        self.scale, self.feather = scale, feather

    def mask(self, image: np.ndarray, face: Face) -> np.ndarray:
        h, w = image.shape[:2]
        k = face.kps
        eyes_c, mouth_c = k[:2].mean(0), k[3:].mean(0)
        eye_d = float(np.linalg.norm(k[1] - k[0]))
        center = (eyes_c * 0.45 + mouth_c * 0.55)
        vec = mouth_c - eyes_c
        angle = float(np.degrees(np.arctan2(vec[1], vec[0]))) - 90.0
        axes = (max(1, int(eye_d * 1.05 * self.scale)), max(1, int(eye_d * 1.35 * self.scale)))
        m = np.zeros((h, w), np.float32)
        cv2.ellipse(m, (int(center[0]), int(center[1])), axes, angle, 0, 360, 1.0, -1)
        k_sz = int(max(3, eye_d * self.feather * 2)) | 1
        return cv2.GaussianBlur(m, (k_sz, k_sz), 0)
