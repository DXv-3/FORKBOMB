// Iridescent soap bubble: raymarched wobbling bubble with physically-motivated thin-film interference, swirling film thickness and fresnel.
#include "noise.glsl"
#include "camera.glsl"
#include "lighting.glsl"
#include "post.glsl"
float sphereHit(vec3 ro, vec3 rd, float r) { float b = dot(ro, rd), c = dot(ro, ro) - r * r, h = b * b - c; return h < 0.0 ? -1.0 : -b - sqrt(h); }
vec3 shadeFilm(vec3 p, vec3 n, vec3 rd, vec3 sun) {
  float cosT = abs(dot(n, rd));
  // film drains downward (thicker at the bottom) and swirls with flow noise
  float th = 380.0 + 260.0 * (0.5 - 0.5 * p.y) + 160.0 * snoise(vec3(p * 1.8 + vec3(0.0, iTime * 0.25, 0.0)));
  vec3 film = thinFilm(th, cosT, 1.33);
  float f = fresnelSchlick(cosT, 0.04);
  vec3 refl = envSky(reflect(rd, n), sun);
  return film * refl * (0.35 + 1.6 * f) + specBlinn(n, sun, -rd, 400.0) * 3.0;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 sun = normalize(vec3(0.5, 0.6, -0.4));
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    vec2 o = vec2(float(j % 2), float(j / 2)) * 0.5 - 0.25;
    vec2 uv = screenUV(fragCoord + o);
    vec3 ro = orbitCam(3.4, 0.3, 0.1);
    vec3 rd = camRay(ro, vec3(0.0), uv, 1.6);
    vec3 col = envSky(rd, sun) * 0.6;
    // gentle wobble: perturb ray origin slightly in time-varying way
    float t = sphereHit(ro, rd, 1.0);
    if (t > 0.0) {
      vec3 p = ro + rd * t;
      vec3 n = normalize(p + 0.04 * vec3(sin(3.0 * p.y + iTime * 2.0), sin(3.0 * p.z + iTime * 1.7), sin(3.0 * p.x + iTime * 2.3)));
      vec3 front = shadeFilm(p, n, rd, sun);
      float b = dot(ro, rd), t2 = -b + sqrt(b * b - dot(ro, ro) + 1.0);
      vec3 p2 = ro + rd * t2;
      vec3 back = shadeFilm(p2, -normalize(p2), rd, sun);
      col = col * 0.92 + front * 0.55 + back * 0.3;
    }
    acc += col;
  }
  fragColor = vec4(postFinish(acc * 0.25 * 1.2, fragCoord, 0.25, 0.02), 1.0);
}
