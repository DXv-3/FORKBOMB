import numpy as np
import pytest

from fbswap.types import Face


def synth_face_img(h=160, w=160, tone=(90, 140, 200)):
    """A tiny synthetic 'face': skin ellipse + dark eye/mouth blobs. No real person."""
    import cv2

    img = np.full((h, w, 3), 40, np.uint8)
    cv2.ellipse(img, (w // 2, h // 2), (w // 4, h // 3), 0, 0, 360, tone, -1)
    for p in KPS(w, h)[:2]:
        cv2.circle(img, tuple(int(v) for v in p), 4, (20, 20, 20), -1)
    cv2.line(img, tuple(int(v) for v in KPS(w, h)[3]), tuple(int(v) for v in KPS(w, h)[4]), (30, 30, 120), 3)
    return img


def KPS(w=160, h=160):
    return np.array([[0.38 * w, 0.42 * h], [0.62 * w, 0.42 * h], [0.5 * w, 0.55 * h],
                     [0.41 * w, 0.68 * h], [0.59 * w, 0.68 * h]], np.float32)


class MockDetector:
    name = "mock"

    def detect(self, image):
        h, w = image.shape[:2]
        return [Face(bbox=np.array([w * 0.25, h * 0.17, w * 0.5, h * 0.66], np.float32), kps=KPS(w, h), score=0.99)]


class EmptyDetector:
    name = "empty"

    def detect(self, image):
        return []


class MockEmbedder:
    name = "mock-embed"

    def embed(self, image, face):
        v = image.reshape(-1, 3).mean(0).astype(np.float32)
        return v / np.linalg.norm(v)


@pytest.fixture
def imgs():
    return synth_face_img(tone=(90, 140, 200)), synth_face_img(tone=(160, 170, 120))


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    monkeypatch.setenv("FBSWAP_HOME", str(tmp_path / "home"))
