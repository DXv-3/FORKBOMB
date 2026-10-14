"""Stage 2: landmarks -> alignment. Pure geometry (original code, MIT)."""

from __future__ import annotations

import cv2
import numpy as np

# Standard 112x112 five-point template (widely published ArcFace reference coordinates).
TEMPLATE_112 = np.array(
    [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]],
    dtype=np.float32,
)


def similarity(src_pts: np.ndarray, dst_pts: np.ndarray) -> np.ndarray:
    m, _ = cv2.estimateAffinePartial2D(src_pts.astype(np.float32), dst_pts.astype(np.float32),
                                       method=cv2.LMEDS)
    if m is None:
        raise ValueError("could not estimate alignment")
    return m


def align_crop(image: np.ndarray, kps: np.ndarray, size: int = 112) -> tuple[np.ndarray, np.ndarray]:
    """Return (crop, 2x3 matrix image->crop)."""
    m = similarity(kps, TEMPLATE_112 * (size / 112.0))
    return cv2.warpAffine(image, m, (size, size), borderValue=0), m


class EMASmoother:
    """Temporal smoothing of landmarks for video (reduces jitter)."""

    def __init__(self, alpha: float = 0.6):
        self.alpha, self.state = alpha, None

    def __call__(self, kps: np.ndarray) -> np.ndarray:
        if self.state is None or np.abs(self.state - kps).max() > 40:  # cut / new face: reset
            self.state = kps.astype(np.float32).copy()
        else:
            self.state = self.alpha * kps + (1 - self.alpha) * self.state
        return self.state.copy()
