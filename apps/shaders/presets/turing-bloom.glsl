// Turing bloom: a single-pass reaction-diffusion look -- band-passed, domain-warped noise thresholded into labyrinth stripes and spots.
#include "noise.glsl"
#include "palette.glsl"
#include "post.glsl"
float field(vec2 p, float t) {
  // difference of gaussians-ish: fine noise minus coarse noise produces RD-like band-pass structure
  vec2 w = p + 0.35 * vec2(snoise(p * 0.7 + t * 0.1), snoise(p * 0.7 - t * 0.1 + 5.2));
  float a = 0.0, amp = 1.0;
  mat2 r = mat2(0.6, 0.8, -0.8, 0.6);
  for (int i = 0; i < 3; i++) { a += amp * sin(snoise(w * 2.2) * 6.0 + t * 0.4); w = r * w * 1.7; amp *= 0.3; }
  return a;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float t = iTime;
  vec2 p = uv * 1.4;
  float f = field(p, t);
  float spots = smoothstep(-0.2, 0.9, length(uv)) ; // stripes in centre melt into spots at the edge
  float th = mix(0.0, 0.6, spots);
  float e = fwidth(f) * 1.5;
  float m = smoothstep(th - e, th + e, f);
  vec2 eps = vec2(0.01, 0.0);
  vec3 n = normalize(vec3(field(p + eps.xy, t) - field(p - eps.xy, t), field(p + eps.yx, t) - field(p - eps.yx, t), 0.15));
  float light = 0.6 + 0.4 * dot(n, normalize(vec3(-0.4, 0.6, 0.7)));
  vec3 a = palette(0.15 + 0.1 * uv.x, vec3(0.9, 0.85, 0.75), vec3(0.1), vec3(1.0), vec3(0.0));
  vec3 b = palette(f * 0.1 + 0.6 + 0.05 * t, vec3(0.35, 0.15, 0.2), vec3(0.35, 0.2, 0.25), vec3(1.0), vec3(0.0, 0.15, 0.3));
  vec3 col = mix(a, b, m) * mix(1.0, light, m);
  fragColor = vec4(col * vignette(fragCoord, 0.15), 1.0);
}
