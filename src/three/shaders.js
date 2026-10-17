// GLSL for every custom material. Written in GLSL ES 1.0 style; three.js upgrades it for WebGL2.
// Colours passed as uniforms are linear (three converts hex on Color construction).
// Output is linear too: the post-processing pass converts to sRGB at the end.
//
// Arcane rules for every lit surface: light falls in three painted bands with brushed (jittered)
// borders, albedo is dragged into strokes, a coloured rim light in the city accent sits on the edge,
// and anything that is FX rather than matter (coronas, disks, jets, tails) animates on twos.

export const noise = /* glsl */ `
// Simplex 3D noise, Ian McEwan / Ashima Arts (MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    f += a * snoise(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return f;
}
float fbm3(vec3 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    f += a * snoise(p);
    p = p * 2.1 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return f;
}
// ---- paint helpers ----
// time held for 1/fps seconds at a time (fps 0 = continuous, used for reduced motion)
float stepT(float t, float fps) { return fps > 0.0 ? floor(t * fps) / fps : t; }
// noise stretched along dir so flat colour reads as dragged paint
float strokes(vec3 o, vec3 dir, float freq, float seed) { vec3 q = o * freq; q -= dir * dot(q, dir) * 0.85; return snoise(q + seed); }
// three light bands with jittered thresholds and a soft shoulder
float ramp(float ndl, float j) {
  float s = 0.07;
  float t0 = -0.08 + j * 0.10;
  float t1 = 0.26 + j * 0.12;
  float t2 = 0.62 + j * 0.10;
  return 0.1 + 0.27 * smoothstep(t0 - s, t0 + s, ndl) + 0.33 * smoothstep(t1 - s, t1 + s, ndl) + 0.3 * smoothstep(t2 - s, t2 + s, ndl);
}
// a hand-painted four-colour gradient with uneven, noisy breaks
vec3 ramp4(float t, float j, vec3 c0, vec3 c1, vec3 c2, vec3 c3) {
  vec3 c = mix(c0, c1, smoothstep(0.18 + j * 0.1, 0.28 + j * 0.1, t));
  c = mix(c, c2, smoothstep(0.46 + j * 0.08, 0.55 + j * 0.08, t));
  return mix(c, c3, smoothstep(0.74 - j * 0.1, 0.82, t));
}
float rimBand(vec3 N, vec3 V, float w) { float f = 1.0 - max(dot(N, V), 0.0); return smoothstep(1.0 - w, 1.0 - w * 0.35, f); }
float hatch(vec2 p, float d) { return smoothstep(0.55, 0.65, sin((p.x + p.y) * d) * 0.5 + 0.5); }
`

