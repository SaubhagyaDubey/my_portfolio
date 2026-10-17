import { create } from 'zustand'

const VISITED_KEY = 'deepfield.visited.v2'
const OLD_VISITED_KEY = 'deepfield.visited.v1' // blue/red keys, before the cities were renamed

function loadVisited() {
  try {
    const raw = localStorage.getItem(VISITED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { under: parsed.under ?? [], top: parsed.top ?? [] }
    }
    const old = localStorage.getItem(OLD_VISITED_KEY)
    if (old) {
      const parsed = JSON.parse(old)
      const migrated = { under: parsed.blue ?? [], top: parsed.red ?? [] }
      localStorage.setItem(VISITED_KEY, JSON.stringify(migrated))
      localStorage.removeItem(OLD_VISITED_KEY)
      return migrated
    }
  } catch {
    // storage may be unavailable; start fresh
  }
  return { under: [], top: [] }
}

function saveVisited(visited) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(visited))
  } catch {
    // storage may be unavailable; the site works without it
  }
}

// Reactive UI state. Anything that changes every frame lives in `sim` below instead.
export const useStore = create((set, get) => ({
  worldKey: null,
  near: null, // id of the stop the ship is close to
  docked: null, // id of the stop whose story is open
  target: null, // id the autopilot is flying to
  moved: false, // visitor has flown at least once (hides the hint)
  splash: null, // paint splash between scenes: { phase: 'in' | 'out', color, x, y }
  visited: loadVisited(),

  setWorld: (worldKey) => set({ worldKey, near: null, docked: null, target: null }),
  setNear: (near) => {
    if (get().near !== near) set({ near })
  },
  setTarget: (target) => set({ target }),
  setSplash: (splash) => set({ splash }),
  setMoved: () => {
    if (!get().moved) set({ moved: true })
  },
  dock: (id) => {
    const { worldKey, visited } = get()
    const list = visited[worldKey] ?? []
    const nextVisited = list.includes(id) ? visited : { ...visited, [worldKey]: [...list, id] }
    if (nextVisited !== visited) saveVisited(nextVisited)
    set({ docked: id, target: null, visited: nextVisited })
  },
  undock: () => {
    if (get().docked) set({ docked: null })
  },
}))

// Per-frame simulation state, mutated in place by the render loop. Not reactive on purpose.
export const sim = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  thrust: 0, // 0..1, drives the engine flame
  turn: 0, // smoothed yaw rate, banks the ship
  pointerDown: false,
  px: 0,
  py: 0,
  keys: new Set(),
  camZ: 240, // eases in on arrival
  leftId: null, // stop we just undocked from; suppresses immediate re-dock
  autopilot: null, // stop id
  fps: 60, // smoothed frame rate, for tuning the paint passes
}

export function resetSim(world) {
  sim.x = world.start[0]
  sim.y = world.start[1]
  sim.vx = 0
  sim.vy = 0
  sim.angle = 0
  sim.thrust = 0
  sim.turn = 0
  sim.pointerDown = false
  sim.keys.clear()
  sim.camZ = 240
  sim.leftId = null
  sim.autopilot = null
}

// DOM elements for the flags, keyed by stop id. Positioned from the render loop.
export const flagEls = new Map()

export function flyTo(id) {
  const st = useStore.getState()
  if (st.docked && st.docked !== id) {
    sim.leftId = st.docked
    st.undock()
  }
  if (st.docked === id) return
  sim.autopilot = id
  sim.pointerDown = false
  st.setTarget(id)
  st.setMoved()
}
