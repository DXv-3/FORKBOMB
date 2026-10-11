// Ocean at dusk: heightfield-raymarched procedural swell (layered directional waves + choppy noise), fresnel sky reflection, subsurface tint, sun glitter and haze.
#include "noise.glsl"
#include "camera.glsl"
#include "lighting.glsl"
#include "post.glsl"
float waves(vec2 p, int oct) {
  float h = 0.0, a = 0.45, f = 0.35; vec2 dir = vec2(1.0, 0.3);
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float ph = dot(p, normalize(dir)) * f + iTime * sqrt(9.8 * f) * 0.6;
    h += a * (1.0 - abs(sin(ph))) ;          // sharp crests
    dir = r * dir; f *= 1.9; a *= 0.42;
  }
  return h - 0.5 + 0.06 * snoise(p * 1.5 + iTime * 0.3);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = screenUV(fragCoord);
  vec3 sun = normalize(vec3(0.0, 0.08, 1.0));
  vec3 ro = vec3(iTime * 0.6, 2.2 + 0.2 * sin(iTime * 0.3), 0.0);
  vec3 rd = lookAt(ro, ro + vec3(0.0, -0.18, 1.0), 0.03 * sin(iTime * 0.4)) * normalize(vec3(uv, 1.6));
  vec3 skyTop = vec3(0.12, 0.16, 0.35), skyHz = vec3(1.0, 0.45, 0.2);
  vec3 sky = mix(skyHz, skyTop, pow(clamp(rd.y, 0.0, 1.0), 0.45));
  float sd = max(dot(rd, sun), 0.0);
  sky += vec3(1.0, 0.6, 0.3) * (pow(sd, 900.0) * 20.0 + pow(sd, 8.0) * 0.5);
  vec3 col = sky;
  if (rd.y < 0.0) {
    float t = 0.0, lh = 0.0, ly = 0.0;
    for (int i = 0; i < 90; i++) {
      vec3 p = ro + rd * t;
      float h = p.y - waves(p.xz, 4);
      if (h < 0.002 * t) break;
      t += max(h * 0.6, 0.02 + 0.004 * t);
      if (t > 80.0) break;
    }
    vec3 p = ro + rd * t;
    vec2 e = vec2(0.02 + 0.001 * t, 0.0);
    vec3 n = normalize(vec3(waves(p.xz - e.xy, 6) - waves(p.xz + e.xy, 6), 2.0 * e.x, waves(p.xz - e.yx, 6) - waves(p.xz + e.yx, 6)));
    vec3 r = reflect(rd, n); r.y = abs(r.y);
    float f = fresnelSchlick(max(dot(n, -rd), 0.0), 0.02);
    vec3 refl = mix(skyHz, skyTop, pow(r.y, 0.45)) + vec3(1.0, 0.6, 0.3) * pow(max(dot(r, sun), 0.0), 600.0) * 30.0;
    vec3 deep = vec3(0.01, 0.05, 0.08), sss = vec3(0.05, 0.25, 0.22) * max(p.y + 0.3, 0.0) * pow(max(dot(rd, sun), 0.0), 2.0);
    col = mix(deep + sss, refl, f);
    col = mix(col, skyHz * 0.9, 1.0 - exp(-0.0006 * t * t));
  }
  fragColor = vec4(postFinish(col * 1.1, fragCoord, 0.2, 0.02), 1.0);
}
