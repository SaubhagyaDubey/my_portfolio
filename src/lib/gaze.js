// Which portrait frame looks toward the pointer. dx/dy are the pointer's offset from the face centre in
// screen px (y down). The frames were matched by eye: `look-down` is head turned left with eyes down,
// `down-left` is head bowed; there is no up-left frame, so up-left uses `look-left`.

// [from, to) in degrees, 0 = right, 90 = up
// The side sectors are wide on purpose: the cities sit left and right of the face, a little below it.
const SECTORS = [
  { frame: 'look-right', from: -42, to: 25 },
  { frame: 'up-right', from: 25, to: 70 },
  { frame: 'look-up', from: 70, to: 110 },
  { frame: 'look-left', from: 110, to: 222 },
  { frame: 'look-down', from: 222, to: 252 },
  { frame: 'down-left', from: 252, to: 318 },
]
const HYSTERESIS = 8

function inSector(sector, deg, pad) {
  // how far past the sector's start, on a 0..360 circle; `pad` widens both edges
  const past = (((deg - sector.from) % 360) + 360) % 360
  return past < sector.to - sector.from + pad || past >= 360 - pad
}

// prev: the frame showing now, so a pointer sitting on a sector edge keeps it.
export function gazeFor(dx, dy, faceR, farX, prev = null) {
  if (Math.hypot(dx, dy) < faceR * 0.8) return 'front'
  const deg = (Math.atan2(-dy, dx) * 180) / Math.PI
  const base = prev === 'profile-right' ? 'look-right' : prev
  const keep = SECTORS.find((s) => s.frame === base)
  let frame = keep && inSector(keep, deg, HYSTERESIS) ? keep.frame : (SECTORS.find((s) => inSector(s, deg, 0))?.frame ?? 'front')
  if (frame === 'look-right' && dx >= farX) frame = 'profile-right'
  return frame
}

// Stacked layout (phones): no pointer to follow, so an armed city gets a glance.
export function glanceFor(armed) {
  return armed === 'top' ? 'look-up' : armed === 'under' ? 'down-left' : armed === 'play' ? 'look-down' : 'front'
}

// What the face does when nobody moves: think, raise an eyebrow, then settle.
export const IDLE = [
  { after: 4000, frame: 'thinking' },
  { after: 9000, frame: 'eyebrow' },
  { after: 13000, frame: 'front' },
]
