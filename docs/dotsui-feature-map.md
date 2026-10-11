# dotsui.dev feature map → FORKBOMB Dots Studio

Surveyed 2026-10-11 from **public pages only**: `/`, `/docs`, `/shapes`, `/ui`, `/dot`, `/showcase` (+ `/physics`, `/textures`, `/objects`, `/avatars`), `/studio`, `/pro`.
dotsui.dev = "Dots — shapes in motion", React 18/19 + TypeScript library `dots-swarm` (free core, MIT © 2026 hamza-al; source repo private) and **Dots Pro** ($149 lifetime, proprietary: private npm registry `@dots-swarm/pro`, 118 specialist shapes, Studio editor with cloud projects).

**Rules we followed:** no Pro package, Pro artwork, shape data or Studio code downloaded, installed, decompiled or copied; private registry not accessed; no paywall bypassed. We did not vendor or download the MIT `dots-swarm` npm package either. API *names* below are as shown in public marketing snippets, listed only to describe features. All FORKBOMB code is original vanilla JS using standard math (parametric/polar curves, Gielis superformula, signed-distance fills, Halton sampling, pixel-mask sampling, spring physics).

Status: ✅ shipped · 🟡 partial / different approach · ⛔ not doing

| # | Feature (as publicly shown) | Tier | What it does visibly | FORKBOMB original equivalent | Status |
|---|---|---|---|---|---|
| 1 | `DotSwarm` component: change `shape` prop → dots morph | Free | ~1300 dots morph between formations | `Swarm` (physics.js) + `morphTo` (studio.js) / `ForkbombDots.create().morph()` | ✅ |
| 2 | Shape library: 53 free / 171 total (Organic, Structure, Feedback, Productivity, Communication, Assistant, Expression, Media, Data & security, Navigation 91, Commerce, Sculptures) | Free 53 / **Pro 118** | Named formations (cloud, orb, helix, bloom, atom, halo, wire-sphere…) | `shapes.js`: **90 procedural generators** in 10 categories (basic, polygon, star, superformula, lissajous, rose, organic, curve, 3d, icon). None copied; ours are math, not their artwork | ✅ (different set) |
| 3 | Pro specialist shapes (microphone, neural-network, thought-bubble, navigation icons…) | **Pro** | Detailed illustrative formations | Not copied. Users can paste **their own SVG** → `svgPoints()`; we ship math icons (bell, chat-bubble, pin, bolt, house, eye…) | ⛔ Pro data / ✅ own SVG |
| 4 | Particle text ("Even words can wander", twist the words) | Free | Paragraph letters scatter and reform | `textPoints()` canvas-text sampling of any typed text; "Explode + reassemble" | ✅ |
| 5 | UI primitives `dots-swarm/ui` (Button, Command menu, 5 inputs, layout/nav, overlays, text, images, feedback; Radix behaviour) | Free | Dots assemble into a working control | `ui.js`: button (press state), slider, toggle, checkbox, dropdown, progress, spinner, loader as dots, clickable via hit-test (Dot UI view) | 🟡 8 controls, canvas only (no Radix/DOM a11y layer) |
| 6 | UI choreography / UI sequences / component states | **Pro** (choreography) | Coordinated entrances between UI states | Timeline steps of kind `ui` + per-step ease/stagger/order | 🟡 original |
| 7 | `DotsSequence` / `DotsSequencePlayer` timed sequences, keyframes | Free (basic), Pro multi-track | Chain shapes with durations | `scene.js` timeline (`evalTimeline`) + Studio timeline editor (add / reorder / delete / scrub / play) | ✅ single track |
| 8 | Multi-track sequences, event graphs, triggers | **Pro** | Event-connected timelines | — | ⛔ not built (single track only) |
| 9 | Explode, rain, reform | Free | Burst, fall under gravity, return | `Swarm.explode / release / reform`, gravity + floor bounce | ✅ |
| 10 | `ProSwarmPhysics`: collisions, particle radius, text colliders, restitution | **Pro** | Rain bouncing off headline words | Collisions-lite (uniform-grid separation), floor/wall restitution | 🟡 no DOM-text colliders |
| 11 | Pointer interaction ("move around, I'm listening") | Free | Dots part / follow pointer | Pointer repel / attract with strength + radius | ✅ |
| 12 | Avatars (Pebble, Orb, Squircle; expressions, explode, reform) | **Pro** | Character with eyes, moods | — (only a math `smile` shape) | ⛔ Pro |
| 13 | Single `Dot` (move, resize, recolor, become) | Free core, uses Pro avatar renderer | One dot animates through states | Can be approximated with count=1 + timeline | 🟡 |
| 14 | Particle objects: geometry / letters / images / live HTML per particle | Free | Each particle is a shape/glyph | Round dots (canvas) or square dots (>3k) / GL point sprites | 🟡 dots only |
| 15 | Textures: chrome, ink, neon, glass (roughness, light dir, chromatic edges) | Free showcase | Material shading per particle | Colour modes: gradient-y/x, radial, index, speed, image, solid; 8 palettes + any of 556 dataset gradients | 🟡 colour, no material shading |
| 16 | Scroll & triggers, maps & directions, DOM targets, viewport effects | Free/Pro mix | Scroll-linked swarms | — | ⛔ not built |
| 17 | Custom geometry | Free | Supply own points | `morph(Float32Array)`, SVG paste, image upload | ✅ |
| 18 | Studio: visual composer, timeline (choreography 0–12 s), SVG import, density, timings, cloud projects, exports | **Pro** | Web editor | Original **Dots Studio** (`/dots`): timeline editor, SVG paste, count/density, per-step timing, JSON save/load, share link, PNG/WebM, embed snippet. No cloud accounts | ✅ original (local only) |
| 19 | Image → dots | (Objects/Images) | Particles take an image | `imagePoints()` luminance-weighted sampling + per-dot colours | ✅ |
| 20 | Audio-reactive | not shown on dotsui | — | Mic or audio file → AnalyserNode drives dot size + pointer force | ✅ (ours) |
| 21 | Agent skill / SKILL.md / plain-text docs | Free | Docs for coding agents | README + this map + API header in `forkbomb-dots.js` | 🟡 |
| 22 | Embeddable library | Free (React) | npm package | `forkbomb-dots.js` (MIT, zero deps, ~6 KB min-ish, vanilla) + `example.html` | ✅ |
| 23 | Performance | — | ~1–2k dots | Typed arrays; canvas2D colour-bucketed batching; WebGL2 `GL_POINTS` single draw call; 10k dots | ✅ |

## Summary
- **Free core (public):** shapes (53), DotSwarm morph, UI primitives, particle text, basic physics, scroll controls, sequences, particle objects/textures.
- **Pro ($149, proprietary, excluded):** 118 specialist shapes, multi-track sequences, event graphs/triggers, advanced physics (collisions + text colliders), formations, UI choreography, avatars, Studio with cloud projects.
- **Ours (MIT, original):** 90 math shapes + any text/SVG/image, staggered eased morph (9 easings, 6 stagger orders), spring/gravity/pointer/collisions-lite/explode/rain/reform, 8 dot UI controls, colour modes + dataset gradients, audio-reactive, PNG/WebM/embed/JSON/share link, timeline editor, standalone lib, 10k-dot WebGL2 path.
- **Not done:** avatars, multi-track/event graphs, DOM-text colliders, scroll triggers, per-particle materials/glyphs/HTML, cloud projects, React wrapper.
