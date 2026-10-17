// The launch card's cold open: about two seconds, once per tab session, skipped under reduced motion.
// One clock (seconds) drives the WebGL uniforms and the DOM animations alike. Beats are [start, end].
// Nothing here reveals text character by character, springs or overshoots.

export const INTRO = {
  total: 2.0,
  spark: [0, 0.25], // a hextech spark at the centre
  sparkFade: [0.55, 0.95],
  tear: [0.2, 0.55], // the seam tears top → bottom (left → right on phones)
  flood: [0.45, 1.05], // the cities flood outward from the seam
  birth: [0.6, 1.3], // galaxies unwind from a point
  stars: [0.6, 1.2],
  face: [1.1, 1.4],
  name: [1.15, 1.35], // the name lands, whole
  pulse: 1.33, // the seam flares as the name lands
  line: [1.45, 1.7],
  ship: [1.5, 1.95],
  sides: [1.55, 1.85],
  chrome: [1.65, 2.0], // play, corner, footer
}

export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const beat = (t, [a, b]) => clamp01((t - a) / (b - a))
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
export const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

// DOM beats, as WAAPI keyframes over the whole intro (offsets are fractions of INTRO.total).
// Each target is a CSS selector inside the launch card; the stylesheet holds the finished state.
const at = (s) => s / INTRO.total
const fade = (key, from = {}) => [
  { offset: 0, opacity: 0, ...from },
  { offset: at(INTRO[key][0]), opacity: 0, ...from },
  { offset: at(INTRO[key][1]), opacity: 1, transform: 'none' },
  { offset: 1, opacity: 1, transform: 'none' },
]
export const INTRO_DOM = [
  { sel: '.helmet', frames: fade('face', { transform: 'scale(0.94)' }) },
  {
    sel: '.launch__name span',
    frames: [
      { offset: 0, opacity: 0, transform: 'scale(1.12)' },
      { offset: at(INTRO.name[0]), opacity: 0, transform: 'scale(1.12)', easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' },
      { offset: at(INTRO.name[0] + 0.04), opacity: 1 },
      { offset: at(INTRO.name[1]), opacity: 1, transform: 'none' },
      { offset: 1, opacity: 1, transform: 'none' },
    ],
  },
  { sel: '.launch__hello', frames: fade('line') },
  { sel: '.side--under', frames: fade('sides', { transform: 'translateX(-10px)' }) },
  { sel: '.side--top', frames: fade('sides', { transform: 'translateX(10px)' }) },
  { sel: '.launch__third', frames: fade('chrome') },
  { sel: '.launch__corner', frames: fade('chrome') },
  { sel: '.launch__foot', frames: fade('chrome') },
]

const SEEN_KEY = 'deepfield.intro.v1'
let played = false

function param() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('intro')
}

export function shouldPlayIntro(reduced) {
  if (reduced) return false
  const p = param()
  if (p === '0') return false
  if (p === '1') return true
  if (played) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

export function markIntroSeen() {
  played = true
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // storage may be unavailable; the module flag still stops a replay this visit
  }
}
