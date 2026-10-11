// Neon synthwave: scrolling perspective grid over dark terrain, a banded gradient sun, mountain silhouettes, scanlines and glow.
#include "noise.glsl"
#include "post.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float hz = 0.0;
  vec3 col = mix(vec3(0.05, 0.0, 0.12), vec3(0.65, 0.1, 0.45), smoothstep(0.9, hz, uv.y));
  // sun
  vec2 sp = uv - vec2(0.0, 0.32);
  float sr = length(sp);
  float bands = step(fract((uv.y + iTime * 0.03) * 16.0), mix(0.25, 1.0, clamp((uv.y - 0.12) / 0.26, 0.0, 1.0)));
  float sun = smoothstep(0.42, 0.41, sr) * mix(bands, 1.0, step(0.32, uv.y));
  vec3 sunCol = mix(vec3(1.0, 0.15, 0.55), vec3(1.0, 0.9, 0.2), smoothstep(0.0, 0.7, uv.y));
  col = mix(col, sunCol, sun);
  col += sunCol * 0.35 * exp(-3.5 * max(sr - 0.4, 0.0));
  // mountains
  float m = 0.12 + 0.13 * abs(snoise(vec2(uv.x * 2.2, 3.0))) + 0.05 * snoise(vec2(uv.x * 7.0, 1.0));
  if (uv.y > hz && uv.y < m) col = mix(vec3(0.07, 0.0, 0.14), vec3(0.6, 0.1, 0.8), smoothstep(m - 0.006, m, uv.y));
  // grid floor
  if (uv.y < hz) {
    float z = 0.35 / (hz - uv.y + 0.001);
    vec2 g = vec2(uv.x * z, z + iTime * 2.0);
    vec2 gw = abs(fract(g) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(gw.x, gw.y), 1.0);
    float glow = exp(-6.0 * min(abs(fract(g.x) - 0.5), abs(fract(g.y) - 0.5)));
    float fade = exp(-0.06 * z);
    col = vec3(0.04, 0.0, 0.08) + vec3(1.0, 0.2, 0.9) * (line + 0.25 * glow) * fade;
    col += vec3(1.0, 0.3, 0.6) * 0.5 * exp(-30.0 * (hz - uv.y));
  }
  col *= scanlines(fragCoord, 0.5);
  col *= vignette(fragCoord, 0.25);
  fragColor = vec4(pow(col, vec3(0.9)) + grain(fragCoord, iTime) * 0.03, 1.0);
}
