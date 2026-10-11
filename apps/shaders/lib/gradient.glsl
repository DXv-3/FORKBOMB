// FORKBOMB shaders lib: gradient helpers. Original MIT code for FORKBOMB.
// Multi-stop ramps (up to 6 stops), linear/radial/conic parameterisations, OKLab mixing, dithering.
vec3 srgbToLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 linearToSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
vec3 linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(l, 1.0 / 3.0); m = pow(m, 1.0 / 3.0); s = pow(s, 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
// Perceptual mix of two sRGB colors.
vec3 mixOklab(vec3 a, vec3 b, float t) {
  return linearToSrgb(oklabToLin(mix(linToOklab(srgbToLinear(a)), linToOklab(srgbToLinear(b)), t)));
}
vec3 hexColor(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0; }
// Evenly spaced ramp across n (2..6) stops.
vec3 ramp(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, int n) {
  t = clamp(t, 0.0, 1.0) * float(n - 1);
  int i = int(min(floor(t), float(n - 2)));
  float f = smoothstep(0.0, 1.0, t - float(i));
  vec3 a = c0, b = c1;
  if (i == 1) { a = c1; b = c2; } else if (i == 2) { a = c2; b = c3; }
  else if (i == 3) { a = c3; b = c4; } else if (i == 4) { a = c4; b = c5; }
  return mixOklab(a, b, f);
}
vec3 ramp3(float t, vec3 a, vec3 b, vec3 c) { return ramp(t, a, b, c, c, c, c, 3); }
float gradLinear(vec2 uv, float angle) { vec2 d = vec2(cos(angle), sin(angle)); return dot(uv - 0.5, d) / (abs(d.x) + abs(d.y)) + 0.5; }
float gradRadial(vec2 uv, vec2 center, float radius) { return length(uv - center) / radius; }
float gradConic(vec2 uv, vec2 center, float start) { vec2 p = uv - center; return fract((atan(p.y, p.x) - start) / 6.28318530718 + 1.0); }
// Triangular-ish dither to kill 8-bit banding: add to final color.
float gradDither(vec2 fragCoord) { return (fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; }
