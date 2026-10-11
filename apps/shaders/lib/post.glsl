// FORKBOMB shaders lib: post-processing helpers. MIT (FORKBOMB).
// ACES-fit + Reinhard tonemaps, gamma, vignette, film grain, scanlines, chromatic offset helper.
vec3 tonemapACES(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 tonemapReinhard(vec3 x) { return x / (1.0 + x); }
vec3 gammaOut(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
float vignette(vec2 fragCoord, float strength) { vec2 q = fragCoord / iResolution.xy; return pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), strength); }
float grain(vec2 fragCoord, float t) { vec3 p = fract(vec3(fragCoord, t * 60.0) * vec3(.1031, .1030, .0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z) - 0.5; }
float scanlines(vec2 fragCoord, float density) { return 0.85 + 0.15 * sin(fragCoord.y * density * 3.14159); }
// Radial chromatic offset: returns per-channel uv shift direction scaled by amount (use uv +/- result).
vec2 chromaOffset(vec2 uv, float amount) { return (uv - 0.5) * amount * dot(uv - 0.5, uv - 0.5); }
// One-call finish: tonemap, vignette, grain, gamma.
vec3 postFinish(vec3 hdr, vec2 fragCoord, float vig, float grainAmt) {
  vec3 c = tonemapACES(hdr) * vignette(fragCoord, vig);
  return gammaOut(c) + grain(fragCoord, iTime) * grainAmt;
}
