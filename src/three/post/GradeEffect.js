import { Effect } from 'postprocessing'
import { Color, Uniform } from 'three'
import { valueNoise } from './glsl.js'

// The last word on colour. The composer turns renderer tone mapping off, so this owns the curve:
// ACES first, then a three-way split tone per city, a soft S-curve, a little saturation, and the vignette.
// No paper, grain or halftone: the frame stays clean, the painting lives in the materials.
// Two cities are loaded at once: A = undercity, B = topside. uMix picks between them; on the launch
// card uSplit > 0 blends them across the screen around uSeam instead.
const frag = /* glsl */ `
uniform vec3 uShadowA; uniform vec3 uMidA; uniform vec3 uHighA;
uniform vec3 uShadowB; uniform vec3 uMidB; uniform vec3 uHighB;
uniform float uMix;
uniform float uSplit;
uniform float uSeam;
uniform float uVertical;
uniform float uTone;
uniform float uVignette;
${valueNoise('gr')}
vec3 gr_aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float m = uMix;
  if (uSplit > 0.0) {
    float across = mix(uv.x, uv.y, uVertical);
    float along = mix(uv.y, uv.x, uVertical);
    float seam = uSeam + (gr_noise(vec2(along * 3.0, 1.7)) - 0.5) * 0.05 + (along - 0.5) * 0.06;
    m = smoothstep(seam - uSplit, seam + uSplit, across);
  }
  vec3 sh = mix(uShadowA, uShadowB, m);
  vec3 md = mix(uMidA, uMidB, m);
  vec3 hi = mix(uHighA, uHighB, m);

  vec3 c = gr_aces(inputColor.rgb * 1.08);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float ws = 1.0 - smoothstep(0.0, 0.42, l);
  float wh = smoothstep(0.55, 1.0, l);
  float wm = max(0.0, 1.0 - ws - wh);
  c += (ws * sh + wm * md * 0.6 + wh * hi * 0.7) * uTone;
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l2), c, 1.1);

  vec2 d = uv - 0.5;
  float vig = smoothstep(0.85, 0.22, length(d * vec2(1.0, 0.85)) * 1.25);
  c *= mix(1.0 - uVignette, 1.0, vig);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor({ a, b, mix = 0, tone = 0.22, vignette = 0.6 } = {}) {
    super('GradeEffect', frag, {
      uniforms: new Map([
        ['uShadowA', new Uniform(new Color(a.shadow))],
        ['uMidA', new Uniform(new Color(a.mid))],
        ['uHighA', new Uniform(new Color(a.high))],
        ['uShadowB', new Uniform(new Color(b.shadow))],
        ['uMidB', new Uniform(new Color(b.mid))],
        ['uHighB', new Uniform(new Color(b.high))],
        ['uMix', new Uniform(mix)],
        ['uSplit', new Uniform(0)],
        ['uSeam', new Uniform(0.5)],
        ['uVertical', new Uniform(0)],
        ['uTone', new Uniform(tone)],
        ['uVignette', new Uniform(vignette)],
      ]),
    })
  }
}
