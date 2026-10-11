// Domain-warped fBm (noise of noise of noise) tinted with a cosine palette.
#include "fbm.glsl"
#include "palette.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = 3.0 * fragCoord / iResolution.y + iMouse.xy / iResolution.y;
  vec2 q, r;
  float f = warp(p, iTime, q, r);
  vec3 col = palSunset(0.5 + 0.5 * f + 0.3 * length(q));
  col = mix(col, palOcean(length(r)), clamp(r.x * r.x, 0.0, 1.0) * 0.6);
  col *= 0.6 + 0.6 * f * f + 0.4 * length(q);
  fragColor = vec4(col, 1.0);
}
