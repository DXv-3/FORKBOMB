# FORKBOMB Shaders

A WebGL2 shader playground plus a composable GLSL library, snapped together from permissive parts found across GitHub. Zero dependencies: plain Node `http` server, vanilla browser JS.

```bash
node apps/shaders/server.js          # http://localhost:3001  (PORT=... to change)
cd apps/shaders && node --test test/ # tests
```

## Playground

- Live GLSL editor (auto-recompiles 400 ms after you stop typing; Ctrl/Cmd+Enter to force).
- Compile errors with line numbers mapped back to **your** line, or to `lib-file.glsl:line` when the error is inside an include.
- Shadertoy-style entry point `void mainImage(out vec4 fragColor, in vec2 fragCoord)` with uniforms `iTime`, `iResolution`, `iMouse` (xy = pointer px, z = 1 while pressed).
- Preset gallery, Pause/Play, Fullscreen, **PNG** screenshot, **Share** (source encoded in the URL hash, `#s=...`; presets link as `#p=<id>`).

## Library — `#include "name.glsl"`

| File | Provides |
|---|---|
| `noise.glsl` | `snoise(vec2)`, `snoise(vec3)` simplex noise |
| `fbm.glsl` | `fbm(vec2/vec3)`, `warp(p, t, q, r)` domain warping (includes noise) |
| `hash.glsl` | `hash11/12/13/22/33` sine-free hashes |
| `sdf.glsl` | `sdSphere/Box/RoundBox/Torus/Capsule/Plane/Circle`, `opUnion/Subtract/Intersect/SmoothUnion/Repeat`, `rot2` |
| `palette.glsl` | `palette(t,a,b,c,d)`, `palRainbow/Sunset/Ocean/Neon/Fire` |
| `raymarch.glsl` | `raymarch`, `calcNormal`, `softShadow`, `calcAO`, `camera` — define `float map(vec3)` first; `#define RM_STEPS` to tune |

Includes are resolved in JS (`public/include.js`, also usable from Node): recursive, include-once, cycle-detecting, with a line map for error reporting.

## Presets

`raymarch-scene` (smooth-blended SDFs, soft shadows, AO, drag to orbit) · `domain-warp` · `plasma` · `mandelbrot` (smooth-coloured zoom) · `metaballs` (click to add a ball) · `voronoi` · `noise-terrain` (raymarched fBm flyover). All verified to compile under real GLSL ES 3.00 (Chrome/ANGLE SwiftShader).

## Parts, provenance, licenses

| Piece | Upstream | License | How it's used |
|---|---|---|---|
| `glsl-simplex-noise` | [ashima/webgl-noise](https://github.com/ashima/webgl-noise) @ `6abed1e` (stegu) | MIT | Vendored verbatim in `lib/noise.glsl`; upstream license in `lib/LICENSE-webgl-noise` |
| `glsl-hash-without-sine` | [Dave Hoskins, Hash without Sine](https://www.shadertoy.com/view/4djSRW) | MIT (explicit author grant) | Algorithm/constants adapted in `lib/hash.glsl`, attribution kept |
| `glsl-sdf-primitives` | [marklundin/glsl-sdf-primitives](https://github.com/marklundin/glsl-sdf-primitives) + [glsl-sdf-ops](https://github.com/marklundin/glsl-sdf-ops) | MIT | API shape; code written fresh from standard formulas |
| `glsl-cosine-palette` | [iq, "palettes" article](https://iquilezles.org/articles/palettes/) | formula; our code MIT | Formula only, fresh implementation |
| `glsl-fbm-warp`, `glsl-raymarch`, `glsl-include-resolver`, `shaders-app` | this repo | MIT | Original FORKBOMB code |

Deliberately **not** used: Shadertoy shaders under the default CC BY-NC-SA 3.0 license, and AGPL results (e.g. robclouth/noise-canvas). Demo shaders are original.

## Gradient additions

- `lib/gradient.glsl` (original, MIT): sRGB<->OKLab, `mixOklab`, `ramp()` 2-6 stops, `gradLinear/Radial/Conic`, `hexColor(0xRRGGBB)`, `gradDither`.
- `lib/mesh.glsl` (original, MIT): `mesh4()` animated mesh gradient, `aurora()`, `grain()`.
- Presets: `mesh-gradient.glsl`, `aurora-grain.glsl`. Also used by [apps/gradients](../gradients/README.md).
