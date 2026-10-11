// Classic plasma: summed sines, mapped through a neon cosine palette.
#include "palette.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * 4.0;
  float t = iTime;
  float v = sin(uv.x + t) + sin(uv.y * 1.3 + t * 1.1) + sin((uv.x + uv.y) * 0.7 + t * 0.7);
  v += sin(length(uv + vec2(sin(t * 0.5), cos(t * 0.3)) * 2.0) * 2.0 - t);
  fragColor = vec4(palNeon(v * 0.25 + 0.1 * t), 1.0);
}
