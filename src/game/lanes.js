import * as THREE from 'three'
import { LANES, REDLINE } from '../data/palette.js'
import { BOSS_EVERY } from './rules.js'

// The live colours of the lane. A new lane is chosen when a wave clears and blends in over the gap before
// the next one; everything that glows copies from `pal` each frame, and the HUD's CSS accents follow.

export const LANE_BLEND = 1.8 // seconds

const KEYS = ['sky0', 'sky1', 'smog', 'star', 'sun', 'ambient', 'accent', 'accent2', 'glow', 'shadow', 'mid', 'high']

const flat = (l) => ({
  sky0: l.sky[0],
  sky1: l.sky[1],
  smog: l.smog,
  star: l.starTint,
  sun: l.sunColor,
  ambient: l.ambient,
  accent: l.accent,
  accent2: l.accent2,
  glow: l.glow,
  shadow: l.grade.shadow,
  mid: l.grade.mid,
  high: l.grade.high,
})

const colors = (lane) => {
  const f = flat(lane)
  return Object.fromEntries(KEYS.map((k) => [k, new THREE.Color(f[k])]))
}

export const pal = colors(LANES[0])
const from = colors(LANES[0])
const to = colors(LANES[0])
const blend = { k: 1, dirty: true }

// the game's root element; its --accent, --accent2 and --glow follow the lane
export const laneEl = { current: null }

export function laneFor(wave, cityKey) {
  if (wave % BOSS_EVERY === 0) return REDLINE
  const start = Math.max(0, LANES.findIndex((l) => l.city === cityKey))
  const level = wave - Math.floor(wave / BOSS_EVERY) // ordinary waves so far
  return LANES[(start + level - 1) % LANES.length]
}

export function setLane(lane, snap = false) {
  const f = flat(lane)
  for (const k of KEYS) {
    from[k].copy(pal[k])
    to[k].set(f[k])
    if (snap) pal[k].copy(to[k])
  }
  blend.k = snap ? 1 : 0
  blend.dirty = true
}

export function stepLane(dt) {
  if (blend.k < 1) {
    blend.k = Math.min(1, blend.k + dt / LANE_BLEND)
    const e = blend.k * blend.k * (3 - 2 * blend.k)
    for (const k of KEYS) pal[k].lerpColors(from[k], to[k], e)
    blend.dirty = true
  }
  if (blend.dirty && laneEl.current) {
    blend.dirty = false
    const s = laneEl.current.style
    s.setProperty('--accent', `#${pal.accent.getHexString()}`)
    s.setProperty('--accent2', `#${pal.accent2.getHexString()}`)
    s.setProperty('--glow', `#${pal.glow.getHexString()}`)
  }
}
