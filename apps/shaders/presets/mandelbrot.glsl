// Smooth-iteration Mandelbrot zoom into Seahorse Valley.
#include "palette.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float zoom = pow(0.5, 6.0 * (0.5 - 0.5 * cos(iTime * 0.15)));
  vec2 c = vec2(-0.745, 0.186) + uv * zoom * 1.5, z = vec2(0.0);
  float n = 0.0;
  for (int i = 0; i < 300; i++) { z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c; if (dot(z, z) > 256.0) break; n += 1.0; }
  vec3 col = vec3(0.0);
  if (n < 300.0) { float sn = n - log2(log2(dot(z, z))) + 4.0; col = palRainbow(0.02 * sn + 0.05 * iTime); }
  fragColor = vec4(col, 1.0);
}