// ---------- shared sphere vertex ----------
export const sphereVert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec2 vUv;
void main() {
  vO = normalize(position);
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

// ---------- procedural planet ----------
export const planetFrag = /* glsl */ `
uniform vec3 uLight;
uniform float uTime;
uniform float uSeed;
uniform float uFreq;
uniform float uKind; // 0 rocky, 1 gas, 2 ice
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uAtmo;
uniform vec3 uRim;
uniform float uRimW;
uniform float uHatch;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec2 vUv;
${noise}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 L = normalize(uLight);
  vec3 q = vO * uFreq + uSeed;
  float brush = strokes(vO, L, 3.0, uSeed);
  float jit = fbm3(q * 1.7) * 0.5;
  vec3 col;
  float sea = 0.0;
  if (uKind < 0.5) {
    float n = fbm(q);
    float n2 = fbm(q * 2.7 + 3.1);
    float h = n * 0.65 + n2 * 0.35;
    sea = 1.0 - smoothstep(-0.2, -0.12, h);
    float t = smoothstep(-0.35, 0.55, h);
    col = ramp4(t, jit, uC0, uC1, uC2, uC3);
    float caps = smoothstep(0.76, 0.82, abs(vO.y) + n2 * 0.12);
    col = mix(col, uC3, caps);
  } else if (uKind < 1.5) {
    float warp = fbm(q * 0.9 + uTime * 0.015) * 0.7;
    float lat = vO.y * uFreq * 2.2 + warp * 1.6;
    float band = sin(lat * 3.14159) * 0.5 + 0.5;
    float band2 = sin(lat * 7.3 + 1.3) * 0.5 + 0.5;
    float t = floor((band * 0.7 + band2 * 0.3) * 5.0 + jit) / 5.0;
    col = ramp4(t, jit * 0.5, uC0, uC1, uC2, uC3);
    float storm = smoothstep(0.58, 0.64, fbm(vO * 2.0 + uSeed + 4.0));
    col = mix(col, uC3, storm * 0.7);
  } else {
    float n = fbm(q);
    float n2 = fbm(q * 4.0 + 1.7);
    float cracks = smoothstep(0.36, 0.42, abs(n2));
    col = ramp4(smoothstep(-0.4, 0.5, n), jit, uC0, uC1, uC2, uC3);
    col = mix(col, uC0 * 0.8, cracks * 0.6);
  }
  col *= 0.86 + 0.28 * (brush * 0.5 + 0.5);
  float ndl = dot(N, L);
  float lightBand = ramp(ndl, brush * 0.5);
  vec3 H = normalize(L + V);
  float glint = step(0.986, dot(N, H)) * (0.15 + sea * 0.6) * step(0.0, ndl);
  float lit = smoothstep(-0.2, 0.3, ndl);
  vec3 outc = col * lightBand + glint;
  // dark side picks up a cool atmospheric bounce, lit edge picks up the city's rim light
  outc += uAtmo * rimBand(N, V, 0.28) * (0.12 + 0.35 * lit);
  outc += uRim * rimBand(N, V, uRimW) * (0.25 + 0.75 * (1.0 - lit)) * 0.9;
  outc *= 1.0 - uHatch * 0.28 * hatch(vUv * vec2(260.0, 130.0), 1.0) * (1.0 - lit);
  gl_FragColor = vec4(outc, 1.0);
}
`

// ---------- earth with real maps ----------
export const earthFrag = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uLights;
uniform sampler2D uSpec;
uniform vec3 uLight;
uniform vec3 uRim;
uniform vec3 uNight;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec2 vUv;
${noise}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 L = normalize(uLight);
  vec3 day = texture2D(uMap, vUv).rgb;
  float brush = strokes(vO, L, 6.0, 1.0);
  // posterise the map halfway so continents read as painted shapes
  vec3 post = floor(day * 6.0 + 0.5 + brush * 0.25) / 6.0;
  day = mix(day, post, 0.6) * (0.9 + 0.2 * (brush * 0.5 + 0.5));
  vec3 night = texture2D(uLights, vUv).rgb;
  float sp = texture2D(uSpec, vUv).r;
  float ndl = dot(N, L);
  float lightBand = ramp(ndl, brush * 0.4);
  float dark = 1.0 - smoothstep(-0.25, 0.05, ndl);
  vec3 col = day * lightBand * 1.1;
  col += smoothstep(0.18, 0.45, dot(night, vec3(0.333))) * uNight * dark * 2.2;
  vec3 H = normalize(L + V);
  col += sp * step(0.99, dot(N, H)) * 0.4 * step(0.0, ndl);
  float lit = smoothstep(-0.2, 0.3, ndl);
  col += uRim * rimBand(N, V, 0.2) * (0.3 + 0.7 * (1.0 - lit));
  gl_FragColor = vec4(col, 1.0);
}
`

// ---------- cloud layer (procedural or textured) ----------
export const cloudsFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uUseMap;
uniform vec3 uLight;
uniform float uTime;
uniform float uSeed;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec2 vUv;
${noise}
void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLight);
  vec3 V = normalize(cameraPosition - vP);
  float a;
  if (uUseMap > 0.5) {
    a = smoothstep(0.35, 0.55, texture2D(uMap, vUv).r);
  } else {
    float n = fbm(vO * 3.0 + uSeed + vec3(uTime * 0.01, 0.0, 0.0));
    a = smoothstep(0.26, 0.34, n);
  }
  float lightBand = ramp(dot(N, L), 0.0);
  float edge = 1.0 - pow(1.0 - max(dot(N, V), 0.0), 2.0);
  vec3 col = vec3(0.96, 0.98, 1.0) * lightBand;
  gl_FragColor = vec4(col, a * 0.7 * edge);
}
`

