// FORKBOMB shaders lib: animated mesh gradients, aurora curtains, film grain (meshGrain). Original MIT code for FORKBOMB.
// Mesh gradient = inverse-distance-weighted blend of drifting colour points over a softly warped domain.
#include "gradient.glsl"
vec2 meshWarp(vec2 uv, float t, float amt) {
  return uv + amt * vec2(sin(uv.y * 3.1 + t * 0.7) + 0.5 * sin(uv.y * 7.3 - t), cos(uv.x * 2.7 - t * 0.6) + 0.5 * cos(uv.x * 6.1 + t * 1.1)) * 0.08;
}
vec2 meshPoint(int i, float t) {
  float k = float(i) * 1.618;
  vec2 home = vec2(i == 1 || i == 3 ? 0.8 : 0.2, i >= 2 ? 0.8 : 0.2);
  return home + 0.22 * vec2(sin(t * (0.31 + 0.05 * k) + k * 2.1), cos(t * (0.27 + 0.04 * k) + k * 3.7));
}
// 4-point mesh gradient. softness ~ 2..6 (higher = crisper blobs).
vec3 mesh4(vec2 uv, float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, float softness) {
  uv = meshWarp(uv, t, 1.0);
  vec3 lab = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 c = i == 0 ? c0 : i == 1 ? c1 : i == 2 ? c2 : c3;
    float w = 1.0 / pow(length(uv - meshPoint(i, t)) + 0.02, softness);
    lab += linToOklab(srgbToLinear(c)) * w; wsum += w;
  }
  return linearToSrgb(oklabToLin(lab / wsum));
}
// Aurora: layered vertical curtains; returns additive emission.
vec3 aurora(vec2 uv, float t, vec3 colA, vec3 colB) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = 0.55 + 0.12 * sin(uv.x * (2.0 + fi * 0.7) + t * (0.3 + fi * 0.07) + fi * 1.3) + 0.04 * sin(uv.x * 11.0 - t * 1.3 + fi);
    float d = uv.y - y;
    float band = exp(-max(d, 0.0) * (6.0 + fi * 2.0)) * smoothstep(-0.02, 0.01, d) * (0.6 + 0.4 * sin(uv.x * 40.0 + fi * 5.0 + t * 0.5));
    acc += mix(colA, colB, fi / 4.0) * band * 0.35;
  }
  return acc;
}
float meshGrain(vec2 fragCoord, float t) { return fract(sin(dot(fragCoord + fract(t) * 91.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }
