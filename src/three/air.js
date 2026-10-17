import * as THREE from 'three'

// The live colours of a galaxy's sky: backdrop, haze, ambient light and the grade's split tone. Docking at a
// planet with its own `air` blends the sky to it; undocking blends back to the galaxy's. Text and plates never
// follow it, only the scene does. Starfield, Effects and WorldScene copy from `air` each frame. The home page's
// ride keeps its own sky the same way, through createAir.

export const AIR_BLEND = 1.6 // seconds

const KEYS = ['sky0', 'sky1', 'smog', 'ambient', 'shadow', 'mid', 'high']

// a city or a stop's `air`: both carry sky, smog, ambient and grade
const flat = (a) => ({
  sky0: a.sky[0],
  sky1: a.sky[1],
  smog: a.smog,
  ambient: a.ambient,
  shadow: a.grade.shadow,
  mid: a.grade.mid,
  high: a.grade.high,
})

const colors = () => Object.fromEntries(KEYS.map((k) => [k, new THREE.Color()]))

// One live sky and its blend. `live` is what the scene copies from; set() aims it at a new air, step() moves it.
export function createAir(initial = null) {
  const live = colors()
  const from = colors()
  const to = colors()
  const blend = { k: 1, src: null }

  function set(src, snap = false) {
    if (src === blend.src && !snap) return
    blend.src = src
    const f = flat(src)
    for (const k of KEYS) {
      from[k].copy(live[k])
      to[k].set(f[k])
      if (snap) live[k].copy(to[k])
    }
    blend.k = snap ? 1 : 0
  }

  function step(dt) {
    if (blend.k >= 1) return
    blend.k = Math.min(1, blend.k + dt / AIR_BLEND)
    const e = blend.k * blend.k * (3 - 2 * blend.k)
    for (const k of KEYS) live[k].lerpColors(from[k], to[k], e)
  }

  if (initial) set(initial, true)
  return { live, set, step }
}

// the galaxies' sky
const main = createAir()
export const air = main.live
export const setAir = main.set
export const stepAir = main.step
