# fbswap: FORKBOMB face swap, built from parts

A modular Python face-swap pipeline. Each stage is one module behind a `Protocol` (`fbswap/types.py`), so you can
swap any part. The default build uses **only permissive code and permissively licensed weights**. Safeguards are
**on by default**: consent gate, visible `AI-GENERATED` watermark, and synthetic-media metadata.

## Landscape summary
We surveyed 30+ free and open-source swappers, reenactors, restorers and parsers. The full table, with code licence
vs weights licence, is in [`docs/faceswap-landscape.md`](../../docs/faceswap-landscape.md). The short version:
the good one-shot swappers (inswapper, SimSwap, BlendSwap, FaceDancer, ghost, MobileFaceSwap) all ship
**non-commercial weights** or NC-dataset lineage. The big apps (roop, Deep-Live-Cam, DeepFaceLab/Live,
deepfakes/faceswap, ReActor) are AGPL or GPL, and facefusion is OpenRAIL-AS. So fbswap reuses *none* of their code.
It builds a clean pipeline on MIT/Apache parts and offers inswapper only as a gated, research-only adapter.

## Parts table
| Stage | Chosen part (default) | Licence | Alternatives (licence) |
|---|---|---|---|
| Detection | YuNet `face_detection_yunet_2023mar.onnx` via OpenCV | MIT (model), Apache-2.0 (OpenCV) | MediaPipe BlazeFace (Apache-2.0); SCRFD / RetinaFace (InsightFace NC weights) |
| Landmarks + alignment | YuNet 5-pt + original similarity alignment, ArcFace 112 template | MIT | MediaPipe FaceMesh 468-pt (Apache-2.0); 2DFAN / dlib 68 (NC data) |
| Identity embedding | SFace `face_recognition_sface_2021dec.onnx` | Apache-2.0 | ArcFace w600k_r50 / glintr100 (InsightFace, **NC**) |
| Swapper | `classic`: similarity warp of source face onto target geometry (original, no weights) | MIT | `inswapper_128` (**research-only**, gated); SimSwap (CC BY-NC); ghost (Apache code, NC lineage weights) |
| Parsing / mask | feathered landmark ellipse (original); optional `--mask parser` = MediaPipe selfie-multiclass face-skin | MIT; model Apache-2.0 (model card), runtime LiteRT Apache-2.0 | BiSeNet face-parsing (MIT code, CelebAMask-HQ NC weights: excluded) |
| Colour + blend | Reinhard LAB transfer + feather or Poisson (`cv2.seamlessClone`) | MIT / Apache-2.0 | — |
| Restoration | none / `unsharp` (weight-free) | MIT | none with clean weights: GFPGAN / RestoreFormer (FFHQ CC BY-NC-SA data), CodeFormer (S-Lab **NC**), GPEN (no licence). Skipped on purpose |
| Video + temporal | frame loop + landmark EMA with scene-cut reset | MIT | — |
| Webcam / live | `fbswap webcam` (OpenCV capture) | MIT | — |
| Provenance | embedded **signed C2PA** manifest via c2pa-python | MIT OR Apache-2.0 | — |

## Install
```bash
cd apps/faceswap
python -m pip install -e .            # CPU (onnxruntime)
python -m pip install -e ".[gpu]"     # optional CUDA: onnxruntime-gpu
python -m pip install -e ".[dev]"     # pytest + ruff
python -m pip install -e ".[parser]"  # optional MediaPipe segmenter mask (ai-edge-litert)
fbswap models fetch                   # permissive set only: yunet (MIT), sface (Apache-2.0), mp_multiclass (Apache-2.0)
```
Weights go to `$FBSWAP_HOME` (default `~/.cache/fbswap`). They are **never** in the repo. Downloads come from
official sources and are checked against pinned SHA-256 hashes.

## Models and licences
```
$ fbswap models list
yunet          detect  permissive                      MIT
sface          embed   permissive                      Apache-2.0
mp_multiclass  mask    permissive                      Apache-2.0
buffalo_l      embed   RESEARCH-ONLY (non-commercial)  InsightFace models: non-commercial research only
inswapper_128  swap    RESEARCH-ONLY (non-commercial)  InsightFace: non-commercial research only; commercial licensing via contact@insightface.ai
```
Non-commercial models need `--accept-license <model>` on every fetch and run. InsightFace no longer publishes
an official inswapper download. If you hold a copy legitimately, register it with
`fbswap models fetch inswapper_128 --accept-license inswapper_128 --path /path/inswapper_128.onnx`. The research
path also needs `pip install -e ".[research]"` (onnx) and `buffalo_l` for ArcFace embeddings.

