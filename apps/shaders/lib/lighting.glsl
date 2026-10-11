// FORKBOMB shaders lib: shading helpers. MIT (FORKBOMB).
// Schlick fresnel, Blinn-Phong spec, procedural sky/environment, thin-film iridescence.
float fresnelSchlick(float cosT, float f0) { return f0 + (1.0 - f0) * pow(clamp(1.0 - cosT, 0.0, 1.0), 5.0); }
float specBlinn(vec3 n, vec3 l, vec3 v, float shininess) { return pow(max(dot(n, normalize(l + v)), 0.0), shininess); }
// Cheap studio/sky environment used for reflections: horizon glow, sun disc, soft light panels.
vec3 envSky(vec3 d, vec3 sunDir) {
  float y = d.y;
  vec3 col = mix(vec3(0.55, 0.62, 0.75), vec3(0.08, 0.16, 0.38), clamp(y, 0.0, 1.0));
  col = mix(col, vec3(0.05, 0.045, 0.04), smoothstep(0.0, -0.3, y));
  float s = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.85, 0.6) * (pow(s, 600.0) * 8.0 + pow(s, 12.0) * 0.35);
  return col;
}
vec3 envStudio(vec3 d) {
  vec3 col = vec3(0.02 + 0.03 * d.y);
  col += vec3(1.2) * smoothstep(0.92, 0.97, d.y);                                   // top softbox
  col += vec3(1.0, 0.55, 0.3) * smoothstep(0.85, 0.95, dot(d, normalize(vec3(1, 0.2, 0.3))));  // warm side strip
  col += vec3(0.3, 0.6, 1.1) * smoothstep(0.88, 0.96, dot(d, normalize(vec3(-1, 0.1, -0.4)))); // cool rim strip
  col += vec3(0.25, 0.2, 0.18) * smoothstep(0.1, -0.2, d.y);                         // floor bounce
  return col;
}
// Thin-film interference approximation: film thickness (nm) and view cosine -> RGB reflectance.
vec3 thinFilm(float thicknessNm, float cosT, float ior) {
  float sinT2 = (1.0 - cosT * cosT) / (ior * ior);
  float opd = 2.0 * ior * thicknessNm * sqrt(max(1.0 - sinT2, 0.0));
  vec3 lambda = vec3(650.0, 532.0, 450.0);
  return 0.5 + 0.5 * cos(6.2831853 * opd / lambda + 3.14159);
}
