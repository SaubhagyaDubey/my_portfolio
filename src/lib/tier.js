// How much post-processing this device can afford. 2 = ink + MSAA, dpr 1.5; 1 = lighter ink, dpr 1.25;
// 0 = grade + bloom only, dpr 1.
// ?fx=0 turns post-processing off entirely; ?fx=1 or ?fx=2 forces a tier.

let cached = null

export function fxParam() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('fx')
}

export function getTier() {
  if (cached !== null) return cached
  const forced = fxParam()
  if (forced === '1' || forced === '2') return (cached = Number(forced))
  if (forced === '0') return (cached = 0)
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = navigator.deviceMemory ?? 4
  const short = Math.min(window.innerWidth, window.innerHeight)
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  if (!coarse && short >= 700 && cores >= 6 && mem >= 4) cached = 2
  else if (short >= 600 || cores >= 4) cached = 1
  else cached = 0
  return cached
}

export function fxEnabled() {
  return fxParam() !== '0'
}

// Max device pixel ratio per tier.
export function dprFor(tier) {
  return tier === 2 ? 1.5 : tier === 1 ? 1.25 : 1
}
