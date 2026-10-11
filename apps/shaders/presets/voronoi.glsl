// Animated Voronoi cells (hash-driven feature points) with palette-colored cells and edges.
#include "hash.glsl"
#include "palette.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * 6.0;
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), o = hash22(i + g);
    o = 0.5 + 0.5 * sin(iTime + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d;
  }
  vec3 col = palRainbow(hash12(id) + 0.05 * iTime) * (0.6 + 0.4 * (1.0 - d1));
  col = mix(vec3(0.02), col, smoothstep(0.02, 0.06, d2 - d1));
  fragColor = vec4(col, 1.0);
}
