// Mesh gradient: four drifting OKLab colour points, soft warp, dithered + grain.
#include "mesh.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 col = mesh4(uv, iTime, hexColor(0xff6b9d), hexColor(0x7b5cff), hexColor(0x00d4ff), hexColor(0xffd166), 3.0);
  col += meshGrain(fragCoord, iTime) * 0.06 + gradDither(fragCoord);
  fragColor = vec4(col, 1.0);
}
