import { useSyncExternalStore } from 'react'

// Portrait expressions.
// Source: the 16 grid-sliced headshots. Cleaned copies live in src/assets/portrait/*.webp:
// stray pixels from neighbouring tiles removed, white die-cut border + thin ink outline baked in,
// bottom-aligned on a 342px square.
//
// These are placeholders until Arcane-style redraws arrive. Until then each frame is run through a
// painterly pass in a worker (src/workers/paint.worker.js) and the painted copy replaces the raw one.
// When the redraws land: drop them in with the same file names and set PAINT_PORTRAITS to false.
export const PAINT_PORTRAITS = true

const files = import.meta.glob('../assets/portrait/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const EXPRESSIONS = [
  'front',
  'look-left',
  'look-up',
  'profile-right',
  'down-left',
  'big-smile',
  'sly-up',
  'wink',
  'up-right',
  'eyebrow',
  'shy-laugh',
  'over-shoulder',
  'look-right',
  'thinking',
  'look-down',
  'grin-up',
]

export const portraitFrames = Object.fromEntries(
  EXPRESSIONS.map((name) => [name, files[`../assets/portrait/${name}.webp`] ?? '']),
)

// ---- painted copies ----
const painted = new Map()
const listeners = new Set()
let version = 0
let started = false

function emit() {
  version++
  for (const l of listeners) l()
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function portraitSrc(name) {
  const key = portraitFrames[name] ? name : 'front'
  return painted.get(key) ?? portraitFrames[key]
}

// Re-renders when a painted frame arrives.
export function usePortrait(name) {
  useSyncExternalStore(subscribe, () => version, () => 0)
  return portraitSrc(name)
}

// Warm the raw frames now, paint them when the browser is idle. Safe to call twice (StrictMode).
export function startPortraitPainting() {
  if (started || typeof window === 'undefined') return
  started = true
  for (const name of EXPRESSIONS) {
    const img = new Image()
    img.src = portraitFrames[name]
  }
  if (!PAINT_PORTRAITS || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return
  const go = () => {
    let worker
    try {
      worker = new Worker(new URL('../workers/paint.worker.js', import.meta.url), { type: 'module' })
    } catch {
      return
    }
    let pending = 0
    worker.onmessage = (e) => {
      const { name, blob } = e.data
      if (blob) {
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          const old = painted.get(name)
          painted.set(name, url)
          if (old) URL.revokeObjectURL(old)
          emit()
        }
        img.src = url
      }
      if (--pending === 0) worker.terminate()
    }
    // the faces you see first go first
    const order = ['front', 'look-left', 'look-right', ...EXPRESSIONS.filter((n) => !['front', 'look-left', 'look-right'].includes(n))]
    for (const name of order) {
      if (!portraitFrames[name]) continue
      pending++
      worker.postMessage({ name, url: new URL(portraitFrames[name], window.location.href).href })
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 1500 })
  else window.setTimeout(go, 400)
}