// ---------- atmosphere halo (BackSide shell) ----------
export const haloFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uStrength;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 L = normalize(uLight);
  float d = dot(N, V); // negative on the back faces we see
  float t = clamp(-d * 1.55, 0.0, 1.0);
  float glow = pow(t, 2.4);
  float lit = 0.25 + 0.75 * smoothstep(-0.6, 0.5, dot(N, L));
  gl_FragColor = vec4(uColor * glow * lit * uStrength, glow * lit * uStrength);
}
`

// ---------- planetary ring ----------
export const ringVert = /* glsl */ `
varying vec3 vLocal;
varying vec3 vP;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
export const ringFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;
uniform vec3 uLight;
uniform vec3 uPlanet;
uniform float uPlanetR;
varying vec3 vLocal;
varying vec3 vP;
${noise}
void main() {
  float r = length(vLocal.xy);
  float t = (r - uInner) / (uOuter - uInner);
  float bands = fbm3(vec3(t * 14.0 + uSeed, uSeed, 0.0)) * 0.5 + 0.5;
  float fine = snoise(vec3(t * 90.0, uSeed, 1.0)) * 0.5 + 0.5;
  float a = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.85, 1.0, t));
  a *= 0.35 + bands * 0.55 + fine * 0.15;
  float gap = smoothstep(0.02, 0.0, abs(t - 0.62)) * 0.8;
  a *= 1.0 - gap;
  // crude planet shadow: points on the far side from the light, close to the planet axis
  vec3 L = normalize(uLight);
  vec3 rel = vP - uPlanet;
  float along = dot(rel, -L);
  float side = length(rel + L * along);
  float shadow = (along > 0.0) ? 1.0 - smoothstep(uPlanetR * 0.9, uPlanetR * 1.15, side) : 0.0;
  vec3 col = uColor * (0.25 + 0.75 * (1.0 - shadow)) * (0.7 + bands * 0.5);
  gl_FragColor = vec4(col, a * 0.85);
}
`

// ---------- star (twin suns) ----------
export const sunFrag = /* glsl */ `
uniform float uTime;
uniform float uStep;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
${noise}
void main() {
  float tt = stepT(uTime, uStep);
  vec3 q = vO * 2.4;
  float n = fbm(q + vec3(0.0, tt * 0.12, 0.0));
  float n2 = fbm(q * 3.5 - vec3(tt * 0.2, 0.0, 0.0));
  float t = n * 0.6 + n2 * 0.4;
  float bands = floor(smoothstep(-0.25, 0.5, t) * 3.0 + 0.5) / 3.0;
  vec3 col = mix(uColor, uHot, bands) * 1.8;
  vec3 V = normalize(cameraPosition - vP);
  vec3 N = normalize(vN);
  col = mix(col, uColor * 0.7, rimBand(N, V, 0.22));
  col += uColor * rimBand(N, V, 0.08) * 1.2;
  gl_FragColor = vec4(col, 1.0);
}
`

// ---------- flat billboard vertex ----------
export const flatVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const coronaFrag = /* glsl */ `
uniform float uTime;
uniform float uStep;
uniform vec3 uColor;
uniform float uSeed;
varying vec2 vUv;
${noise}
void main() {
  float tt = stepT(uTime, uStep);
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float n = fbm3(vec3(cos(a), sin(a), uSeed + tt * 0.25) * 2.2 + r * 2.5) * 0.5 + 0.5;
  float glow = pow(smoothstep(1.0, 0.0, r), 2.4);
  float rays = step(0.6, n) * smoothstep(1.0, 0.3, r) * 0.5;
  float v = glow * 1.1 + rays;
  // flat bands, like a glow painted as a cel
  v = floor(v * 5.0 + 0.35) / 5.0;
  gl_FragColor = vec4(uColor * v, v);
}
`

// ---------- quasar accretion disk ----------
export const diskFrag = /* glsl */ `
uniform float uTime;
uniform float uStep;
uniform vec3 uHot;
uniform vec3 uWarm;
uniform float uInner;
uniform float uOuter;
varying vec3 vLocal;
${noise}
void main() {
  float tt = stepT(uTime, uStep);
  vec2 p = vLocal.xy;
  float r = length(p);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float a = atan(p.y, p.x);
  float rot = tt * (2.2 / (0.25 + t * t * 3.5));
  float n = fbm3(vec3(cos(a + rot) * 3.0, sin(a + rot) * 3.0, t * 7.0)) * 0.5 + 0.5;
  float streaks = step(0.52, n) * 0.7 + step(0.66, n) * 0.6;
  float fade = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.55, 0.62, t + n * 0.15));
  float heat = 1.0 + 2.6 * step(t, 0.18);
  vec3 col = mix(uHot, uWarm, step(0.3, t + n * 0.1)) * (0.45 + streaks) * heat;
  float alpha = fade * (0.25 + streaks * 0.6);
  gl_FragColor = vec4(col * alpha, alpha);
}
`

export const jetVert = /* glsl */ `
varying vec2 vUv;
varying float vY;
void main() {
  vUv = uv;
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
export const jetFrag = /* glsl */ `
uniform float uTime;
uniform float uStep;
uniform vec3 uColor;
uniform float uLen;
varying vec2 vUv;
varying float vY;
${noise}
void main() {
  float tt = stepT(uTime, uStep);
  float along = clamp(vY / uLen, 0.0, 1.0);
  float n = fbm3(vec3(vUv.x * 6.0, along * 8.0 - tt * 1.5, 0.0)) * 0.5 + 0.5;
  float core = pow(1.0 - along, 1.6);
  float a = floor((core * (0.3 + n * 0.7)) * 4.0 + 0.4) / 4.0 * 0.6;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), step(0.6, core) * 0.5) * a, a);
}
`

// ---------- nebula cloud sheet ----------
export const nebulaFrag = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uA;
uniform vec3 uB;
uniform float uDensity;
uniform float uCore; // 1 = thin additive glow sheet
varying vec2 vUv;
${noise}
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  vec3 q = vec3(p * 2.6, uSeed + uTime * 0.02);
  float w = fbm3(q * 1.3);
  float n = fbm(q * 2.0 + w * 1.3 + vec3(uTime * 0.012, 0.0, 0.0)) * 0.5 + 0.5;
  float mask = smoothstep(1.0, 0.35, r);
  n *= mask;
  float inner = strokes(vec3(p, uSeed), vec3(0.7, 0.3, 0.0), 9.0, uSeed) * 0.5 + 0.5;
  if (uCore > 0.5) {
    float d = pow(n, 2.6) * uDensity;
    gl_FragColor = vec4(uB * d * 1.6, d);
    return;
  }
  // painted masses: a hard-ish silhouette, then two flat value steps inside it with strokes through them
  float body = smoothstep(0.4, 0.46, n);
  float mid = smoothstep(0.52, 0.56, n + inner * 0.05);
  float top = smoothstep(0.63, 0.66, n + inner * 0.06);
  vec3 col = mix(uA * 0.55, uA, mid);
  col = mix(col, uB, top);
  col *= 0.85 + 0.3 * inner;
  float alpha = body * uDensity;
  gl_FragColor = vec4(col, alpha);
}
`

// ---------- wormhole gate ----------
export const gateFrag = /* glsl */ `
uniform float uTime;
uniform float uStep;
uniform float uMode; // 0 hextech gem (to topside), 1 chem vent (to the undercity)
uniform vec3 uColor;
uniform vec3 uColor2;
varying vec2 vUv;
${noise}
void main() {
  float tt = stepT(uTime, uStep);
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float ring = smoothstep(1.0, 0.92, r) * smoothstep(0.1, 0.18, r);
  vec3 col;
  float alpha;
  if (uMode < 0.5) {
    // gem: eight facets, each its own flat value, crisp veins of light swirling through
    float facet = floor((a / 6.2831 + 0.5) * 8.0 + tt * 0.25);
    float shade = 0.45 + 0.55 * fract(sin(facet * 12.9898) * 43758.5453);
    float swirl = a + 4.0 * log(r + 0.06) - tt * 1.1;
    float n = fbm3(vec3(cos(swirl), sin(swirl), r * 3.0) * 1.6) * 0.5 + 0.5;
    float veins = step(0.68, n);
    float rim = smoothstep(0.84, 0.9, r) * (1.0 - smoothstep(0.96, 1.0, r));
    col = uColor * (0.35 + shade * 0.9) + vec3(1.0) * veins * 0.9 + uColor2 * rim * 1.6;
    float core = smoothstep(0.32, 0.12, r);
    col = mix(col, vec3(1.4, 1.6, 1.7), core);
    alpha = ring + core;
  } else {
    // vent: thick smog rings breathing outward, bubbles, a pink flicker
    float rings = fract(r * 3.0 - tt * 0.35);
    float band = step(0.5, rings);
    float n = fbm3(vec3(p * 4.0, tt * 0.3)) * 0.5 + 0.5;
    float bubbles = step(0.72, snoise(vec3(p * 18.0, tt * 0.8)));
    col = mix(uColor * 0.35, uColor, band * step(0.4, n)) + uColor2 * bubbles * 0.9;
    float hole = smoothstep(0.34, 0.08, r);
    col = mix(col, vec3(0.02, 0.05, 0.04), hole);
    alpha = ring * (0.6 + 0.4 * n) + hole * 0.97;
  }
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`

// ---------- points: background stars, wrapped around the camera ----------
export const starsVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform vec2 uCam;
uniform vec2 uPeriod;
uniform float uPixelRatio;
uniform float uTwinkle;
varying vec3 vC;
varying float vS;
varying float vPh;
void main() {
  vPh = aPhase;
  vec3 p = position;
  p.xy = mod(p.xy - uCam + uPeriod * 0.5, uPeriod) - uPeriod * 0.5 + uCam;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.7 + aPhase * 2.3) + aPhase * 31.0)) * 0.45;
  gl_PointSize = aSize * tw * uPixelRatio * (520.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
  vC = aColor * tw;
  vS = aSize;
}
`
export const starsFrag = /* glsl */ `
varying vec3 vC;
varying float vS;
varying float vPh;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  // a dab rather than a dot: turned, squashed, a little uneven
  float ang = vPh * 6.2831;
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  vec2 d = p * vec2(1.35, 1.0);
  float r = length(d) * 2.0 * (1.0 + 0.25 * fract(vPh * 7.0));
  float core = smoothstep(0.95, 0.55, r);
  float flare = 0.0;
  if (vS > 3.2) {
    vec2 q = gl_PointCoord - 0.5;
    flare = max(pow(max(1.0 - abs(q.x) * 2.0, 0.0), 12.0), pow(max(1.0 - abs(q.y) * 2.0, 0.0), 12.0)) * smoothstep(1.0, 0.1, length(q) * 2.0) * 0.6;
  }
  float a = core + flare;
  gl_FragColor = vec4(vC * a, a);
}
`

// ---------- points: comet tail ----------
export const cometVert = /* glsl */ `
attribute vec3 aRand;
uniform float uTime;
uniform float uLen;
uniform vec2 uDir;
uniform float uPixelRatio;
varying float vLife;
varying float vKind;
void main() {
  float life = fract(uTime * 0.28 * (0.6 + aRand.x * 0.8) + aRand.y);
  life = floor(life * 7.0) / 7.0 + aRand.y * 0.04; // stop motion
  vLife = life;
  vKind = step(0.5, aRand.z);
  vec2 perp = vec2(-uDir.y, uDir.x);
  float spread = (fract(aRand.z * 7.13) - 0.5) * 2.0;
  float curve = mix(0.06, 0.32, vKind);
  vec2 off = uDir * life * uLen + perp * spread * life * uLen * curve + perp * (aRand.x - 0.5) * 0.7;
  vec3 pos = position + vec3(off, (aRand.y - 0.5) * 0.6);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.4 + 5.0 * life * (0.5 + aRand.x)) * uPixelRatio * (220.0 / -mv.z);
}
`
export const cometFrag = /* glsl */ `
uniform vec3 uIon;
uniform vec3 uDust;
varying float vLife;
varying float vKind;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p * vec2(1.0, 2.2)) * 2.0;
  float d = smoothstep(1.0, 0.6, r);
  vec3 col = mix(uIon, uDust, vKind);
  float a = d * pow(1.0 - vLife, 1.4) * 0.6;
  gl_FragColor = vec4(col * a, a);
}
`

// ---------- launch-scene galaxy points (pixel-space ortho) ----------
// Unit-disc points, spun, flattened to an inclined disc and tilted. uBirth (0..1) unwinds the galaxy
// outward from its centre during the cold open; uScale swells it when you commit.
export const galaxyVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
attribute float aR;
uniform float uSpin;
uniform float uSpinDir;
uniform float uTime;
uniform float uGlow;
uniform float uScale;
uniform float uBirth;
uniform float uPixelRatio;
varying vec3 vC;
void main() {
  float k = clamp((uBirth - aR * 0.55) / 0.45, 0.0, 1.0);
  k = 1.0 - pow(1.0 - k, 3.0);
  float ang = uSpin + (1.0 - k) * 5.0 * uSpinDir;
  float c = cos(ang), s = sin(ang);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * k;
  p.y *= 0.58;
  float c2 = cos(-0.5), s2 = sin(-0.5);
  p = vec2(p.x * c2 - p.y * s2, p.x * s2 + p.y * c2) * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  float tw = 0.85 + 0.15 * sin(uTime * 1.3 + aPhase * 20.0);
  gl_PointSize = aSize * uPixelRatio * (1.0 + uGlow * 0.3) * sqrt(uScale) * tw;
  vC = aColor * (0.6 + uGlow * 0.55) * tw * k;
}
`
// a crisp dot with a hot core
export const galaxyFrag = /* glsl */ `
varying vec3 vC;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.6, r) * 0.7 + smoothstep(0.5, 0.0, r) * 0.6;
  gl_FragColor = vec4(vC * a, a);
}
`
// The light under a launch galaxy: a smooth core and disc glow in the same tilt as the points. No bands.
export const galaxyHaloFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
uniform float uBirth;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float c = cos(0.5), s = sin(0.5);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  p.y /= 0.58;
  float r2 = dot(p, p);
  float v = (exp(-r2 * 90.0) * 0.45 + exp(-r2 * 3.5) * (0.1 + uGlow * 0.18)) * uBirth;
  gl_FragColor = vec4(uColor * v, v);
}
`

