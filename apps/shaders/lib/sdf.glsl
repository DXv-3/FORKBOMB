// FORKBOMB shaders lib: signed distance primitives and operators. MIT (FORKBOMB), written fresh.
// Primitive set follows marklundin/glsl-sdf-primitives + glsl-sdf-ops (MIT); math per the standard
// distance-function formulas (sphere, box, torus, capsule, smooth min). No CC BY-NC-SA code copied.
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdPlane(vec3 p, vec3 n, float h) { return dot(p, n) + h; }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float opUnion(float a, float b) { return min(a, b); }
float opSubtract(float a, float b) { return max(a, -b); }
float opIntersect(float a, float b) { return max(a, b); }
float opSmoothUnion(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
vec3 opRepeat(vec3 p, vec3 c) { return mod(p + 0.5 * c, c) - 0.5 * c; }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
