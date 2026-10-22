import numpy as np

from conftest import KPS, MockDetector, MockEmbedder
from fbswap import types
from fbswap.align import EMASmoother, align_crop
from fbswap.blend import FeatherBlender, PoissonBlender, color_transfer
from fbswap.mask import LandmarkEllipseMasker
from fbswap.pipeline import Pipeline
from fbswap.restore import NoopRestorer, UnsharpRestorer
from fbswap.swap import ClassicWarpSwapper


def test_parts_satisfy_protocols():
    assert isinstance(MockDetector(), types.Detector)
    assert isinstance(MockEmbedder(), types.Embedder)
    assert isinstance(ClassicWarpSwapper(), types.Swapper)
    assert isinstance(LandmarkEllipseMasker(), types.Masker)
    for b in (FeatherBlender(), PoissonBlender()):
        assert isinstance(b, types.Blender)
    for r in (NoopRestorer(), UnsharpRestorer()):
        assert isinstance(r, types.Restorer)


def test_align_crop_maps_landmarks_to_template(imgs):
    crop, m = align_crop(imgs[0], KPS(), 112)
    assert crop.shape == (112, 112, 3)
    pts = np.c_[KPS(), np.ones(5)] @ m.T
    from fbswap.align import TEMPLATE_112

    assert np.abs(pts - TEMPLATE_112).max() < 6


def test_ema_smoother_smooths_and_resets():
    s = EMASmoother(0.5)
    a = KPS()
    assert np.allclose(s(a), a)
    assert np.allclose(s(a + 2), a + 1)
    assert np.allclose(s(a + 200), a + 200)  # big jump = scene cut -> reset


def test_classic_swap_mask_blend(imgs):
    src, tgt = imgs
    det = MockDetector()
    sf, tf = det.detect(src)[0], det.detect(tgt)[0]
    warped, cover = ClassicWarpSwapper().swap(src, sf, tgt, tf)
    assert warped.shape == tgt.shape and cover.shape == tgt.shape[:2]
    m = LandmarkEllipseMasker().mask(tgt, tf)
    assert m.dtype == np.float32 and 0 <= m.min() and m.max() <= 1 and m[80, 80] > 0.9 and m[0, 0] == 0
    for b in (FeatherBlender(), PoissonBlender()):
        out = b.blend(tgt, warped, m * cover)
        assert out.shape == tgt.shape and out.dtype == np.uint8
        assert np.array_equal(out[0:5, 0:5], tgt[0:5, 0:5])  # outside mask untouched (feather) / near


def test_color_transfer_matches_stats(imgs):
    src, ref = imgs
    m = np.ones(src.shape[:2], np.float32)
    out = color_transfer(src, ref, m)
    assert abs(out.mean() - ref.mean()) < abs(src.mean() - ref.mean())


def test_restorers_keep_shape(imgs):
    f = MockDetector().detect(imgs[0])[0]
    assert UnsharpRestorer().restore(imgs[0], f).shape == imgs[0].shape
    assert NoopRestorer().restore(imgs[0], f) is imgs[0]


def test_pipeline_end_to_end_mocked(imgs):
    pipe = Pipeline(detector=MockDetector(), embedder=MockEmbedder())
    out = pipe.run_image(imgs[0], imgs[1], consent=True)
    assert out.shape == imgs[1].shape
    assert not np.array_equal(out, imgs[1])
    assert pipe.parts()["swapper"] == "classic"


def test_pipeline_swappable_part(imgs):
    class Identity:
        name, license = "identity", "MIT"

        def swap(self, s, sf, t, tf):
            return t.copy(), np.ones(t.shape[:2], np.float32)

    pipe = Pipeline(detector=MockDetector(), swapper=Identity())
    assert pipe.parts()["swapper"] == "identity"
    out = pipe.swap_frame(imgs[0], MockDetector().detect(imgs[0])[0], imgs[1])
    assert np.abs(out.astype(int) - imgs[1]).max() <= 1


class _FakeInterp:
    """Mocked LiteRT interpreter: labels a centred disc as face-skin (class 3)."""

    def get_input_details(self):
        return [{"index": 0, "shape": np.array([1, 64, 64, 3])}]

    def get_output_details(self):
        return [{"index": 1}]

    def set_tensor(self, i, x):
        assert x.shape == (1, 64, 64, 3) and x.dtype == np.float32 and 0 <= x.min() and x.max() <= 1

    def invoke(self):
        pass

    def get_tensor(self, i):
        yy, xx = np.mgrid[:64, :64]
        out = np.zeros((1, 64, 64, 6), np.float32)
        out[0, ..., 0] = 1
        out[0, ..., 3] = ((yy - 32) ** 2 + (xx - 32) ** 2 < 15 ** 2) * 2.0
        return out


def test_segmenter_masker_with_mock(imgs):
    from fbswap.mask import SegmenterMasker

    m = SegmenterMasker(interpreter=_FakeInterp())
    assert isinstance(m, types.Masker)
    f = MockDetector().detect(imgs[1])[0]
    mask = m.mask(imgs[1], f)
    assert mask.shape == imgs[1].shape[:2] and mask.dtype == np.float32
    assert mask[80, 80] > 0.9 and mask[2, 2] == 0 and 0 <= mask.min() and mask.max() <= 1
    pipe = Pipeline(detector=MockDetector(), masker=m)
    assert pipe.run_image(imgs[0], imgs[1], consent=True).shape == imgs[1].shape


def test_parser_model_is_permissive():
    from fbswap import models

    s = models.REGISTRY["mp_multiclass"]
    assert s.commercial_ok and s.license == "Apache-2.0" and s.sha256
