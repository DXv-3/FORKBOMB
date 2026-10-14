"""Stage 7: face restoration. Default: none. ``unsharp`` is a weight-free sharpen (MIT).

GFPGAN (Apache-2.0 code), CodeFormer (S-Lab NC) and GPEN (no clear licence) are documented
alternatives; plug one in via the Restorer protocol.
"""

from __future__ import annotations

import cv2
import numpy as np

from .types import Face


class NoopRestorer:
    name = "none"

    def restore(self, image: np.ndarray, face: Face) -> np.ndarray:
        return image


class UnsharpRestorer:
    name = "unsharp"

    def __init__(self, amount: float = 0.6):
        self.amount = amount

    def restore(self, image: np.ndarray, face: Face) -> np.ndarray:
        x, y, w, h = (int(v) for v in face.bbox)
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(image.shape[1], x + w), min(image.shape[0], y + h)
        if x1 <= x0 or y1 <= y0:
            return image
        out = image.copy()
        roi = out[y0:y1, x0:x1]
        blur = cv2.GaussianBlur(roi, (0, 0), 2)
        out[y0:y1, x0:x1] = cv2.addWeighted(roi, 1 + self.amount, blur, -self.amount, 0)
        return out
