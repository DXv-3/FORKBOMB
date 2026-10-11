# FORKBOMB Gradients

"All gradients." 556 MIT-licensed named gradients, plus WebGL2 mesh gradients, aurora, film grain and dot effects. Every one has live controls, **Copy CSS**, **Copy GLSL** (WebGL tabs) and **Export PNG**.

```bash
node apps/gradients/server.js      # http://localhost:3002  (PORT=... to change)
node --test apps/gradients/test/   # tests
```

Deep links: `/?tab=css|mesh|aurora|dots&g=<gradient-id>`.


## What's inside

| Tab | What | Controls |
| --- | --- | --- |
| CSS | Any of the 556 gradients as `linear-` / `radial-` / `conic-gradient` | type, angle, grain |
| Mesh | 4 drifting colour points blended in OKLab over a warped domain (`mesh4()` from `apps/shaders/lib/mesh.glsl`) | speed, softness, grain |
| Aurora | Layered curtains over a night-sky ramp (`aurora()`) | speed, intensity, grain |
| Dots | Wave dot grid with pointer ripple, gradient halftone, particle morph (click to change shape, hover to scatter) | mode, spacing, dot size, angle, speed |

Grain is a global overlay (`mix-blend-mode: overlay`); Copy CSS includes a pure-CSS SVG `feTurbulence` grain snippet.

API: `GET /api/gradients[?q=name]` (dataset + provenance), `GET /api/glsl` (shader library, shared with `apps/shaders`).

## Sources and licenses

| Part | Source | License | How used |
| --- | --- | --- | --- |
| 382 gradients | [ghosh/uiGradients](https://github.com/ghosh/uiGradients) @afb0184 | MIT © 2017 Indrashish Ghosh | data normalised into `data/gradients.json`; `data/LICENSE-uigradients` |
| 174 gradients | [itmeo/webgradients](https://github.com/itmeo/webgradients) @0157829 | MIT © 2017 itmeo | data normalised (rgba/non-hex entries dropped); `data/LICENSE-webgradients` |
| `gradient.glsl`, `mesh.glsl` | original FORKBOMB code; OKLab constants from [Björn Ottosson](https://bottosson.github.io/posts/oklab/) | MIT | fresh code |
| Dot effects | original, clean-room; look inspired by [dotsui.dev](https://dotsui.dev) | MIT | no dotsui code, assets or shape data copied |
| `#include` resolver | `apps/shaders/public/include.js` | MIT | reused |

### dotsui.dev: what we did and why

dotsui.dev ("Dots — shapes in motion") is a React particle library (`dots-swarm` on npm): 171 morphing particle shapes, dot-built UI primitives (button, slider, switch…), particle text, physics, plus a paid **Pro** tier ($149, private registry, Pro artwork) and Studio. The free `dots-swarm` package is MIT (© 2026 hamza-al), but its source repo isn't public, it's a React/TS runtime (this app is zero-dep vanilla), and Pro/Studio/artwork are proprietary. So we **recreated, not reused**: studied the visible behaviour only and wrote original canvas code (phyllotaxis/heart/ring/spiral/wave shapes from textbook parametric formulas, spring-to-target particles with pointer repulsion, luminance halftone).

### Excluded

Shadertoy shaders under the default CC BY-NC-SA 3.0; GPL/AGPL/unlicensed gradient generators; dotsui Pro/Studio assets.
