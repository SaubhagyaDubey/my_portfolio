import { create } from 'zustand'
import { BOSS } from './creatures.js'
import { laneFor, setLane } from './lanes.js'
import { FIRST_WAVE_DELAY } from './rules.js'

export { BOX } from './rules.js'

// Deep Field: Impact. Space Impact, but from behind the ship and in depth.
// The world rushes toward the camera along +z; the ship stays near z = 0 and moves in a box in x/y.

export const RAIL = 62 // units/s the world rushes past
export const SPAWN_Z = -330
export const PASS_Z = 14 // anything past this is behind the camera
export const AIM_Z = -90 // shots converge on the ship's line at this depth
export const SHIP_S = 1 // ship scale in the game
export const HULL_MAX = 5
export const ROLL_TIME = 0.55 // a barrel roll; the ship can't be hit while it lasts
export const SEG_GAP = 8 // boss path samples between body segments

export const MAX_CREATURES = 160
export const MAX_SHOTS = 220
export const MAX_ORBS = 160
export const MAX_PICKUPS = 12
export const MAX_MISSILES = 36
export const BOSS_SEGMENTS = 16

const BEST_KEY = 'deepfield.impact.best'

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // storage may be unavailable; the best score just won't survive a reload
  }
}

const pool = (n, make) => Array.from({ length: n }, make)

// Per-frame game state, mutated in place by GameLoop. Not reactive on purpose (same idea as `sim`).
export const game = {
  t: 0,
  waveT: 0,
  wave: 0,
  queue: [], // spawn events for the current wave, sorted by t
  between: 0, // seconds left before the next wave starts
  bannerT: 0,
  overT: 0, // explosion time before the end card
  speed: RAIL,
  boost: 0, // 0..1 while rolling
  shake: 0,
  score: 0,
  hull: HULL_MAX,
  combo: 0,
  comboT: 0,
  kills: 0,
  reduced: false,
  city: 'under', // the city this run launched from; the lanes start there
  held: [], // pickup weapons on the rack, fired oldest first
  specialCd: 0,
  toastT: 0,
  shieldPop: 0, // the shield bubble bursting after it eats a hit
  nova: { t: -1, x: 0, y: 0, z: 0, hitBoss: false }, // t < 0 when no ring is running
  lance: { t: 0, tick: 0 }, // t > 0 while the beam is on
  player: { x: 0, y: 0, vx: 0, vy: 0, bank: 0, pitch: 0, rollT: 0, rollDir: 1, rollCd: 0, inv: 0, fireCd: 0, muzzle: 0, twin: 0, shield: 0, wind: 0, alive: true },
  input: { tx: 0, ty: 0, fire: false, keys: new Set(), roll: false, special: false },
  creatures: pool(MAX_CREATURES, () => ({ on: false, kind: 'jelly', x: 0, y: 0, z: 0, bx: 0, by: 0, vx: 0, vy: 0, vz: 0, hp: 1, r: 1, t: 0, phase: 0, pattern: 'sway', flash: 0, fireCd: 0, hold: 0 })),
  shots: pool(MAX_SHOTS, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 })),
  orbs: pool(MAX_ORBS, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 })),
  pickups: pool(MAX_PICKUPS, () => ({ on: false, kind: 'repair', x: 0, y: 0, z: 0, t: 0, big: false })),
  missiles: pool(MAX_MISSILES, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, target: null, spark: 0 })),
  boss: { on: false, x: 0, y: 0, z: 0, hp: 0, max: 1, t: 0, fireCd: 0, callCd: 0, flash: 0, dying: 0, specialLeft: 0, trail: [] },
  bursts: [], // { x, y, z, color, n, speed, size } queued for Explosions
}

// Reactive HUD values. GameLoop writes these only when they change.
export const useGame = create((set) => ({
  phase: 'title', // title | playing | paused | over
  score: 0,
  hull: HULL_MAX,
  wave: 0,
  mult: 1,
  best: loadBest(),
  cam: 'chase', // chase | cockpit
  banner: null, // { text, sub, key }
  boss: null, // 0..1 health while a boss is up
  twin: false,
  held: '', // the rack, space-separated, oldest first
  shield: false,
  wind: false,
  toast: null, // { kind, full, key } when a pickup lands
  hit: 0, // bumps on every hit, drives the red flash
  flash: 0, // bumps on every nova, drives the white flash
  set,
}))

export function resetGame(startWave = 1) {
  game.t = 0
  game.waveT = 0
  game.wave = startWave - 1
  game.queue = []
  game.between = FIRST_WAVE_DELAY
  game.bannerT = 0
  game.overT = 0
  game.speed = RAIL
  game.boost = 0
  game.shake = 0
  game.score = 0
  game.hull = HULL_MAX
  game.combo = 0
  game.comboT = 0
  game.kills = 0
  game.held = []
  game.specialCd = 0
  game.toastT = 0
  game.shieldPop = 0
  game.nova.t = -1
  game.lance.t = 0
  Object.assign(game.player, { x: 0, y: 0, vx: 0, vy: 0, bank: 0, pitch: 0, rollT: 0, rollCd: 0, inv: 1.5, fireCd: 0, muzzle: 0, twin: 0, shield: 0, wind: 0, alive: true })
  game.input.tx = 0
  game.input.ty = 0
  game.input.special = false
  for (const list of [game.creatures, game.shots, game.orbs, game.pickups, game.missiles]) for (const e of list) e.on = false
  game.boss.on = false
  game.boss.trail.length = 0
  game.bursts.length = 0
  setLane(laneFor(startWave, game.city), true)
  useGame.getState().set({ score: 0, hull: HULL_MAX, wave: startWave, mult: 1, banner: null, boss: null, twin: false, held: '', shield: false, wind: false, toast: null })
}

// The DOM reticle, positioned from the render loop (like the flags in the galaxies).
export const reticleEl = { current: null }

export function firstFree(list) {
  for (const e of list) if (!e.on) return e
  return null
}

export function burst(x, y, z, color, n = 26, speed = 14, size = 1.2) {
  if (game.bursts.length < 40) game.bursts.push({ x, y, z, color, n, speed, size })
}

// the ship's roll about the lane: bank into turns, plus a full turn while barrel-rolling
export function shipRoll(p) {
  const r = p.rollT > 0 ? p.rollDir * -(1 - p.rollT / ROLL_TIME) * Math.PI * 2 : 0
  return p.bank + r
}

// where segment i sits: behind the head in z, lagging along the head's recent path in x/y
const segOut = { x: 0, y: 0, z: 0 }
export function segmentPos(i, out = segOut) {
  const b = game.boss
  const tr = b.trail
  const s = tr[Math.max(0, tr.length - 1 - (i + 1) * SEG_GAP)] ?? b
  out.x = s.x
  out.y = s.y
  out.z = b.z - (i + 1) * BOSS.gap
  return out
}
