// Portrait expressions.
// Source: the 16 grid-sliced headshots. Cleaned copies live in src/assets/portrait/*.webp:
// stray pixels from neighbouring tiles removed, white die-cut border + thin ink outline baked in,
// bottom-aligned on a 342px square.
//
// These are placeholders until Arcane-style redraws arrive: drop them in with the same file names.

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

// Decode every frame up front so a swap never shows a blank plate. Safe to call twice (StrictMode).
let started = false
export function preloadPortraits() {
  if (started || typeof window === 'undefined') return
  started = true
  for (const name of EXPRESSIONS) {
    const img = new Image()
    img.src = portraitFrames[name]
    img.decode?.().catch(() => {})
  }
}