// ---------- launch-scene streaking stars ----------
export const launchStarVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uPixelRatio;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio;
  vA = aAlpha;
}
`
export const launchStarFrag = /* glsl */ `
varying float vA;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float a = pow(smoothstep(1.0, 0.0, r), 2.0) * vA;
  gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * a, a);
}
`
export const launchLineVert = /* glsl */ `
attribute float aAlpha;
varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vA = aAlpha;
}
`
export const launchLineFrag = /* glsl */ `
uniform float uPull;
varying float vA;
void main() {
  float a = vA * uPull;
  gl_FragColor = vec4(vec3(0.91, 0.94, 1.0) * a, a);
}
`

// ---------- milky way backdrop ----------
export const backdropFrag = /* glsl */ `
uniform float uTime;
uniform vec2 uOffset;
uniform vec3 uSky0;
uniform vec3 uSky1;
uniform vec3 uSmog;
uniform float uMode; // 0 undercity smog, 1 topside haze
varying vec2 vUv;
${noise}
void main() {
  vec2 p = vUv - 0.5 + uOffset;
  vec3 q = vec3(p * 5.0, 1.7);
  float w = fbm3(q * 1.4);
  float n = fbm(q * 2.6 + w * 1.1) * 0.5 + 0.5;
  // base: a dark painted gradient, never flat black
  vec3 col = mix(uSky0, uSky1, smoothstep(-0.5, 0.6, p.y + w * 0.15)) * 0.22;
  if (uMode < 0.5) {
    // undercity: low horizontal bands of smog, each a flat value with a ragged top edge
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y = -0.28 + fi * 0.22;
      float edge = fbm3(vec3(p.x * 3.0 + fi * 3.1 + uTime * 0.004, fi, 2.0)) * 0.06;
      float band = smoothstep(y + 0.05 + edge, y + edge, p.y) * smoothstep(y - 0.22, y - 0.08, p.y);
      col = mix(col, uSmog * (0.16 + fi * 0.05), band * 0.55);
    }
  } else {
    // topside: a cool diagonal haze band
    float band = exp(-pow((p.y + p.x * 0.3) * 4.0, 2.0));
    float haze = smoothstep(0.42, 0.5, n) * band;
    col = mix(col, uSmog * 0.22, haze * 0.7);
  }
  float dark = smoothstep(0.55, 0.62, fbm3(q * 3.4 + 9.0) * 0.5 + 0.5);
  col *= 1.0 - dark * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`

// ---------- launch card sky: undercity smog on one side, topside haze on the other ----------
// The seam is a clean line of hextech light that leans toward whichever side the pointer is on
// (uSeam 0..1 across the screen). Cold open: a spark (uSpark), the seam tearing open from one end
// (uTear), then both cities flooding outward from it (uFlood). All three sit at 1 afterwards.
export const launchSkyFrag = /* glsl */ `
uniform float uTime;
uniform float uSeam;
uniform float uVertical; // 1 on phones: topside above, undercity below
uniform vec2 uAspect;
uniform vec3 uUnder0;
uniform vec3 uUnder1;
uniform vec3 uUnderSmog;
uniform vec3 uTop0;
uniform vec3 uTop1;
uniform vec3 uTopSmog;
uniform vec3 uUnderAcc;
uniform vec3 uUnderAcc2;
uniform vec3 uTopAcc;
uniform vec3 uTopAcc2;
uniform vec3 uCore;
uniform vec3 uInk;
uniform float uTear;
uniform float uFlood;
uniform float uSpark;
uniform float uGlowUnder; // how far the pointer leans into each city, 0..1
uniform float uGlowTop;
uniform float uPulse;
varying vec2 vUv;
${noise}
// One city's nebula bank against the seam. into = distance into that city in screen heights (negative is
// across the seam). As reveal rises the bank thickens and reaches further back, and the clouds further out
// need more of it to show, so a bank unfurls outward instead of fading all at once.
float bank(float n, float into, float reveal) {
  float reach = mix(0.08, 0.4, reveal);
  float zone = smoothstep(-0.24, 0.06, into) * exp(-max(into, 0.0) / reach);
  float thresh = mix(0.7, 0.42, reveal) + max(into, 0.0) * 0.45;
  return smoothstep(thresh, thresh + 0.24, n) * zone;
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  float w = fbm3(vec3(p * 2.2, 3.0));
  float across = mix(vUv.x, vUv.y, uVertical);
  float along = mix(vUv.y, vUv.x, uVertical);
  float tc = uTime * 0.018;

  // one slow, domain-warped cloud field shapes both the seam and the nebulae piled against it
  vec3 wp = vec3(p * 1.4, tc);
  vec2 warp = vec2(fbm3(wp), fbm3(wp + vec3(5.2, 1.3, 2.7)));
  float cloud = fbm(vec3(p * 2.3 + warp * 1.1, tc * 1.4 + 4.0)) * 0.5 + 0.5;
  float detail = fbm3(vec3(p * 7.0 + warp * 2.0, tc * 2.0 + 9.0));

  // no line: the cities meet along a ragged cloud front. sd is signed distance from it in screen heights
  // (negative = undercity), so it weighs the same in both layouts
  float seam = uSeam + (along - 0.5) * 0.06;
  float sd0 = (across - seam) * mix(uAspect.x, 1.0, uVertical);
  float sd = sd0 + (cloud - 0.5) * 0.18;
  float ad = abs(sd);
  float side = smoothstep(-0.05, 0.05, sd);

  // undercity: dark teal gradient, three flat bands of smog rising from the bottom
  vec3 under = mix(uUnder0, uUnder1, smoothstep(0.9, 0.0, vUv.y + w * 0.1)) * 0.5;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.12 + fi * 0.16;
    float edge = fbm3(vec3(vUv.x * 4.0 + fi * 2.3 + uTime * 0.006, fi, 1.0)) * 0.05;
    float band = smoothstep(y + 0.03 + edge, y + edge, vUv.y);
    under = mix(under, uUnderSmog * (0.32 - fi * 0.07), band * 0.6);
  }

  // topside: warm sky lightening toward the horizon line, and a haze band
  vec3 top = mix(uTop0, uTop1, smoothstep(1.0, 0.25, vUv.y + w * 0.08)) * 0.55;
  float haze = smoothstep(0.42, 0.5, fbm(vec3(p * 3.0, 7.0)) * 0.5 + 0.5) * exp(-pow((vUv.y - 0.38) * 4.0, 2.0));
  top = mix(top, uTopSmog * 0.5, haze * 0.6);

  vec3 col = mix(under, top, side);
  vec3 acc = mix(uUnderAcc, uTopAcc, side);

  // cold open: the cities flood out from the seam behind a soft, cloudy wavefront
  float reach = uFlood * 1.6;
  float front = ad + (cloud - 0.5) * 0.2;
  float flood = 1.0 - smoothstep(reach - 0.14, reach, front);
  col = mix(uInk, col, flood);
  float rim = exp(-pow((front - reach) * 12.0, 2.0)) * step(0.001, uFlood) * (1.0 - uFlood);
  col += acc * rim * cloud * 0.6;

  // the nebulae unfurl down the seam from one end: top → bottom, or left → right on phones
  float from = mix(1.0 - along, along, uVertical);
  float torn = 1.0 - smoothstep(uTear - 0.18, uTear, from);

  // each city's bank sits on its own side and they interlock: undercity clouds where the field is thick,
  // topside clouds where it's thin. Lean into one and it rolls in while the other thins out
  float lift = uPulse * 0.35 + (1.0 - uFlood) * 0.3;
  float revU = clamp(mix(0.5, 1.0, uGlowUnder) * (1.0 - uGlowTop) + lift, 0.0, 1.0);
  float revT = clamp(mix(0.5, 1.0, uGlowTop) * (1.0 - uGlowUnder) + lift, 0.0, 1.0);
  // the banks are placed from the smooth seam, so their clouds spill over the ragged edge rather than stop at it
  float dU = bank(cloud + detail * 0.16, -sd0, revU) * torn;
  float dT = bank(1.0 - cloud + detail * 0.16, sd0, revT) * torn;
  float hue = snoise(vec3(p * 1.2 + warp * 0.7, tc + 2.0)) * 0.5 + 0.5;
  vec3 tintU = mix(uUnderAcc, uUnderAcc2, smoothstep(0.58, 0.85, hue));
  vec3 tintT = mix(uTopAcc, uTopAcc2, smoothstep(0.58, 0.85, hue));
  // soft body, a hotter core where the cloud is densest
  col += tintU * (dU * 0.5 + dU * dU * 0.5) * (0.2 + 0.8 * revU) * 0.36;
  col += tintT * (dT * 0.5 + dT * dT * 0.5) * (0.2 + 0.8 * revT) * 0.42;
  col += uCore * (pow(dU, 3.0) * revU + pow(dT, 3.0) * revT) * 0.16;
  // the leading edge of the tear billows brighter as it goes
  float head = exp(-pow((from - uTear) * 9.0, 2.0)) * exp(-ad * 22.0) * step(0.001, uTear) * step(uTear, 1.0);
  col += acc * head * smoothstep(0.35, 0.75, cloud) * 0.9;

  // the spark: a hot point and a thin streak through it
  vec2 c = (vUv - 0.5) * uAspect;
  col += uCore * (exp(-length(c) * 40.0) * 2.4 + exp(-abs(c.y) * 400.0) * exp(-abs(c.x) * 5.0) * 0.9) * uSpark;
  gl_FragColor = vec4(col, 1.0);
}
`
