// FORKBOMB shaders lib: fractal Brownian motion + domain warping on top of simplex noise. MIT (FORKBOMB).
#include "noise.glsl"
float fbm(vec2 p) { float a = 0.5, s = 0.0; mat2 r = mat2(0.8, 0.6, -0.6, 0.8); for (int i = 0; i < 6; i++) { s += a * snoise(p); p = r * p * 2.02; a *= 0.5; } return s; }
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * snoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// Domain warp: f(p + fbm(p + fbm(p))). Returns warped value, writes intermediate warps to q/r.
float warp(vec2 p, float t, out vec2 q, out vec2 r) {
  q = vec2(fbm(p + vec2(0.0, 0.0) + 0.05 * t), fbm(p + vec2(5.2, 1.3)));
  r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t), fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t));
  return fbm(p + 4.0 * r);
}
