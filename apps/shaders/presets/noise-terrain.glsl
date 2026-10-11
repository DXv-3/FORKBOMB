// Raymarched fBm terrain flyover with fog and a noise sky.
#include "fbm.glsl"
#include "palette.glsl"
float height(vec2 p) { return 1.2 * fbm(p * 0.25); }
float map(vec3 p) { return p.y - height(p.xz); }
#define RM_STEPS 160
#include "raymarch.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 1.8, iTime * 1.5);
  ro.y = max(ro.y, height(ro.xz) + 0.8);
  vec3 rd = camera(ro, ro + vec3(0.3 * sin(iTime * 0.2), -0.35, 1.0)) * normalize(vec3(uv, 1.6));
  vec3 sky = mix(vec3(0.95, 0.7, 0.5), vec3(0.25, 0.4, 0.75), clamp(rd.y * 2.0, 0.0, 1.0));
  sky += 0.1 * fbm(rd.xz / max(rd.y, 0.05) + iTime * 0.05);
  vec3 col = sky;
  float t = raymarch(ro, rd * 0.6, 60.0);
  if (t > 0.0) {
    vec3 p = ro + rd * 0.6 * t, n = calcNormal(p);
    float dif = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.4))), 0.0, 1.0);
    col = palette(p.y * 0.4, vec3(0.4, 0.35, 0.3), vec3(0.3, 0.25, 0.2), vec3(1.0), vec3(0.1, 0.2, 0.3)) * (0.25 + dif);
    col = mix(col, sky, 1.0 - exp(-0.0015 * t * t));
  }
  fragColor = vec4(pow(col, vec3(0.4545)), 1.0);
}
