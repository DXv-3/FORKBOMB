// Volumetric nebula: front-to-back raymarched fbm density lit by an embedded star, with emission colour by depth and a starfield.
#include "noise.glsl"
#include "fbm.glsl"
#include "hash.glsl"
#include "camera.glsl"
#include "post.glsl"
float density(vec3 p) {
  float r = length(p);
  vec3 q = p + 0.6 * vec3(fbm(p * 0.6 + iTime * 0.05), fbm(p * 0.6 + 7.3), fbm(p * 0.6 - 3.1));
  float f = fbm(q * 1.1);
  return clamp(f + 0.35 - 0.22 * r, 0.0, 1.0);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = screenUV(fragCoord);
  vec3 ro = orbitCam(4.0, 0.6, 0.04);
  vec3 rd = camRay(ro, vec3(0.0), uv, 1.4);
  vec3 bg = vec3(0.004, 0.003, 0.012);
  vec3 cell = floor(rd * 180.0);
  float st = hash13(cell);
  bg += vec3(0.9, 0.9, 1.0) * step(0.997, st) * hash13(cell + 1.0) * 2.0;
  vec3 acc = vec3(0.0); float trans = 1.0;
  float t = 1.2 + 0.08 * hash12(fragCoord);
  for (int i = 0; i < 56; i++) {
    vec3 p = ro + rd * t;
    float d = density(p);
    if (d > 0.01) {
      float rr = length(p);
      vec3 emit = mix(vec3(1.0, 0.35, 0.5), vec3(0.2, 0.45, 1.0), smoothstep(0.3, 2.2, rr));
      emit = mix(emit, vec3(1.0, 0.85, 0.5), exp(-rr * 3.0));
      vec3 light = emit * (0.6 + 2.5 * exp(-rr * 1.6));
      float a = d * 0.12;
      acc += trans * a * light;
      trans *= 1.0 - a;
      if (trans < 0.02) break;
    }
    t += 0.09;
    if (t > 7.0) break;
  }
  float core = exp(-8.0 * length(cross(rd, -ro)) / length(ro));
  vec3 col = bg * trans + acc + vec3(1.0, 0.8, 0.6) * core * 1.5 * trans;
  fragColor = vec4(postFinish(col * 1.6, fragCoord, 0.25, 0.03), 1.0);
}
