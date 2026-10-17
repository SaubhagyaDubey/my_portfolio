// The launch card leans toward whichever side the pointer is on: -1 = all undercity, +1 = all topside.
// On phones the cities are stacked (topside above), so the lean follows y instead of x.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// Saturates 8% from either edge, with a small dead zone over the centre column.
export function leanFrom(x, y, w, h, stacked) {
  const u = stacked ? 1 - y / Math.max(h, 1) : x / Math.max(w, 1)
  const raw = clamp((u - 0.5) / 0.42, -1, 1)
  return Math.sign(raw) * smoothstep(0.1, 1, Math.abs(raw))
}

// A side arms past ARM_ON and stays armed until the lean drops under ARM_OFF, so the boundary never flickers.
export const ARM_ON = 0.45
export const ARM_OFF = 0.3

export function nextArmed(armed, lean) {
  const a = Math.abs(lean)
  const side = lean < 0 ? 'under' : 'top'
  if (a >= ARM_ON) return side
  if (armed === side && a >= ARM_OFF) return armed
  return null
}

// Where the seam sits across the screen (0..1): leaning toward a city widens it.
export function seamFor(leanS) {
  return 0.5 - 0.24 * leanS
}

// Committing floods the whole frame with the chosen city.
export const SEAM_WARP = { under: 1.3, top: -0.3 }

// Frame-rate independent easing toward a target.
export function ease(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-dt * rate))
}
