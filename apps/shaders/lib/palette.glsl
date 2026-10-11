// FORKBOMB shaders lib: cosine gradient palettes, color = a + b*cos(2pi*(c*t + d)).
// Formula from Inigo Quilez's "palettes" article (iquilezles.org/articles/palettes); implementation
// and presets written fresh for FORKBOMB, MIT. Formula only, no Shadertoy code copied.
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(6.28318 * (c * t + d)); }
vec3 palRainbow(float t) { return palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67)); }
vec3 palSunset(float t) { return palette(t, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 0.5), vec3(0.8, 0.9, 0.3)); }
vec3 palOcean(float t) { return palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.10, 0.20)); }
vec3 palNeon(float t) { return palette(t, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.2, 0.25)); }
vec3 palFire(float t) { return palette(t, vec3(0.5, 0.3, 0.1), vec3(0.5, 0.4, 0.2), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.1, 0.2)); }
