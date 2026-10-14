"""Stage interfaces. Every stage is a Protocol so any part can be swapped for another."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

import numpy as np

# 5-point order everywhere: right eye, left eye, nose tip, right mouth corner, left mouth corner
# (image-left first, matching YuNet / ArcFace conventions).


@dataclass
class Face:
    bbox: np.ndarray  # (4,) x, y, w, h
    kps: np.ndarray  # (5, 2) float32 landmarks
    score: float = 1.0
    embedding: np.ndarray | None = None
    extra: dict = field(default_factory=dict)


@runtime_checkable
class Detector(Protocol):
    name: str

    def detect(self, image: np.ndarray) -> list[Face]: ...


@runtime_checkable
class Embedder(Protocol):
    name: str

    def embed(self, image: np.ndarray, face: Face) -> np.ndarray: ...


@runtime_checkable
class Swapper(Protocol):
    """Returns (swapped_image_in_target_frame, coverage_mask_float01)."""

    name: str
    license: str

    def swap(self, source_img: np.ndarray, source: Face, target_img: np.ndarray, target: Face
             ) -> tuple[np.ndarray, np.ndarray]: ...


@runtime_checkable
class Masker(Protocol):
    name: str

    def mask(self, image: np.ndarray, face: Face) -> np.ndarray: ...


@runtime_checkable
class Blender(Protocol):
    name: str

    def blend(self, target_img: np.ndarray, swapped: np.ndarray, mask: np.ndarray) -> np.ndarray: ...


@runtime_checkable
class Restorer(Protocol):
    name: str

    def restore(self, image: np.ndarray, face: Face) -> np.ndarray: ...
