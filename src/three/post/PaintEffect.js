import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector2 } from 'three'
import { valueNoise } from './glsl.js'

// Generalised Kuwahara: four overlapping quadrants, each weighted by how flat it is, so flat areas
// collapse into strokes and edges stay put. Sample offsets turn with a slow noise field, which drags
// the strokes in varied directions like a bristle brush. The field is offset by the camera (uCam)
// so strokes stick to the world instead of swimming over it.
const frag = (radius) => /* glsl */ `
#define PR ${radius}
uniform float uStrength;
uniform float uStep;
uniform float uFlow;
uniform vec2 uCam;
${valueNoise('pt')}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;
  float a = pt_noise(px * uFlow + uCam) * 6.2831;
  float ca = cos(a);
  float sa = sin(a);
  mat2 rot = mat2(ca, -sa, sa, ca);
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = -PR; j <= PR; j++) {
    for (int i = -PR; i <= PR; i++) {
      vec2 o = rot * vec2(float(i), float(j) * 0.7) * uStep * texelSize;
      vec3 c = texture2D(inputBuffer, uv + o).rgb;
      c = c / (1.0 + c); // compress HDR so suns don't dominate the variance
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
      if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
      if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
    }
  }
  float n = float((PR + 1) * (PR + 1));
  const vec3 W = vec3(0.299, 0.587, 0.114);
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  float v0 = dot(abs(s0 / n - m0 * m0), W);
  float v1 = dot(abs(s1 / n - m1 * m1), W);
  float v2 = dot(abs(s2 / n - m2 * m2), W);
  float v3 = dot(abs(s3 / n - m3 * m3), W);
  float w0 = 1.0 / (1.0 + pow(v0 * 260.0, 2.0));
  float w1 = 1.0 / (1.0 + pow(v1 * 260.0, 2.0));
  float w2 = 1.0 / (1.0 + pow(v2 * 260.0, 2.0));
  float w3 = 1.0 / (1.0 + pow(v3 * 260.0, 2.0));
  vec3 res = (m0 * w0 + m1 * w1 + m2 * w2 + m3 * w3) / (w0 + w1 + w2 + w3);
  res = res / max(vec3(1e-4), 1.0 - res); // expand back to HDR
  outputColor = vec4(mix(inputColor.rgb, res, uStrength), inputColor.a);
}
`

export class PaintEffect extends Effect {
  constructor({ radius = 2, strength = 1, step = 1.6, flow = 0.013 } = {}) {
    super('PaintEffect', frag(radius), {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uStrength', new Uniform(strength)],
        ['uStep', new Uniform(step)],
        ['uFlow', new Uniform(flow)],
        ['uCam', new Uniform(new Vector2())],
      ]),
    })
  }
}
