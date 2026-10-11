// Liquid chrome: a raymarched mercury blob of smooth-merged orbiting droplets, mirror-reflecting a studio environment.
#include "sdf.glsl"
#include "noise.glsl"
float map(vec3 p) {
  float t = iTime * 0.7;
  float d = sdSphere(p, 0.75 + 0.05 * sin(3.0 * p.y + t * 2.0));
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec3 c = vec3(sin(t * (0.6 + 0.13 * fi) + fi * 1.7), cos(t * (0.5 + 0.11 * fi) + fi * 2.3) * 0.8, sin(t * (0.7 + 0.07 * fi) + fi * 4.1)) * 0.78;
    d = opSmoothUnion(d, sdSphere(p - c, 0.32 + 0.08 * sin(fi + t)), 0.55);
  }
  return d + 0.025 * snoise(p * 3.0 + vec3(0.0, iTime * 0.5, 0.0));
}
#define RM_STEPS 96
#include "raymarch.glsl"
#include "camera.glsl"
#include "lighting.glsl"
#include "post.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = screenUV(fragCoord);
  vec3 ro = orbitCam(3.6, 0.7, 0.15);
  vec3 rd = camRay(ro, vec3(0.0), uv, 1.7);
  vec3 col = mix(vec3(0.09, 0.08, 0.1), vec3(0.01), length(uv) * 0.8);
  float t = raymarch(ro, rd, 12.0);
  if (t > 0.0) {
    vec3 p = ro + rd * t, n = calcNormal(p), r = reflect(rd, n);
    float f = fresnelSchlick(max(dot(n, -rd), 0.0), 0.75);
    vec3 refl = envStudio(r);
    float ao = calcAO(p, n);
    col = refl * mix(vec3(0.85, 0.88, 0.95), vec3(1.0), f) * (0.4 + 0.6 * ao);
    col += 0.6 * specBlinn(n, normalize(vec3(0.4, 1.0, 0.2)), -rd, 200.0);
  }
  fragColor = vec4(postFinish(col * 1.3, fragCoord, 0.2, 0.02), 1.0);
}
