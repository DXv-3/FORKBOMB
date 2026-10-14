"""Stage 8: video frame pipeline with temporal landmark smoothing, and the live webcam path."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import cv2

from . import safeguards
from .align import EMASmoother

log = logging.getLogger("fbswap")


def run_video(pipe, source_img, in_path: str, out_path: str, *, consent: bool, all_faces=False,
              max_frames: int | None = None) -> Path:
    safeguards.require_consent(consent)
    safeguards.local_only(in_path)
    cap = cv2.VideoCapture(str(in_path))
    if not cap.isOpened():
        raise ValueError(f"cannot open video: {in_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    src = pipe.source_face(source_img)
    smoother, n, t0 = EMASmoother(), 0, time.perf_counter()
    try:
        while max_frames is None or n < max_frames:
            ok, frame = cap.read()
            if not ok:
                break
            out = pipe.swap_frame(source_img, src, frame, all_faces=all_faces, smoother=smoother)
            writer.write(safeguards.watermark(out))
            n += 1
    finally:
        cap.release()
        writer.release()
    Path(str(out_path) + ".c2pa.json").write_text(json.dumps(safeguards.manifest(pipe.parts()), indent=2))
    log.info("video: %d frames in %.1fs", n, time.perf_counter() - t0)
    return Path(out_path)


def run_webcam(pipe, source_img, *, consent: bool, device: int = 0) -> None:  # pragma: no cover - needs camera+GUI
    safeguards.require_consent(consent)
    cap = cv2.VideoCapture(device)
    src = pipe.source_face(source_img)
    smoother = EMASmoother(0.5)
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            cv2.imshow("fbswap (AI-GENERATED) - q to quit",
                       safeguards.watermark(pipe.swap_frame(source_img, src, frame, smoother=smoother)))
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
