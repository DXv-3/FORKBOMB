"""Stage 5: face masking.

* ``LandmarkEllipseMasker`` (default): landmark-driven feathered ellipse. Original code, MIT, no weights.
* ``SegmenterMasker`` (optional): MediaPipe selfie-multiclass segmenter (model Apache-2.0 per its model
  card), using the face-skin class and run with LiteRT (Apache-2.0). It excludes hair and occluders
  better than the ellipse.

BiSeNet face-parsing is NOT offered: its code is MIT, but the public weights are trained on CelebAMask-HQ
(non-commercial dataset terms).
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


class SegmenterMasker:
    """Face-skin mask from the MediaPipe multiclass segmenter, intersected with a widened landmark ellipse."""

    name = "mp-multiclass"
    FACE_SKIN = 3

    def __init__(self, model_path: str | None = None, interpreter=None, feather: float = 0.08):
        if interpreter is None:
            from ai_edge_litert.interpreter import Interpreter  # optional extra: fbswap[parser]

            interpreter = Interpreter(model_path=str(model_path))
            interpreter.allocate_tensors()
        self.it = interpreter
        self.inp = self.it.get_input_details()[0]
        self.out = self.it.get_output_details()[0]
        self.size = int(self.inp["shape"][1])
        self.gate = LandmarkEllipseMasker(scale=1.35, feather=0.0)
        self.feather = feather

    def mask(self, image: np.ndarray, face: Face) -> np.ndarray:
        h, w = image.shape[:2]
        x, y, bw, bh = (float(v) for v in face.bbox)
        cx, cy, side = x + bw / 2, y + bh / 2, max(bw, bh) * 1.8
        x0, y0 = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
        x1, y1 = int(min(w, cx + side / 2)), int(min(h, cy + side / 2))
        out = np.zeros((h, w), np.float32)
        if x1 - x0 < 4 or y1 - y0 < 4:
            return out
        crop = cv2.resize(image[y0:y1, x0:x1], (self.size, self.size))[:, :, ::-1].astype(np.float32) / 255.0
        self.it.set_tensor(self.inp["index"], crop[None])
        self.it.invoke()
        logits = self.it.get_tensor(self.out["index"])[0]
        skin = (logits.argmax(-1) == self.FACE_SKIN).astype(np.float32)
        out[y0:y1, x0:x1] = cv2.resize(skin, (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
        out *= self.gate.mask(image, face) > 0.5
        eye_d = float(np.linalg.norm(face.kps[1] - face.kps[0]))
        k = int(max(3, eye_d * self.feather * 2)) | 1
        return cv2.GaussianBlur(out, (k, k), 0)
