// Small hash / value-noise helpers for post effects. Each effect gets its own prefix so merged
// effect passes never see two functions with the same name.
export const valueNoise = (p) => /* glsl */ `
float ${p}_hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float ${p}_noise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(${p}_hash(i), ${p}_hash(i + vec2(1.0, 0.0)), f.x), mix(${p}_hash(i + vec2(0.0, 1.0)), ${p}_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`
