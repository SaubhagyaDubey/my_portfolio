import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

// What the camera adds: colour fringing toward the frame edge, clean in the middle. No grain.
const frag = /* glsl */ `
uniform float uCA;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 d = uv - 0.5;
  float amt = uCA * smoothstep(0.25, 0.75, length(d) * 1.35);
  float r = texture2D(inputBuffer, uv - d * amt).r;
  float b = texture2D(inputBuffer, uv + d * amt).b;
  outputColor = vec4(r, inputColor.g, b, inputColor.a);
}
`

export class LensEffect extends Effect {
  constructor({ ca = 0.006 } = {}) {
    super('LensEffect', frag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([['uCA', new Uniform(ca)]]),
    })
  }
}
