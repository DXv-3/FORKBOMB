// Aurora over a conic night-sky gradient, with stars and film grain.
#include "mesh.glsl"
#include "hash.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 sky = ramp3(gradLinear(uv, 1.5708), hexColor(0x02030a), hexColor(0x0b1033), hexColor(0x1a0b3a));
  float star = step(0.998, hash12(floor(fragCoord / 2.0))) * (0.5 + 0.5 * sin(iTime * 3.0 + fragCoord.x));
  vec3 col = sky + star + aurora(uv, iTime, hexColor(0x21ffa6), hexColor(0x8a5cff));
  col += meshGrain(fragCoord, iTime) * 0.05 + gradDither(fragCoord);
  fragColor = vec4(col, 1.0);
}
