import cv2
import numpy as np
import pytest

from conftest import MockDetector, synth_face_img
from fbswap import safeguards
from fbswap.pipeline import Pipeline
from fbswap.video import run_video


def test_video_roundtrip(tmp_path):
    src = tmp_path / "in.mp4"
    w = cv2.VideoWriter(str(src), cv2.VideoWriter_fourcc(*"mp4v"), 10, (160, 160))
    for _ in range(5):
        w.write(synth_face_img(tone=(160, 170, 120)))
    w.release()
    pipe = Pipeline(detector=MockDetector())
    with pytest.raises(safeguards.ConsentRequired):
        run_video(pipe, synth_face_img(), str(src), str(tmp_path / "o.mp4"), consent=False)
    out = run_video(pipe, synth_face_img(), str(src), str(tmp_path / "o.mp4"), consent=True)
    cap = cv2.VideoCapture(str(out))
    n, marked, frame = 0, 0, None
    while True:
        ok, f = cap.read()
        if not ok:
            break
        x0, y0, x1, y1 = safeguards.watermark_box(f.shape)
        marked += bool((f[y0:y1, x0:x1] < 40).mean() > 0.3)
        n, frame = n + 1, f
    assert n == 5 and marked == n  # watermark on every frame
    from fbswap import provenance

    v = provenance.verify_file(out)
    assert v["signature_valid"] and v["ai_generated"] and v["state"] == "Trusted"
    assert np.asarray(frame).shape == (160, 160, 3)
