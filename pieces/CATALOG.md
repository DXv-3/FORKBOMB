# Piece catalog

A **piece** is the smallest unit you would actually reuse somewhere else.

## Piece rules

- One clear job
- Clear license
- Named seams (inputs / outputs / events)
- Source link back to the origin
- Note on how to snap it into a project

## Schema

Every piece entry follows [`schema.json`](schema.json).

## Index

| ID | Name | Category | License | Status |
| --- | --- | --- | --- | --- |
| `retry-with-backoff` | Retry with backoff | reliability | MIT | starter |
| `ci-node-matrix` | Node CI matrix | ci | MIT | starter |

### Process pieces — pack [`forkbomb-core`](../packs/forkbomb-core/pack.json)

FORKBOMB's own operating loop, cataloged like any other brick. See [docs/PROCESS.md](../docs/PROCESS.md).

| ID | Name | Category | License | Status |
| --- | --- | --- | --- | --- |
| `discover-bricks` | Discover bricks | agent | MIT | core |
| `tag-piece` | Tag piece | data | MIT | core |
| `snap-via-connector` | Snap via connector | infra | MIT | core |
| `ship-edge` | Ship edge | ci | MIT | core |
| `earn-loop` | Earn loop | commerce | MIT | core |
| `improve-upstream` | Improve upstream | reliability | MIT | core |
| `run-cycle` | Run cycle | agent | MIT | core |

### Product pieces — pack [`paste`](../packs/paste/pack.json)

FORKBOMB's first product: a pastebin assembled from GitHub parts. See [apps/paste](../apps/paste/README.md).

| ID | Name | Category | License | Status |
| --- | --- | --- | --- | --- |
| `prism-highlight` | Prism syntax highlighter | ui | MIT | product |
| `nanoid-short-id` | nanoid short IDs | data | MIT | product |
| `paste-file-store` | Paste file store with expiry | data | MIT | product |
| `paste-app` | FORKBOMB Paste app | infra | MIT | product |
| `glsl-simplex-noise` | Ashima/stegu simplex noise (GLSL) | ui | MIT | product |
| `glsl-fbm-warp` | fBm + domain warp (GLSL) | ui | MIT | product |
| `glsl-hash-without-sine` | Hash without Sine (GLSL) | ui | MIT | product |
| `glsl-sdf-primitives` | SDF primitives + operators (GLSL) | ui | MIT | product |
| `glsl-cosine-palette` | Cosine gradient palettes (GLSL) | ui | MIT | product |
| `glsl-raymarch` | Sphere-tracing helpers (GLSL) | ui | MIT | product |
| `glsl-include-resolver` | GLSL #include preprocessor | ui | MIT | product |
| `glsl-camera` | Camera helpers (GLSL) | ui | MIT | product |
| `glsl-lighting` | PBR-ish lighting + environment (GLSL) | ui | MIT | product |
| `glsl-post` | Post-processing finish (GLSL) | ui | MIT | product |
| `shaders-app` | FORKBOMB Shaders playground | ui | MIT | product |
| `uigradients-data` | uiGradients colour stops | ui | MIT | product |
| `webgradients-data` | WebGradients colour stops | ui | MIT | product |
| `glsl-gradient` | Gradient helpers: OKLab ramps (GLSL) | ui | MIT | product |
| `glsl-mesh-gradient` | Mesh gradient, aurora, grain (GLSL) | ui | MIT | product |
| `dot-effects` | Dot grid / halftone / morph (canvas) | ui | MIT | product |
| `gradients-app` | FORKBOMB Gradients gallery | ui | MIT | product |
| `dots-studio` | Dots Studio: 90 shapes, text/SVG/image, dot UI, physics, timeline | ui | MIT | product |
| `forkbomb-dots-lib` | forkbomb-dots.js embeddable particle lib (zero deps) | ui | MIT | product |
| `fbswap-app` | fbswap: modular face-swap pipeline (CLI + local web UI) | other | MIT | product |
| `fbswap-detect-yunet` | Face detection: YuNet via cv2.FaceDetectorYN | other | MIT | product |
| `fbswap-align` | 5-point similarity alignment + EMA temporal smoothing | other | MIT | product |
| `fbswap-embed-sface` | Identity embedding: SFace via cv2.FaceRecognizerSF | other | MIT | product |
| `fbswap-swap` | Swapper stage: classic warp (default) + gated research-only inswapper adapter | other | MIT | product |
| `fbswap-mask` | Face mask: feathered landmark ellipse (default) + MediaPipe multiclass segmenter (optional) | other | MIT | product |
| `fbswap-blend` | Reinhard LAB colour transfer + feather / Poisson blending | other | MIT | product |
| `fbswap-restore` | Restorer stage: none / unsharp (weight-free) | other | MIT | product |
| `fbswap-safeguards` | Consent gate, visible AI-GENERATED watermark, EXIF/XMP marks + signed C2PA | reliability | MIT | product |
| `fbswap-models` | Model registry + license-gated runtime fetcher | infra | MIT | product |
| `fbswap-video` | Video frame pipeline + live webcam path | other | MIT | product |
| `fbswap-provenance` | Signed C2PA provenance (c2pa-python) + runtime dev cert | reliability | MIT | product |

Add new rows when you drop a brick into `toolkit/` or `pieces/entries/`. `node toolkit/process/cycle.js` checks every entry has a row.
