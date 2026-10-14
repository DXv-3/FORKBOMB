"""Stage 6: colour transfer + blending (original code, MIT). Reinhard LAB transfer, feather or Poisson."""

from __future__ import annotations

import cv2
import numpy as np


def color_transfer(src: np.ndarray, ref: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Match src's LAB mean/std to ref inside mask (Reinhard et al. 2001)."""
    sel = mask > 0.5
    if sel.sum() < 10:
        return src
    s = cv2.cvtColor(src, cv2.COLOR_BGR2LAB).astype(np.float32)
    r = cv2.cvtColor(ref, cv2.COLOR_BGR2LAB).astype(np.float32)
    for c in range(3):
        sm, ss = s[..., c][sel].mean(), s[..., c][sel].std() + 1e-6
        rm, rs = r[..., c][sel].mean(), r[..., c][sel].std() + 1e-6
        s[..., c] = (s[..., c] - sm) * (rs / ss) + rm
    return cv2.cvtColor(s.clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


class FeatherBlender:
    name = "feather"

    def __init__(self, color: bool = True):
        self.color = color

    def blend(self, target_img, swapped, mask):
        if self.color:
            swapped = color_transfer(swapped, target_img, mask)
        a = mask[..., None].astype(np.float32)
        return (swapped * a + target_img * (1 - a)).clip(0, 255).astype(np.uint8)


class PoissonBlender:
    name = "poisson"

    def __init__(self, color: bool = True):
        self.color = color

    def blend(self, target_img, swapped, mask):
        if self.color:
            swapped = color_transfer(swapped, target_img, mask)
        m = (mask > 0.5).astype(np.uint8) * 255
        ys, xs = np.nonzero(m)
        if len(xs) < 10:
            return target_img.copy()
        center = (int((xs.min() + xs.max()) / 2), int((ys.min() + ys.max()) / 2))
        try:
            return cv2.seamlessClone(swapped, target_img, m, center, cv2.NORMAL_CLONE)
        except cv2.error:
            return FeatherBlender(color=False).blend(target_img, swapped, mask)