## Usage
```bash
fbswap image  --source a.jpg --target b.jpg -o out.png --i-have-consent [--blend poisson] [--restore unsharp]
fbswap video  --source a.jpg --target in.mp4 -o out.mp4 --i-have-consent [--max-frames 300]
fbswap webcam --source a.jpg --i-have-consent      # needs a GUI build of OpenCV (opencv-python, not -headless)
fbswap web    [--host 127.0.0.1 --port 3901]       # local web UI, binds 127.0.0.1 by default
fbswap inspect out.png                             # verify the C2PA signature + marks (exit 3 if missing/invalid)
# research only:
fbswap image ... --swapper inswapper_128 --accept-license inswapper_128 --accept-license buffalo_l
```
Library use: `Pipeline(detector=..., swapper=..., masker=..., blender=..., restorer=...)` takes any object that
matches the Protocols in `fbswap/types.py`.

## Safeguards (on by default, no off switch)
- **Consent attestation**: `--i-have-consent` (CLI) or a required checkbox (web). Without it, nothing is processed.
- **Visible watermark**: an `AI-GENERATED` banner on every image and every video frame. No removal feature exists.
- **Metadata**: EXIF `ImageDescription`/`Software`, XMP with IPTC `DigitalSourceType = trainedAlgorithmicMedia`,
  PNG `AI-Generated` text.
- **Signed C2PA**: every PNG, JPEG and MP4 carries an embedded C2PA manifest, ES256-signed with
  [c2pa-python](https://github.com/contentauth/c2pa-python) (MIT OR Apache-2.0). It holds a `c2pa.created` action with
  `trainedAlgorithmicMedia` and an `org.forkbomb.fbswap.synthetic` assertion (`ai_generated: true`).
  `fbswap inspect` verifies the signature and the data hash; editing even one pixel makes it `Invalid`.
  - Dev credentials: on first use fbswap creates a local CA and signer under `$FBSWAP_HOME/c2pa-dev/`. The key is
    mode 0600 and the CA key is thrown away. Nothing is committed (`*.key`/`*.pem` are git-ignored, and a test checks this).
    Dev-signed files are cryptographically **valid** anywhere, but **trusted** only where the dev CA is an anchor,
    which by default is just the machine that made them.
  - Production: set `FBSWAP_C2PA_CERT` (PEM chain, leaf first), `FBSWAP_C2PA_KEY` and optionally
    `FBSWAP_C2PA_ANCHORS`. Use a certificate from a C2PA-trust-list CA so third-party validators show it as trusted.
- **Local files only**: URLs, `data:` URIs and web fetching are refused. There is no scraping and no crawling for faces.
- **Logs** hold timings, sizes and part names only. Input images are never written to disk or logged. The web UI
  processes everything in memory and sends `Cache-Control: no-store`.

### Refusal guidance: do not use fbswap for
non-consensual imagery of anyone; sexual or intimate content; anything depicting minors; impersonating a real
person (politicians, celebrities, private individuals) to deceive; fraud, scams, KYC/identity-verification
bypass, defamation or harassment; or stripping or obscuring the AI-GENERATED marks.

## Ethics / legal note
Face swapping touches likeness, publicity, privacy, biometric (e.g. BIPA, GDPR Art. 9) and deepfake-disclosure
laws (e.g. EU AI Act Art. 50 transparency duties, and US state election and NCII statutes). You are responsible
for consent and legal compliance in your jurisdiction. Model licences are separate from this MIT code: the
`classic` default is commercially clean. `inswapper_128`/`buffalo_l` are **non-commercial research only** unless
you license them from InsightFace.

## Tested
- `pytest` (40 tests) and `ruff check`. Tests cover stage interfaces with tiny synthetic images and mocked models
  (detector, LiteRT segmenter, inswapper), licence gating, watermark on every video frame, EXIF/XMP, C2PA sign,
  verify, tamper and missing cases, key permissions and no committed keys, and consent in pipeline, CLI and web.
- Real image: YuNet + SFace + classic + Poisson (also with `--mask parser`) on two public-domain paintings: Vermeer,
  *Girl with a Pearl Earring* (Mauritshuis, PD) and *Study of a Young Woman* (Met Open Access, CC0). The C2PA state
  is `Trusted` on the signing machine.
- Real video: [Portrait Monument Video 01](https://commons.wikimedia.org/wiki/File:Portrait_Monument_Video_01.webmhd.webm)
  (Wikimedia Commons, **CC0**, marble sculpture by Adelaide Johnson). 697 frames at 1280x720 in 33 s on CPU. All 697
  output frames carry the watermark and 0 input frames do. The MP4's C2PA signature verifies as `Trusted`.
- Not exercised for real: the research-only inswapper path (mocks only), webcam, CUDA.
