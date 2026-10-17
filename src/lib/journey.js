// The home page's ride: its clock and its state, with no three.js or DOM in it so it runs in node. The scene
// steps it once a frame; the page reads it and pokes it on input.
//
//   ready → fly to 0 → dwell at 0 → fly to 1 → … → dwell at n-1 → fly to n (the fork) → fork → leave
//
// The ship sits at z = -d, flying down -z. Stop i is docked at d = dockAt(i); i = n is the fork.

export const GAP = 420 // world units between stops
export const LEG = 1.3 // seconds per leg at cruise
export const BOOST = 2.6 // legs and reading time run this much faster while space (or a press) is held
export const RUSH = 3.5 // the rest of a leg runs this much faster after "next"
export const CHARGE = 0.6 // seconds of holding to take off
export const TAP = 0.25 // a click fills the ring on its own, this fast
export const CREEP = 0.9 // units/s the ship drifts while stopped
export const REVEAL = 0.72 // a stop's card comes up this far into its leg, as the ship brakes
export const GRACE = 0.6 // seconds at the fork before an arrow key picks a way out, so a held → can't
export const LEAVE = 1.0 // seconds from picking a way out to the hex wipe
export const VMAX = (GAP * 15) / 8 / LEG // top speed of a cruise leg (smootherstep's steepest slope is 15/8)

// the view from the cockpit
export const FOV = 66
export const TILT = 0.11 // radians the pilot looks up, so the nose takes less of the canopy
export const DEPTH = 72 // a stop's body sits this far ahead of the docked ship
export const FORK_DEPTH = 150 // and the galaxies this far ahead of the fork

export const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10)
export const dockAt = (i) => (i + 1) * GAP

// Long enough to read the card's words twice over, between 6 and 9 s. The fact line is a glance, so it doesn't count.
export function dwellFor(stop) {
  const words = [stop.kicker, stop.title, stop.line].join(' ').split(/\s+/).filter((w) => /\w/.test(w)).length
  return Math.min(9, Math.max(6, 2.8 + words * 0.2))
}

export function createJourney(n, { fork = false, reduced = false } = {}) {
  const j = {
    n,
    reduced,
    phase: 'ready',
    i: 0, // the stop being flown to, or stopped at
    u: 0, // progress through the current leg, 0..1
    from: 0, // d where the current leg began
    d: 0,
    t: 0, // seconds stopped (dwell), at the fork, or since picking a way out
    speed: 0, // in VMAX
    charge: 0, // take-off ring, 0..1
    holding: false, // space or a press held
    tap: false, // a click asked for take-off
    rush: false,
    leaveKey: null,
  }
  if (fork) toFork(j)
  return j
}

function startLeg(j, i) {
  j.phase = 'fly'
  j.i = i
  j.u = 0
  j.from = j.d
  j.t = 0
  j.rush = false
}

export function toFork(j) {
  j.phase = 'fork'
  j.i = j.n
  j.u = 1
  j.d = dockAt(j.n)
  j.from = j.d
  j.t = 0
  j.speed = 0
  j.charge = 0
  j.tap = false
  j.rush = false
  j.leaveKey = null
}

export function restart(j) {
  j.phase = 'ready'
  j.i = 0
  j.u = 0
  j.d = 0
  j.from = 0
  j.t = 0
  j.speed = 0
  j.charge = 0
  j.tap = false
  j.rush = false
  j.leaveKey = null
}

// a click, Enter or →: take off, hurry the leg, or leave the stop
export function next(j) {
  if (j.phase === 'ready') j.tap = true
  else if (j.phase === 'fly') j.rush = true
  else if (j.phase === 'dwell') startLeg(j, j.i + 1)
}

export function leave(j, key) {
  if (j.phase === 'fly' && j.i === j.n) toFork(j)
  if (j.phase !== 'fork') return false
  j.phase = 'leave'
  j.leaveKey = key
  j.t = 0
  return true
}

// Advance by dt seconds. Returns what happened, if anything: 'launch', 'arrive', 'depart', 'fork' or 'left'.
export function stepJourney(j, dt, dwells) {
  const rate = j.holding ? BOOST : 1
  if (j.phase === 'ready') {
    j.speed = 0
    if (j.reduced && (j.tap || j.holding)) j.charge = 1
    else if (j.tap || j.holding) j.charge = Math.min(1, j.charge + dt / (j.tap ? TAP : CHARGE))
    else j.charge = Math.max(0, j.charge - (dt * 2) / CHARGE)
    if (j.charge < 1) return null
    j.tap = false
    startLeg(j, 0)
    return 'launch'
  }
  if (j.phase === 'fly') {
    const to = dockAt(j.i)
    j.u = j.reduced ? 1 : Math.min(1, j.u + (dt * rate * (j.rush ? RUSH : 1)) / LEG)
    const before = j.d
    j.d = j.from + (to - j.from) * smoother(j.u)
    j.speed = j.reduced || dt <= 0 ? 0 : (j.d - before) / dt / VMAX
    if (j.u < 1) return null
    j.rush = false
    j.speed = 0
    if (j.i >= j.n) {
      toFork(j)
      return 'fork'
    }
    j.phase = 'dwell'
    j.t = 0
    return 'arrive'
  }
  if (j.phase === 'dwell') {
    j.speed = 0
    // reduced motion: nothing moves on by itself; the visitor says when
    if (j.reduced) return null
    j.t += dt * rate
    j.d = dockAt(j.i) + Math.min(j.t, 10) * CREEP
    if (j.t < dwells[j.i]) return null
    startLeg(j, j.i + 1)
    return 'depart'
  }
  if (j.phase === 'fork') {
    j.t += dt
    return null
  }
  if (j.phase === 'leave') {
    const was = j.t
    j.t += dt
    const k = Math.min(1, j.t / LEAVE)
    j.speed = j.reduced ? 0 : 0.3 + k * k * 3.2
    if (j.reduced || (was < LEAVE && j.t >= LEAVE)) {
      j.t = Math.max(j.t, LEAVE)
      return was < LEAVE ? 'left' : null
    }
  }
  return null
}

// How far along the whole ride the ship is, 0..1: the start is 0, stop i is (i + 1) / (n + 1), the fork is 1.
export function progress(j) {
  const legs = j.n + 1
  if (j.phase === 'ready') return 0
  if (j.phase === 'fly') return (j.i + (j.d - j.from) / Math.max(1, dockAt(j.i) - j.from)) / legs
  if (j.phase === 'dwell') return (j.i + 1) / legs
  return 1
}

// The card on screen: from late in the leg in (as the ship brakes) until the next leg starts.
export function cardOf(j) {
  if (j.phase === 'dwell') return j.i
  if (j.phase === 'fly' && j.i < j.n && j.u >= REVEAL) return j.i
  return null
}

export function forkShown(j) {
  return j.phase === 'fork' || j.phase === 'leave' || (j.phase === 'fly' && j.i === j.n && j.u >= REVEAL)
}

// Where the docked pilot sees screen point (nx, ny) (-1..1 from the centre, y up), `depth` units ahead.
// `eye` is the camera's offset from the ship's origin; the ship is docked at d = `dock`.
export function restPoint(dock, nx, ny, depth, aspect, eye) {
  const tan = Math.tan((FOV * Math.PI) / 360)
  const x = nx * depth * tan * aspect
  const y0 = ny * depth * tan
  const z0 = -depth
  const c = Math.cos(TILT)
  const s = Math.sin(TILT)
  return [x + eye[0], y0 * c - z0 * s + eye[1], y0 * s + z0 * c + eye[2] - dock]
}
