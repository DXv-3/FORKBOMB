// FORKBOMB shaders lib: camera helpers. MIT (FORKBOMB).
// lookAt basis, ray from pixel, orbit position (mouse-aware), screen uv.
vec2 screenUV(vec2 fragCoord) { return (2.0 * fragCoord - iResolution.xy) / iResolution.y; }
mat3 lookAt(vec3 ro, vec3 ta, float roll) { vec3 f = normalize(ta - ro), up = vec3(sin(roll), cos(roll), 0.0); vec3 r = normalize(cross(f, up)); return mat3(r, cross(r, f), f); }
vec3 camRay(vec3 ro, vec3 ta, vec2 uv, float fov) { return lookAt(ro, ta, 0.0) * normalize(vec3(uv, fov)); }
vec3 orbitCam(float radius, float height, float speed) {
  float a = speed * iTime + (iMouse.z > 0.0 ? 6.2831 * iMouse.x / iResolution.x : 0.0);
  float h = iMouse.z > 0.0 ? mix(-0.5, 2.5, iMouse.y / iResolution.y) * radius * 0.5 : height;
  return vec3(radius * cos(a), h, radius * sin(a));
}
