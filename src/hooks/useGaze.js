import { useEffect, useRef, useState } from 'react'
import { IDLE, gazeFor, glanceFor } from '../lib/gaze.js'

// The launch portrait's face. It follows the pointer (a new frame only shows once the pointer has held
// it for a beat, so it never flickers), thinks and raises an eyebrow when nobody moves, grins at the
// game, and smiles when you commit. `state` is the launch state ref; its discs.face is the portrait.
export function useGaze(state, { armed, warp, introOn, stacked, reduced }) {
  const [pointerFrame, setPointerFrame] = useState('front')
  const [idleFrame, setIdleFrame] = useState(null)
  const [playLong, setPlayLong] = useState(false)
  const shown = useRef('front')

  useEffect(() => {
    if (stacked) return undefined
    const dwell = reduced ? 250 : 150
    let candidate = shown.current
    let timer = 0
    let lastMove = performance.now()
    let stage = -1
    const move = (e) => {
      lastMove = performance.now()
      if (stage !== -1) {
        stage = -1
        setIdleFrame(null)
      }
      const face = state.current.discs.face
      if (!face) return
      const fx = window.innerWidth / 2 + face.x
      const fy = window.innerHeight / 2 - face.y
      const next = gazeFor(e.clientX - fx, e.clientY - fy, face.r, window.innerWidth * 0.32, shown.current)
      if (next === candidate) return
      candidate = next
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        shown.current = candidate
        setPointerFrame(candidate)
      }, dwell)
    }
    const idle = window.setInterval(() => {
      const quiet = performance.now() - lastMove
      let s = -1
      for (let i = 0; i < IDLE.length; i++) if (quiet >= IDLE[i].after) s = i
      if (s !== stage) {
        stage = s
        setIdleFrame(s >= 0 ? IDLE[s].frame : null)
      }
    }, 500)
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.clearTimeout(timer)
      window.clearInterval(idle)
    }
  }, [state, stacked, reduced])

  // hovering the game: a grin, then a sly look if you hesitate
  useEffect(() => {
    if (armed !== 'play') return undefined
    const t = window.setTimeout(() => setPlayLong(true), 2500)
    return () => {
      window.clearTimeout(t)
      setPlayLong(false)
    }
  }, [armed])

  if (warp) return 'big-smile'
  if (armed === 'play') return playLong ? 'sly-up' : 'grin-up'
  if (introOn) return 'front'
  if (stacked) return armed ? glanceFor(armed) : 'front'
  return idleFrame ?? pointerFrame
}
