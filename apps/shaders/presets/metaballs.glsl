// 2D metaballs: smooth-union of drifting circles with glowing iso-lines.
#include "sdf.glsl"
#include "hash.glsl"
#include "palette.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float d = 1e3;
  for (int i = 0; i < 8; i++) {
    vec2 h = hash22(vec2(float(i), 7.0)) * 6.28;
    vec2 c = 0.8 * vec2(sin(iTime * (0.5 + 0.3 * h.x) + h.y), cos(iTime * (0.4 + 0.2 * h.y) + h.x));
    d = opSmoothUnion(d, sdCircle(uv - c, 0.18 + 0.08 * sin(h.x + iTime)), 0.35);
  }
  if (iMouse.z > 0.0) d = opSmoothUnion(d, sdCircle(uv - (2.0 * iMouse.xy - iResolution.xy) / iResolution.y, 0.25), 0.35);
  vec3 col = d < 0.0 ? palFire(0.5 - d * 2.0) : vec3(0.02, 0.02, 0.06) + palOcean(d) * exp(-6.0 * d) * 0.6;
  col += 0.4 * exp(-80.0 * abs(d)) + 0.08 * smoothstep(0.02, 0.0, abs(fract(d * 8.0) - 0.5) - 0.45) * step(0.0, d);
  fragColor = vec4(col, 1.0);
}
