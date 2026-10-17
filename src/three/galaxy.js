import { BASE, CITIES } from '../data/palette.js'
import { mulberry32 } from '../lib/seed.js'

// The two launch galaxies as point clouds in a unit disc. Each city gets its own shape:
//   under (Zaun): a ragged two-arm chem spiral, off-centre bulge, a dust lane, shimmer-pink knots, smog haze.
//   top (Piltover): an ordered barred spiral, blue-white bar and inner ring, tight hextech arms with even knots.
// Pure data (no three.js) so it can be tested in node. aR is the normalised radius, used to unwind the
// galaxy from its centre during the cold open.

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export const GALAXY_COUNT = { 2: 9000, 1: 6500, 0: 4000 }

export function buildGalaxy(id, count, seed = id === 'under' ? 3 : 5) {
  const rand = mulberry32(seed)
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5 // cheap, roughly normal in -1..1
  const city = CITIES[id]
  const accent = rgb(city.accent)
  const second = rgb(city.accent2)
  const glow = rgb(city.glow)
  const core = rgb(BASE.core)
  const smog = rgb(city.smog)

  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const col = new Float32Array(count * 3)
  const phase = new Float32Array(count)
  const radius = new Float32Array(count)

  // knot centres along the arms (undercity only; topside spaces its knots evenly)
  const knots = Array.from({ length: 14 }, (_, k) => {
    const t = 0.25 + rand() * 0.7
    const arm = k % 2
    const ang = t * 3.6 + arm * Math.PI + (rand() - 0.5) * 0.3
    const rad = 0.06 + t * 0.94
    return [Math.cos(ang) * rad, Math.sin(ang) * rad]
  })

  for (let i = 0; i < count; i++) {
    const u = rand()
    let x = 0
    let y = 0
    let c = accent
    let bright = 1
    let s = 0.9 + rand() * 1.4

    if (id === 'under') {
      if (u < 0.18) {
        // bulge, a little off-centre
        const rr = Math.pow(rand(), 1.6) * 0.2
        const a = rand() * Math.PI * 2
        x = 0.03 + Math.cos(a) * rr
        y = -0.02 + Math.sin(a) * rr * 0.85
        c = mix(glow, core, 0.55 + rand() * 0.4)
        bright = 1.3
        s = 1.2 + rand() * 1.6
      } else if (u < 0.25) {
        // shimmer knots
        const [kx, ky] = knots[Math.floor(rand() * knots.length)]
        x = kx + gauss() * 0.025
        y = ky + gauss() * 0.025
        c = mix(second, core, rand() * 0.25)
        bright = 1.4
        s = 1.6 + rand() * 1.0
      } else if (u < 0.35) {
        // smog haze over the disc
        const rr = Math.pow(rand(), 0.5)
        const a = rand() * Math.PI * 2
        x = Math.cos(a) * rr
        y = Math.sin(a) * rr
        c = smog
        bright = 0.12
        s = 3 + rand() * 2
      } else {
        // two loose arms; the trailing edge of each is a dust lane
        const t = Math.pow(rand(), 0.8)
        const arm = i % 2
        const width = 0.08 + t * 0.22
        const spread = (rand() - 0.5) * width
        const ang = t * 3.6 + arm * Math.PI + spread * 2.4
        const rad = 0.06 + t * 0.94 + (rand() - 0.5) * 0.06
        x = Math.cos(ang) * rad
        y = Math.sin(ang) * rad
        c = mix(accent, core, Math.max(0, 0.35 - t * 0.5) + rand() * 0.1)
        bright = 0.7 + rand() * 0.6 + (1 - t) * 0.3
        if (spread < -width * 0.22) bright *= 0.28
      }
    } else {
      if (u < 0.14) {
        // the bar, brightest at its middle
        const along = gauss()
        x = along * 0.24
        y = gauss() * 0.03 * (1 - Math.abs(along) * 0.5)
        c = mix(second, core, 0.25 + (1 - Math.abs(along)) * 0.5)
        bright = 0.8 + (1 - Math.abs(along)) * 0.6
        s = 1.1 + rand() * 1.3
      } else if (u < 0.17) {
        // a fine inner ring
        const a = rand() * Math.PI * 2
        const rr = 0.3 + gauss() * 0.012
        x = Math.cos(a) * rr
        y = Math.sin(a) * rr
        c = second
        bright = 0.32
        s = 0.8 + rand() * 0.6
      } else if (u < 0.19) {
        // a faint outer ring
        const a = rand() * Math.PI * 2
        const rr = 0.92 + gauss() * 0.02
        x = Math.cos(a) * rr
        y = Math.sin(a) * rr
        c = accent
        bright = 0.16
      } else {
        // two tight arms from the bar's ends, knots at even steps
        const t = Math.pow(rand(), 0.85)
        const arm = i % 2
        const spread = gauss() * (0.05 + t * 0.12)
        const ang = t * 4.4 + arm * Math.PI + spread * 2
        const rad = 0.22 + t * 0.76 + spread * 0.5
        x = Math.cos(ang) * rad
        y = Math.sin(ang) * rad
        c = mix(accent, core, (1 - t) * 0.25)
        bright = 0.24 + rand() * 0.26
        if ((t / 0.12) % 1 < 0.16) {
          c = mix(glow, core, 0.3)
          bright *= 1.5
          s += 0.6
        }
      }
    }

    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = 0
    size[i] = s
    col[i * 3] = c[0] * bright
    col[i * 3 + 1] = c[1] * bright
    col[i * 3 + 2] = c[2] * bright
    phase[i] = rand()
    radius[i] = Math.min(1, Math.hypot(x, y))
  }
  return { pos, size, col, phase, radius }
}
