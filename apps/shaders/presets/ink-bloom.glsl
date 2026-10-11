// Ink in water: curl-noise advected dye plumes (iterated flow-warp) in two pigments diffusing through milky water, with paper-like grading.
#include "noise.glsl"
#include "post.glsl"
vec2 curl(vec2 p, float t) {
  vec2 e = vec2(0.01, 0.0);
  float n1 = snoise(vec3(p + e.yx, t)), n2 = snoise(vec3(p - e.yx, t));
  float n3 = snoise(vec3(p + e.xy, t)), n4 = snoise(vec3(p - e.xy, t));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e.x);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float t = iTime * 0.12;
  vec2 p = uv * 1.3;
  // advect backwards along the curl field: emulates dye carried by a divergence-free flow
  for (int i = 0; i < 10; i++) p -= 0.035 * curl(p * 1.2, t + float(i) * 0.015);
  float plumeA = smoothstep(0.55, 0.0, length(p - vec2(-0.35, 0.25 - 0.1 * sin(t * 3.0))));
  float plumeB = smoothstep(0.5, 0.0, length(p - vec2(0.4, -0.2)));
  float detail = 0.5 + 0.5 * snoise(p * 6.0 + t);
  plumeA *= 0.7 + 0.3 * detail; plumeB *= 0.7 + 0.3 * (1.0 - detail);
  vec3 water = vec3(0.93, 0.92, 0.88) - 0.05 * length(uv);
  vec3 inkA = vec3(0.05, 0.12, 0.45), inkB = vec3(0.75, 0.1, 0.18);
  vec3 col = water;
  col *= mix(vec3(1.0), inkA * 1.2 + 0.05, pow(plumeA, 0.8));     // subtractive (multiply) mixing like real pigment
  col *= mix(vec3(1.0), inkB * 1.1 + 0.1, pow(plumeB, 0.8));
  col += 0.04 * smoothstep(0.02, 0.0, abs(plumeA - 0.3)) + 0.04 * smoothstep(0.02, 0.0, abs(plumeB - 0.3)); // tidelines
  col *= vignette(fragCoord, 0.12);
  fragColor = vec4(col + grain(fragCoord, iTime) * 0.025, 1.0);
}
