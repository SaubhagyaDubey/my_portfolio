import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Flags from '../components/Flags.jsx'
import { Hint, Hud } from '../components/Hud.jsx'
import RouteBar from '../components/RouteBar.jsx'
import StoryPanel from '../components/StoryPanel.jsx'
import { cityVars } from '../data/palette.js'
import { WORLDS } from '../data/worlds.js'
import { dprFor, getTier } from '../lib/tier.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { sim, useStore } from '../state/store.js'
import WorldScene from '../three/WorldScene.jsx'
import './explore.css'

const FLY_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'])

// One galaxy: the WebGL world underneath, flags and the story on top.
export default function Explore({ worldKey }) {
  const world = WORLDS[worldKey]
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const setWorld = useStore((s) => s.setWorld)

  useEffect(() => {
    setWorld(worldKey)
    if (import.meta.env.DEV) window.__deepfield = { sim, useStore }
  }, [worldKey, setWorld])

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'Escape') {
        const st = useStore.getState()
        if (st.docked) {
          sim.leftId = st.docked
          st.undock()
        }
        return
      }
      if (!FLY_KEYS.has(e.key)) return
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      e.preventDefault()
      sim.keys.add(e.key)
    }
    const up = (e) => sim.keys.delete(e.key)
    const clear = () => {
      sim.keys.clear()
      sim.pointerDown = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [])

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    sim.pointerDown = true
    sim.px = e.clientX
    sim.py = e.clientY
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // some browsers refuse capture on synthetic events; flying still works
    }
  }
  const onPointerMove = (e) => {
    sim.px = e.clientX
    sim.py = e.clientY
  }
  const onPointerUp = () => {
    sim.pointerDown = false
  }

  return (
    <div className="explore" data-city={world.key} style={cityVars(world.key)}>
      <div
        className="explore__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Canvas
          dpr={[1, dprFor(getTier())]}
          camera={{ fov: 50, near: 0.5, far: 1600, position: [world.start[0], world.start[1], 240], rotation: [0, 0, 0] }}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
        >
          <WorldScene world={world} reduced={reduced} />
        </Canvas>
      </div>
      <Hud world={world} />
      <Flags world={world} />
      <Hint />
      <StoryPanel world={world} />
      <RouteBar world={world} />
    </div>
  )
}
