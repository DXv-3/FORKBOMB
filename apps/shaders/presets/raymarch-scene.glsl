// Raymarched scene: smooth-blended torus + spheres over a checker floor, soft shadows + AO.
#include "sdf.glsl"
float map(vec3 p) {
  vec3 q = p - vec3(0.0, 1.0, 0.0);
  q.xz *= rot2(iTime * 0.4);
  q.xy *= rot2(iTime * 0.3);
  float d = sdTorus(q, vec2(0.8, 0.25));
  d = opSmoothUnion(d, sdSphere(p - vec3(sin(iTime) * 1.2, 1.0 + 0.4 * cos(iTime * 1.3), 0.0), 0.45), 0.4);
  d = opSmoothUnion(d, sdRoundBox(p - vec3(0.0, 1.0, cos(iTime * 0.7) * 1.3), vec3(0.3), 0.08), 0.3);
  return min(d, sdPlane(p, vec3(0, 1, 0), 0.0));
}
#include "raymarch.glsl"
#include "palette.glsl"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float a = 0.3 * iTime + (iMouse.z > 0.0 ? 6.0 * iMouse.x / iResolution.x : 0.0);
  vec3 ro = vec3(4.0 * cos(a), 2.2, 4.0 * sin(a)), ta = vec3(0.0, 0.8, 0.0);
  vec3 rd = camera(ro, ta) * normalize(vec3(uv, 1.8));
  vec3 col = mix(vec3(0.9, 0.6, 0.4), vec3(0.2, 0.3, 0.6), uv.y * 0.5 + 0.5);
  float t = raymarch(ro, rd, 30.0);
  if (t > 0.0) {
    vec3 p = ro + rd * t, n = calcNormal(p), l = normalize(vec3(0.6, 0.8, -0.4));
    vec3 alb = p.y < 0.01 ? vec3(0.25 + 0.2 * mod(floor(p.x) + floor(p.z), 2.0)) : palNeon(0.1 * length(p) + 0.1 * iTime);
    float dif = clamp(dot(n, l), 0.0, 1.0) * softShadow(p + n * 0.01, l, 12.0);
    float spe = pow(clamp(dot(reflect(rd, n), l), 0.0, 1.0), 32.0);
    col = alb * (0.15 * calcAO(p, n) + dif) + spe * dif;
    col = mix(col, vec3(0.2, 0.3, 0.6), 1.0 - exp(-0.004 * t * t));
  }
  fragColor = vec4(pow(col, vec3(0.4545)), 1.0);
}
