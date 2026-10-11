// Prism glass: a raymarched rounded glass knot-box refracting a neon backdrop, with per-channel IOR dispersion (chromatic aberration) and fresnel reflection.
#include "sdf.glsl"
#include "camera.glsl"
#include "lighting.glsl"
#include "post.glsl"
float map(vec3 p) {
  p.xz *= rot2(iTime * 0.3); p.xy *= rot2(iTime * 0.21);
  float b = sdRoundBox(p, vec3(0.7), 0.18);
  float t = sdTorus(p.xzy, vec2(1.0, 0.18));
  return opSmoothUnion(opSubtract(sdSphere(p, 0.85), b), t, 0.15);
}
#define RM_STEPS 80
#include "raymarch.glsl"
vec3 backdrop(vec3 d) {
  vec2 q = vec2(atan(d.z, d.x), d.y);
  float stripes = smoothstep(0.97, 1.0, sin(q.x * 14.0 + iTime * 0.3)) + smoothstep(0.98, 1.0, sin(q.y * 22.0));
  vec3 base = mix(vec3(0.02, 0.01, 0.05), vec3(0.06, 0.02, 0.1), d.y * 0.5 + 0.5);
  return base + stripes * mix(vec3(1.0, 0.2, 0.6), vec3(0.2, 0.7, 1.0), 0.5 + 0.5 * sin(q.x * 3.0)) * 1.5 + envStudio(d) * 0.4;
}
// march inside the glass (negated SDF) to find exit point
vec3 throughGlass(vec3 p, vec3 rd, vec3 n, float ior) {
  vec3 r = refract(rd, n, 1.0 / ior);
  float t = 0.02;
  for (int i = 0; i < 40; i++) { float d = -map(p + r * t); if (d < 0.001) break; t += max(d, 0.01); }
  vec3 q = p + r * t, n2 = -calcNormal(q);
  vec3 o = refract(r, n2, ior);
  if (dot(o, o) < 0.01) o = reflect(r, n2);
  return backdrop(o) * exp(-t * vec3(0.15, 0.08, 0.05));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = screenUV(fragCoord);
  vec3 ro = orbitCam(3.1, 0.8, 0.12);
  vec3 rd = camRay(ro, vec3(0.0), uv, 1.8);
  vec3 col = backdrop(rd);
  float t = raymarch(ro, rd, 12.0);
  if (t > 0.0) {
    vec3 p = ro + rd * t, n = calcNormal(p);
    vec3 refr = vec3(throughGlass(p, rd, n, 1.45).r, throughGlass(p, rd, n, 1.50).g, throughGlass(p, rd, n, 1.56).b);
    float f = fresnelSchlick(max(dot(n, -rd), 0.0), 0.04);
    col = mix(refr, backdrop(reflect(rd, n)), f) + specBlinn(n, normalize(vec3(0.3, 1.0, 0.2)), -rd, 300.0) * 2.0;
  }
  fragColor = vec4(postFinish(col * 1.2, fragCoord, 0.25, 0.02), 1.0);
}
