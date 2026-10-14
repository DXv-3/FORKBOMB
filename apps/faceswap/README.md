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
| Parsing / mask | feathered landmark ellipse (original) | MIT | BiSeNet face-parsing (MIT code, CelebAMask-HQ NC data) |
| Colour + blend | Reinhard LAB transfer + feather or Poisson (`cv2.seamlessClone`) | MIT / Apache-2.0 | — |
| Restoration | none / `unsharp` (weight-free) | MIT | GFPGAN (Apache code, FFHQ data); CodeFormer (S-Lab **NC**); GPEN (no licence) |
| Video + temporal | frame loop + landmark EMA with scene-cut reset | MIT | — |
| Webcam / live | `fbswap webcam` (OpenCV capture) | MIT | — |

## Install
```bash
cd apps/faceswap
python -m pip install -e .            # CPU (onnxruntime)
python -m pip install -e ".[gpu]"     # optional CUDA: onnxruntime-gpu
python -m pip install -e ".[dev]"     # pytest + ruff
fbswap models fetch                   # default, permissive set only: yunet (MIT) + sface (Apache-2.0)
```
Weights go to `$FBSWAP_HOME` (default `~/.cache/fbswap`). They are **never** in the repo. Downloads come from
official sources and are checked against pinned SHA-256 hashes.

## Models and licences
```
$ fbswap models list
yunet          detect  permissive                      MIT
sface          embed   permissive                      Apache-2.0
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
fbswap inspect out.png                             # show the synthetic-media marks
# research only:
fbswap image ... --swapper inswapper_128 --accept-license inswapper_128 --accept-license buffalo_l
```
Library use: `Pipeline(detector=..., swapper=..., masker=..., blender=..., restorer=...)` takes any object that
matches the Protocols in `fbswap/types.py`.

## Safeguards (on by default, no off switch)
- **Consent attestation**: `--i-have-consent` (CLI) or a required checkbox (web). Without it, nothing is processed.
- **Visible watermark**: an `AI-GENERATED` banner on every image and every video frame. No removal feature exists.
- **Metadata**: EXIF `ImageDescription`/`Software`, XMP with IPTC `DigitalSourceType = trainedAlgorithmicMedia`,
  PNG `AI-Generated` text, and a `.c2pa.json` sidecar. The sidecar is a C2PA-*style* unsigned assertion, **not** a
  signed C2PA manifest, and it carries the output's SHA-256.
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
`pytest` (30 tests: stage interfaces with tiny synthetic images and mocked models, licence gating, watermark,
metadata, consent in pipeline/CLI/web, video round-trip) and `ruff check`. A real end-to-end run used YuNet +
SFace + classic + Poisson on two public-domain paintings: Vermeer, *Girl with a Pearl Earring* (Mauritshuis, PD)
and *Study of a Young Woman* (Met Open Access, CC0). The research-only inswapper path is covered by mocks only.
