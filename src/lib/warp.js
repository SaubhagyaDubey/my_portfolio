import { CITIES } from '../data/palette.js'
import { navigate } from './router.js'
import { useStore } from '../state/store.js'

// Throw a splash of the destination city's colour across the screen, change scene underneath it,
// then let it fade. ~540ms. Reduced motion: a straight cut.
export function warpTo(path, origin = null) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    navigate(path)
    return
  }
  const key = path.replace(/^\//, '')
  const city = CITIES[key]
  const color = city ? `color-mix(in oklab, ${city.accent} 42%, ${city.plate[1]})` : 'var(--ink)'
  const x = `${Math.round(origin ? origin.x : window.innerWidth / 2)}px`
  const y = `${Math.round(origin ? origin.y : window.innerHeight / 2)}px`
  const st = useStore.getState()
  st.setSplash({ phase: 'in', color, x, y })
  window.setTimeout(() => {
    navigate(path)
    window.setTimeout(() => {
      useStore.getState().setSplash({ phase: 'out', color, x, y })
      window.setTimeout(() => useStore.getState().setSplash(null), 300)
    }, 60)
  }, 220)
}
