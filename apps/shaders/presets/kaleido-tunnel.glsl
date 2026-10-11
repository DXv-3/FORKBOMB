// Kaleidoscopic fractal tunnel: polar-folded IFS fractal rushing toward the camera, depth-fogged, with ACES grading and bloom-ish glow.
#include "palette.glsl"
#include "post.glsl"
vec3 tunnel(vec2 uv, float t) {
  float r = length(uv), a = atan(uv.y, uv.x);
  float seg = 6.2831853 / 8.0;
  a = abs(mod(a + t * 0.1, seg) - seg * 0.5);
  float z = 0.6 / max(r, 0.02) + t * 1.2;
  vec2 p = vec2(a * 2.0, fract(z * 0.25) * 4.0 - 2.0);
  vec3 col = vec3(0.0); float glow = 0.0;
  for (int i = 0; i < 7; i++) {
    p = abs(p) / dot(p, p) - vec2(0.82 + 0.06 * sin(t * 0.3), 0.55);
    glow += exp(-6.0 * abs(length(p) - 0.6));
    col += palette(float(i) * 0.09 + z * 0.05, vec3(0.5), vec3(0.5), vec3(1.0, 0.9, 0.8), vec3(0.0, 0.15, 0.35)) * exp(-3.0 * length(p));
  }
  float fog = smoothstep(0.0, 0.35, r);
  return (col * 0.35 + glow * 0.05 * vec3(1.0, 0.6, 0.9)) * fog * (1.0 + 2.0 * exp(-20.0 * r));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 col = vec3(0.0);
  for (int j = 0; j < 4; j++) {               // 2x2 supersampling
    vec2 o = vec2(float(j % 2), float(j / 2)) * 0.5 - 0.25;
    vec2 uv = (2.0 * (fragCoord + o) - iResolution.xy) / iResolution.y;
    uv *= mat2(cos(iTime * 0.15), sin(iTime * 0.15), -sin(iTime * 0.15), cos(iTime * 0.15));
    col += tunnel(uv, iTime);
  }
  col *= 0.25;
  fragColor = vec4(postFinish(col * 1.4, fragCoord, 0.3, 0.025), 1.0);
}
