# Face-swap / face-reenactment landscape (survey: 2026-10-14, licence re-check: 2026-10-22)

How this was built: `node toolkit/scanner/scan.js "face swap" --mode repo` (3,569 matches, top 20 ranked),
GitHub REST `GET /repos/{owner}/{repo}` for stars, last push, SPDX id and archived flag, and the LICENSE file
and README licence section of each project, read on 2026-10-14. Stars and push dates come from that same day.
`NOASSERTION` means GitHub could not classify the licence. We read the file ourselves.

**Code licence ≠ weights licence.** Nearly every high-quality swapper ships permissive or copyleft *code* but
**non-commercial weights**, usually because they are InsightFace models or were trained on research-only
datasets (VGGFace2, CelebA/CelebAMask-HQ, FFHQ).

## Swappers, end-to-end apps, reenactment

| Project | Stars | Last push | Code licence | Weights licence | Pipeline stages | Status |
|---|---:|---|---|---|---|---|
| [deepinsight/insightface](https://github.com/deepinsight/insightface) (inswapper_128) | 29,967 | 2026-10-04 | MIT | **Non-commercial research only.** inswapper / buffalo_l commercial licensing only via contact@insightface.ai (README update 2025-11-24). No public inswapper download from the official repo | SCRFD detect → 5pt align → ArcFace (w600k_r50) → inswapper 128px | maintained |
| [s0md3v/roop](https://github.com/s0md3v/roop) (+ sd-webui-roop, which now redirects here) | 3,563 | 2026-03-13 | AGPL-3.0 | inswapper (InsightFace NC) | insightface analyse → inswapper → optional GFPGAN | **archived / discontinued** |
| C0untFloyd/roop-unleashed | n/a | n/a | AGPL-3.0 (historical) | inswapper (NC) | roop + masking + restorers | **GitHub: "Repository access blocked"** |
| [facefusion/facefusion](https://github.com/facefusion/facefusion) | 30,271 | 2026-10-09 | OpenRAIL-AS (use-restricted, not OSI) | mixed: inswapper (NC), SimSwap (NC), BlendSwap (NC), ghost, hyperswap… per-model | YOLO/SCRFD/RetinaFace/YuNet detect → 2DFAN/68pt → ArcFace → swapper → occluder + parser (BiSeNet) → GFPGAN/CodeFormer/GPEN → frame pipeline | maintained |
| [hacksider/Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam) | 97,066 | 2026-10-10 | AGPL-3.0 | inswapper (NC), GFPGAN | insightface → inswapper → GFPGAN, webcam/live | maintained |
| [iperov/DeepFaceLab](https://github.com/iperov/DeepFaceLab) | 19,274 | 2024-11-13 | GPL-3.0 | train-your-own (per-subject) | S3FD detect → 2DFAN/PRNet align → XSeg mask → SAEHD autoencoder → merge | **archived** |
| [iperov/DeepFaceLive](https://github.com/iperov/DeepFaceLive) | 31,020 | 2024-11-08 | GPL-3.0 | DFM models (GPL distribution, trained on varied data) | YoloV5/S3FD → landmarks → DFM / InsightFace swap → live | **archived** |
| [deepfakes/faceswap](https://github.com/deepfakes/faceswap) | 57,571 | 2026-08-05 | GPL-3.0 | train-your-own | S3FD/MTCNN → FAN align → masks (BiSeNet, VGG) → autoencoder → convert | maintained |
| [neuralchen/SimSwap](https://github.com/neuralchen/SimSwap) | 5,197 | 2024-08-06 | **CC BY-NC 4.0** (whole project) | CC BY-NC 4.0, uses insightface antelope (NC) | insightface detect → ArcFace → ID-injection generator → parsing mask | stale |
| [mapooon/BlendFace](https://github.com/mapooon/BlendFace) | 207 | 2023-09-28 | custom research licence (non-commercial) | NC | ID encoder for swappers | stale |
| [ai-forever/ghost](https://github.com/ai-forever/ghost) (sber-swap) | 1,596 | 2025-02-25 | Apache-2.0 | GitHub release assets, no separate licence. Bundles **InsightFace glintr100 + SCRFD (NC)**, trained on **VGGFace2 (research-only)** | SCRFD → ArcFace → AEI-Net (FaceShifter-style) → super-res | stale |
| [wl-zhao/DiffSwap](https://github.com/wl-zhao/DiffSwap) | 135 | 2025-07-09 | **none** (no licence file) | research | diffusion swap | research code |
| [hxngiee/DiffFace](https://github.com/hxngiee/DiffFace) (asked as Ji-Xinyou/DiffFace, which is 404) | 318 | 2025-02-16 | unclear (NOASSERTION) | research | diffusion swap + parser guidance | research code |
| [instantX-research/InstantID](https://github.com/instantX-research/InstantID) | 11,996 | 2024-07-18 | Apache-2.0 | **checkpoints research-only** + InsightFace antelopev2 (NC), per README | ID-preserving SDXL generation, not a frame swap | stale |
| [TencentARC/PhotoMaker](https://github.com/TencentARC/PhotoMaker) | 10,087 | 2024-10-31 | Apache-2.0 (Tencent LICENSE: "Apache 2.0 except for the third-party components listed") | **Verified 2026-10-22.** [V1](https://huggingface.co/TencentARC/PhotoMaker) weights are Apache-2.0 (HF card + LICENSE) on an SDXL base (CreativeML OpenRAIL++-M, use-restricted). [V2](https://huggingface.co/TencentARC/PhotoMaker-V2) is tagged Apache-2.0, but `README_pmv2.md` says it "relies on InsightFace" and must comply with its licence, so **non-commercial in practice**. `requirements.txt` pins `insightface==0.7.3` | SDXL ID personalisation (a generator, not a frame swap) | stale |
| [tencent-ailab/IP-Adapter](https://github.com/tencent-ailab/IP-Adapter) (FaceID) | 6,700 | 2024-06-28 | Apache-2.0 | FaceID models need InsightFace embeddings (NC). FaceID weights are labelled non-commercial research | SD adapter conditioning on ArcFace | stale |
| [Gourieff/ComfyUI-ReActor](https://github.com/Gourieff/ComfyUI-ReActor) (comfyui-reactor-node / sd-webui-reactor: "access blocked") | 1,381 | 2026-10-10 | GPL-3.0 | inswapper (NC) + restorers | insightface → inswapper → restore | maintained (new name) |
| [felixrosberg/FaceDancer](https://github.com/felixrosberg/FaceDancer) | 520 | 2023-05-21 | CC BY-NC-SA 4.0 | NC | ArcFace → AFFA generator | stale |
| [maum-ai/hififace](https://github.com/maum-ai/hififace) | 383 | 2023-01-08 | BSD-3-Clause | **no released weights** (train yourself; 3DMM + ArcFace deps) | 3D shape-aware ID swap | stale |
| [johannwyh/HifiFace](https://github.com/johannwyh/HifiFace) | 65 | 2021-09-04 | **none** | none | HifiFace reimpl | stale |
| [Seanseattle/MobileFaceSwap](https://github.com/Seanseattle/MobileFaceSwap) | 366 | 2022-06-13 | Apache-2.0 | Baidu-hosted weights, no separate licence. ArcFace teacher from InsightFace (NC lineage) | PaddlePaddle: detect → ArcFace → lightweight ID-injection net | stale |
| [e4s2022/e4s](https://github.com/e4s2022/e4s) | 452 | 2023-10-06 | MIT | StyleGAN/FFHQ + CelebAMask-HQ derived (NC datasets) | parsing → regional GAN-inversion swap | stale |
| [KlingAIResearch/LivePortrait](https://github.com/KlingAIResearch/LivePortrait) (reenactment) | 19,231 | 2026-06-01 | MIT | **Verified 2026-10-22.** Core weights are MIT ([HF KlingTeam/LivePortrait](https://huggingface.co/KlingTeam/LivePortrait), `license: mit`). The repo LICENSE adds that the bundled InsightFace buffalo_l `det_10g.onnx`/`2d106det.onnx` are **non-commercial**: "for commercial purposes, you should remove and replace InsightFace's detection models" | detect → motion keypoints → warp + SPADE decode (animation, not identity swap) | maintained |
| [SocAIty/face2face](https://github.com/SocAIty/face2face) (scanner #1) | 156 | ~2026-06 | MIT | inswapper (NC) | wrapper over insightface | maintained |
| [idootop/MagicMirror](https://github.com/idootop/MagicMirror) (scanner #3) | 2,920 | ~2025-07 | MIT | inswapper-based (NC) | desktop app | stale |
| [VisoMasterFusion/VisoMaster-Fusion](https://github.com/VisoMasterFusion/VisoMaster-Fusion) | 958 | ~2026-10 | GPL-3.0 | mixed NC | full suite | maintained |
| [MarekKowalski/FaceSwap](https://github.com/MarekKowalski/FaceSwap) | 757 | 2022 | MIT | dlib 68pt model (iBUG 300-W: **non-commercial**) | 3D-fit + render classic swap | stale |

## Restorers, parsers, detectors, embedders (building blocks)

| Project | Stars | Last push | Code | Weights | Stage | Status |
|---|---:|---|---|---|---|---|
| [TencentARC/GFPGAN](https://github.com/TencentARC/GFPGAN) | 37,697 | 2024-07-26 | Apache-2.0 (with third-party exceptions, e.g. StyleGAN2 ops under NVIDIA licence) | GitHub release v1.3/v1.4, trained on FFHQ (CC BY-NC-SA source images) | restoration | stale |
| [sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) | 18,178 | 2025-11-18 | **S-Lab License 1.0 (non-commercial)** | NC | restoration | maintained |
| [yangxy/GPEN](https://github.com/yangxy/GPEN) | 2,613 | 2026-03-10 | **no licence file** | best models withdrawn "due to commercial issues" | restoration | maintained |
| [zllrunning/face-parsing.PyTorch](https://github.com/zllrunning/face-parsing.PyTorch) | 2,593 | 2023-05-21 | MIT | trained on CelebAMask-HQ (non-commercial dataset) | parsing (BiSeNet) | stale |
| [yakhyo/face-parsing](https://github.com/yakhyo/face-parsing) | 329 | 2026-04-14 | MIT | CelebAMask-HQ-trained (NC dataset) | parsing (BiSeNet, ONNX) | maintained |
| [opencv/opencv_zoo](https://github.com/opencv/opencv_zoo) YuNet | 1,086 | 2026-05-28 | Apache-2.0 repo | **YuNet model: MIT** | detection + 5 landmarks | maintained |
| opencv_zoo SFace | n/a | n/a | Apache-2.0 | **SFace model: Apache-2.0** | identity embedding | maintained |
| [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe) | 37,284 | 2026-10-14 | Apache-2.0 | Apache-2.0 model cards (BlazeFace, FaceMesh 468pt) | detection, dense landmarks | maintained |
| [serengil/retinaface](https://github.com/serengil/retinaface) | 2,059 | 2026-10-09 | MIT | RetinaFace weights from InsightFace lineage (check) | detection | maintained |
| [biubug6/Pytorch_Retinaface](https://github.com/biubug6/Pytorch_Retinaface) | 2,976 | 2023-06-28 | MIT | trained on WIDER FACE (research-use dataset terms) | detection | stale |

| [contentauth/c2pa-python](https://github.com/contentauth/c2pa-python) | 108 | 2026-10-21 | MIT OR Apache-2.0 (PyPI metadata + LICENSE-MIT/LICENSE-APACHE) | n/a | signed provenance (used) | maintained |
| MediaPipe selfie multiclass segmenter | n/a | n/a | runtime LiteRT: Apache-2.0 | **Apache-2.0** ([model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf), "LICENSED UNDER Apache License, Version 2.0") | parsing: face-skin/hair/body (used, optional) | maintained |

## Verdict: is there a fully commercially usable swapper model?
**Not among the mainstream projects.** Every high-fidelity one-shot swapper we found (inswapper, SimSwap,
BlendSwap, FaceDancer, ghost, MobileFaceSwap, HifiFace, DiffSwap/DiffFace) has non-commercial weights,
NC-dataset lineage, no weights, or no licence. Commercial-clean options are:
1. **Geometry swap** (fbswap `classic`): YuNet (MIT) + SFace (Apache-2.0) + original warp/mask/blend code.
   This is the default here. Lower fidelity, no expression or pose synthesis.
2. Train your own (e.g. HifiFace BSD-3 code) on data you have rights to. Training and data cost are the blockers.
3. Licence inswapper commercially from InsightFace.
4. Closest permissive *reenactment* option: LivePortrait's MIT core weights with InsightFace detection
   swapped for YuNet/MediaPipe, as the LivePortrait licence itself suggests. That animates a portrait.
   It does not transfer identity, so it is a candidate adapter, not a swapper.
