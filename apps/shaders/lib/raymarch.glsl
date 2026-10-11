// FORKBOMB shaders lib: sphere-tracing helpers. MIT (FORKBOMB).
// Define `float map(vec3 p)` BEFORE including this file.
#ifndef RM_STEPS
#define RM_STEPS 128
#endif
float raymarch(vec3 ro, vec3 rd, float maxd) { float t = 0.0; for (int i = 0; i < RM_STEPS; i++) { float d = map(ro + rd * t); if (d < 0.001 * t) return t; t += d; if (t > maxd) break; } return -1.0; }
vec3 calcNormal(vec3 p) { vec2 e = vec2(0.001, 0.0); return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
float softShadow(vec3 ro, vec3 rd, float k) { float res = 1.0, t = 0.02; for (int i = 0; i < 48; i++) { float h = map(ro + rd * t); res = min(res, k * h / t); t += clamp(h, 0.02, 0.2); if (res < 0.001 || t > 20.0) break; } return clamp(res, 0.0, 1.0); }
float calcAO(vec3 p, vec3 n) { float o = 0.0, s = 1.0; for (int i = 1; i <= 5; i++) { float h = 0.03 * float(i); o += (h - map(p + n * h)) * s; s *= 0.7; } return clamp(1.0 - 3.0 * o, 0.0, 1.0); }
mat3 camera(vec3 ro, vec3 ta) { vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f); return mat3(r, u, f); }
