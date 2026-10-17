import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

// What the camera adds: colour fringing toward the frame edge (clean in the middle) and film grain
// that changes twelve times a second, like grain on twos. Grain freezes under reduced motion.
const frag = /* glsl */ `
uniform float uCA;
uniform float uGrain;
uniform float uTime;
float ln_hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 d = uv - 0.5;
  float amt = uCA * smoothstep(0.25, 0.75, length(d) * 1.35);
  float r = texture2D(inputBuffer, uv - d * amt).r;
  float b = texture2D(inputBuffer, uv + d * amt).b;
  vec3 c = vec3(r, inputColor.g, b);
  float t = floor(uTime * 12.0);
  float g = ln_hash(uv * resolution + vec2(t * 17.0, t * 31.0)) - 0.5;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c += g * uGrain * (1.0 - lum * 0.6);
  outputColor = vec4(c, inputColor.a);
}
`

export class LensEffect extends Effect {
  constructor({ ca = 0.006, grain = 0.05 } = {}) {
    super('LensEffect', frag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uCA', new Uniform(ca)],
        ['uGrain', new Uniform(grain)],
        ['uTime', new Uniform(0)],
      ]),
    })
    this.frozen = false
  }

  update(renderer, inputBuffer, deltaTime) {
    if (!this.frozen) this.uniforms.get('uTime').value += deltaTime
  }
}
