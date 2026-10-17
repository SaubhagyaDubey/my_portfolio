import { mulberry32 } from '../lib/seed.js'
import { BOSS_EVERY } from './rules.js'
import { BOX } from './state.js'

// Every fifth wave is the leviathan. The rest are built from a seed per wave, so a given wave always
// plays the same way, and get denser as you go: more groups, shorter gaps, meaner species.
// Event: { t, kind, x, y, pattern, phase }

export { BOSS_EVERY }

export function waveLabel(n) {
  return n % BOSS_EVERY === 0 ? { text: `wave ${n}`, sub: 'something big is coming up the lane' } : { text: `wave ${n}`, sub: WAVE_SUBS[(n - 1) % WAVE_SUBS.length] }
}

const WAVE_SUBS = [
  'jellies first. they mostly drift.',
  'darts fly in lines. lead them.',
  'the spiky ones stop and spit.',
  'hit the armoured ones and they split.',
  'all of it at once now.',
  'keep the combo going.',
  'roll with shift to slip through.',
]

export function buildWave(n) {
  if (n % BOSS_EVERY === 0) return [{ t: 2.2, kind: 'boss', x: 0, y: 0, pattern: 'boss', phase: 0 }]
  const rand = mulberry32(n * 97 + 13)
  const level = n - Math.floor(n / BOSS_EVERY) // ordinary waves so far
  const kinds = ['jelly', 'jelly', 'dart']
  if (level >= 2) kinds.push('dart', 'spitter')
  if (level >= 3) kinds.push('splitter', 'jelly')
  if (level >= 5) kinds.push('spitter', 'splitter', 'dart')
  const groups = 6 + Math.min(12, level * 2)
  const gap = Math.max(0.9, 2.6 - level * 0.18)
  const events = []
  const at = () => [(rand() * 2 - 1) * BOX.x * 0.9, (rand() * 2 - 1) * BOX.y * 0.9]
  let t = 1
  // the first wave opens with something easy to read
  const first = level <= 1 ? ['jelly', 'jelly', 'dart'] : []
  for (let g = 0; g < groups; g++) {
    const kind = first[g] ?? kinds[Math.floor(rand() * kinds.length)]
    const phase = rand() * Math.PI * 2
    if (kind === 'jelly') {
      const n2 = 3 + Math.floor(rand() * (2 + Math.min(3, level)))
      const [cx, cy] = at()
      for (let i = 0; i < n2; i++) {
        events.push({ t: t + i * 0.25, kind, x: cx + (rand() - 0.5) * 9, y: cy + (rand() - 0.5) * 5, pattern: 'sway', phase: phase + i })
      }
    } else if (kind === 'dart') {
      const helix = rand() < 0.5
      const n2 = helix ? 6 : 5
      const [cx, cy] = at()
      for (let i = 0; i < n2; i++) {
        if (helix) events.push({ t: t + i * 0.16, kind, x: cx * 0.5, y: cy * 0.5, pattern: 'helix', phase: phase + i * 0.9 })
        else {
          const side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2)
          events.push({ t: t + Math.abs(side) * 0.14, kind, x: cx + side * 2.4, y: cy + Math.abs(side) * 1.2, pattern: 'v', phase })
        }
      }
    } else if (kind === 'spitter') {
      const n2 = level >= 5 ? 2 : 1
      for (let i = 0; i < n2; i++) {
        const [x, y] = at()
        events.push({ t: t + i * 0.6, kind, x, y, pattern: 'hold', phase: phase + i })
      }
    } else {
      const [x, y] = at()
      events.push({ t, kind, x: x * 0.7, y: y * 0.7, pattern: 'tumble', phase })
    }
    t += gap + rand() * 1.2
  }
  return events.sort((a, b) => a.t - b.t)
}
