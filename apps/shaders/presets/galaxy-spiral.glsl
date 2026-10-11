// Particle galaxy: thousands of hashed star particles on logarithmic spiral arms with dust lanes, a glowing bulge, and a tilted cinematic orbit.
#include "hash.glsl"
#include "noise.glsl"
#include "post.glsl"
vec3 starColor(float k) { return mix(mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.95, 0.85), smoothstep(0.0, 0.5, k)), vec3(0.6, 0.75, 1.0), smoothstep(0.5, 1.0, k)); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float tilt = 0.45 + 0.1 * sin(iTime * 0.1);
  vec2 g = vec2(uv.x, uv.y / tilt);                // project screen onto tilted galactic plane
  g *= mat2(cos(iTime * 0.05), sin(iTime * 0.05), -sin(iTime * 0.05), cos(iTime * 0.05));
  float r = length(g), a = atan(g.y, g.x);
  // spiral arm density (2 arms, log spiral) with turbulence
  float arm = 0.5 + 0.5 * cos(2.0 * (a - 2.2 * log(r + 0.05)) + 0.6 * snoise(g * 3.0));
  arm = pow(arm, 3.0) * exp(-r * 2.2);
  float dust = smoothstep(0.3, 0.9, 0.5 + 0.5 * cos(2.0 * (a - 2.2 * log(r + 0.05)) - 0.5)) * smoothstep(0.08, 0.3, r);
  vec3 col = vec3(0.0);
  col += vec3(0.5, 0.6, 1.0) * arm * 1.4 * (0.7 + 0.3 * snoise(g * 8.0));
  col += vec3(1.0, 0.75, 0.45) * exp(-r * 9.0) * 2.5 + vec3(1.0, 0.6, 0.3) * exp(-r * 3.5) * 0.4;
  col *= 1.0 - 0.55 * dust * (0.6 + 0.4 * snoise(g * 12.0));
  col += vec3(1.0, 0.35, 0.55) * pow(arm, 2.0) * smoothstep(0.6, 0.9, snoise(g * 14.0)) * 2.0; // HII regions
  // star particles: jittered points in three grid scales, weighted by arm density
  for (int l = 0; l < 3; l++) {
    float sc = 60.0 + 70.0 * float(l);
    vec2 cell = floor(g * sc), f = fract(g * sc);
    vec2 h = hash22(cell + float(l) * 31.0);
    float pr = hash12(cell * 1.7 + float(l));
    float dens = arm * 4.0 + exp(-r * 6.0) + 0.04;
    if (pr < dens) {
      float d = length(f - h) / sc * iResolution.y * 0.5;
      float tw = 0.7 + 0.3 * sin(iTime * 3.0 + pr * 50.0);
      col += starColor(hash12(cell + 9.0)) * exp(-d * d * 1.4) * tw * (0.6 + pr);
    }
  }
  vec2 bg = floor(fragCoord / 2.0);
  col += vec3(0.8) * step(0.9985, hash12(bg)) * hash12(bg + 3.0);
  fragColor = vec4(postFinish(col, fragCoord, 0.3, 0.02), 1.0);
}
