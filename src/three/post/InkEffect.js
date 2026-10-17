import { Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform, Vector2 } from 'three'
import { valueNoise } from './glsl.js'

// Brushed ink lines. Sobel on depth catches silhouettes of solid things (planets, ship, station);
// Sobel on luminance catches painted shapes. Luminance lines only land on the darker side of an
// edge, so stars and hot cores never get swallowed. The threshold wanders with noise and the line
// breaks up in places, so it reads as a dry brush rather than a toon outline. Never pure black.
const frag = /* glsl */ `
uniform vec3 uInk;
uniform float uDepthW;
uniform float uLumaW;
uniform float uAmount;
uniform float uWidth;
uniform vec2 uCam;
${valueNoise('ik')}
float ik_l(vec2 uv) { vec3 c = texture2D(inputBuffer, uv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); return l / (1.0 + l); }
float ik_z(vec2 uv) { return -getViewZ(readDepth(uv)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 px = uv * resolution + uCam / 0.013;
  float wob = 0.75 + 0.5 * ik_noise(px * 0.035);
  vec2 t = texelSize * uWidth * wob;
  float tl = ik_l(uv + vec2(-t.x, t.y)), tc = ik_l(uv + vec2(0.0, t.y)), tr = ik_l(uv + t);
  float ml = ik_l(uv - vec2(t.x, 0.0)), mc = ik_l(uv), mr = ik_l(uv + vec2(t.x, 0.0));
  float bl = ik_l(uv - t), bc = ik_l(uv - vec2(0.0, t.y)), br = ik_l(uv + vec2(t.x, -t.y));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  float avg = (tl + tc + tr + ml + mr + bl + bc + br) * 0.125;
  float lumaEdge = length(vec2(gx, gy)) * step(mc, avg + 0.01);

  float depthEdge = 0.0;
  if (uDepthW > 0.0) {
    float zc = ik_z(uv);
    float zl = ik_z(uv - vec2(t.x, 0.0)), zr = ik_z(uv + vec2(t.x, 0.0));
    float zt = ik_z(uv + vec2(0.0, t.y)), zb = ik_z(uv - vec2(0.0, t.y));
    float dz = max(max(abs(zl - zc), abs(zr - zc)), max(abs(zt - zc), abs(zb - zc)));
    depthEdge = clamp(dz / max(zc, 1.0) * 6.0, 0.0, 1.0);
  }
  float e = max(lumaEdge * uLumaW, depthEdge * uDepthW);
  float th = 0.16 + 0.14 * ik_noise(px * 0.05);
  float ink = smoothstep(th - 0.05, th + 0.07, e);
  ink *= 0.55 + 0.45 * step(0.35, ik_noise(px * 0.21));
  outputColor = vec4(mix(inputColor.rgb, uInk, ink * uAmount), inputColor.a);
}
`

export class InkEffect extends Effect {
  constructor({ ink = '#0a0b0f', depthWeight = 2.2, lumaWeight = 0.9, amount = 0.85, width = 1.2 } = {}) {
    super('InkEffect', frag, {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uInk', new Uniform(new Color(ink))],
        ['uDepthW', new Uniform(depthWeight)],
        ['uLumaW', new Uniform(lumaWeight)],
        ['uAmount', new Uniform(amount)],
        ['uWidth', new Uniform(width)],
        ['uCam', new Uniform(new Vector2())],
      ]),
    })
  }
}
