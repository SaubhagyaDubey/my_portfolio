// Deterministic "handmade" jitter. Never call Math.random in render; seed by id instead.

export function hashString(str) {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function mulberry32(seed) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededJitter(id, { rotate = 10, offset = 2 } = {}) {
  const rand = mulberry32(hashString(id))
  const between = (min, max) => min + rand() * (max - min)
  return {
    rotate: between(-rotate, rotate),
    dx: between(-offset, offset),
    dy: between(-offset, offset),
    breatheDur: between(3.5, 5.5),
    breatheDelay: between(0, 2),
    radiusVariant: 1 + Math.floor(rand() * 4),
  }
}
