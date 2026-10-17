import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { flagEls, resetSim, sim, useStore } from '../state/store.js'

const ACC = 64 // units/s²
const MAX = 46 // units/s
const DRAG_IDLE = 0.962
const DRAG_THRUST = 0.986
const CAM_Z = 62
const CAM_Z_DOCKED = 50
const NEAR = 18 // "near" band outside an object's radius
const DOCK_AT = 9 // dock when this close and slow
const UNDOCK_AT = 22

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

// Flies the ship, follows it with the camera, docks at stops, and pins the DOM flags.
export default function Simulation({ world, reduced }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    resetSim(world)
    if (reduced) sim.camZ = CAM_Z
    camera.position.set(world.start[0], world.start[1], sim.camZ)
    camera.rotation.set(0, 0, 0) // fiber aims new cameras at the origin; we want straight down
    camera.updateProjectionMatrix()
  }, [world, reduced, camera])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useStore.getState()
    const stops = world.stops

    // visible extent of the flight plane at the current camera height
    const fovH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z
    const fovW = fovH * camera.aspect

    // ---- input
    let ax = 0
    let ay = 0
    let manual = false
    const k = sim.keys
    if (k.has('ArrowLeft') || k.has('a') || k.has('A')) ax -= 1
    if (k.has('ArrowRight') || k.has('d') || k.has('D')) ax += 1
    if (k.has('ArrowUp') || k.has('w') || k.has('W')) ay += 1
    if (k.has('ArrowDown') || k.has('s') || k.has('S')) ay -= 1
    if (ax || ay) manual = true
    if (sim.pointerDown) {
      const wx = camera.position.x + (sim.px / size.width - 0.5) * fovW
      const wy = camera.position.y - (sim.py / size.height - 0.5) * fovH
      const dx = wx - sim.x
      const dy = wy - sim.y
      const d = Math.hypot(dx, dy)
      if (d > 2.5) {
        ax += dx / d
        ay += dy / d
        manual = true
      }
    }
    if (manual) {
      if (sim.autopilot) {
        sim.autopilot = null
        st.setTarget(null)
      }
      st.setMoved()
    }

    // ---- autopilot: fly to a stop and settle just outside it
    let thrusting = false
    if (sim.autopilot) {
      const t = stops.find((s) => s.id === sim.autopilot)
      if (!t) {
        sim.autopilot = null
      } else {
        const dx = t.pos[0] - sim.x
        const dy = t.pos[1] - sim.y
        const d = Math.hypot(dx, dy)
        const stopAt = t.r + 10.5
        if (d - stopAt < 1.2) {
          sim.autopilot = null
          sim.vx *= 0.25
          sim.vy *= 0.25
          dockNow(st, t)
        } else {
          const want = Math.min(MAX, Math.max(9, (d - stopAt) * 1.15))
          const sx = (dx / d) * want - sim.vx
          const sy = (dy / d) * want - sim.vy
          const sl = Math.hypot(sx, sy) || 1
          const step = Math.min(sl, ACC * 1.7 * dt)
          sim.vx += (sx / sl) * step
          sim.vy += (sy / sl) * step
          thrusting = true
        }
      }
    }

    // ---- manual thrust, drag, clamp
    const len = Math.hypot(ax, ay)
    if (len > 0) {
      sim.vx += (ax / len) * ACC * dt
      sim.vy += (ay / len) * ACC * dt
      thrusting = true
    }
    const f = Math.pow(thrusting ? DRAG_THRUST : DRAG_IDLE, dt * 60)
    sim.vx *= f
    sim.vy *= f
    let speed = Math.hypot(sim.vx, sim.vy)
    if (speed > MAX) {
      sim.vx *= MAX / speed
      sim.vy *= MAX / speed
      speed = MAX
    }
    sim.x += sim.vx * dt
    sim.y += sim.vy * dt

    // soft walls
    const b = world.bounds
    if (sim.x < b.x[0]) {
      sim.x = b.x[0]
      sim.vx = Math.abs(sim.vx) * 0.3
    } else if (sim.x > b.x[1]) {
      sim.x = b.x[1]
      sim.vx = -Math.abs(sim.vx) * 0.3
    }
    if (sim.y < b.y[0]) {
      sim.y = b.y[0]
      sim.vy = Math.abs(sim.vy) * 0.3
    } else if (sim.y > b.y[1]) {
      sim.y = b.y[1]
      sim.vy = -Math.abs(sim.vy) * 0.3
    }

    // heading and bank
    const prevAngle = sim.angle
    if (speed > 1.5) sim.angle = lerpAngle(sim.angle, Math.atan2(sim.vy, sim.vx), 1 - Math.pow(0.002, dt))
    let dA = sim.angle - prevAngle
    while (dA > Math.PI) dA -= Math.PI * 2
    while (dA < -Math.PI) dA += Math.PI * 2
    sim.turn += ((dA / Math.max(dt, 1e-3)) * 0.25 - sim.turn) * Math.min(1, dt * 6)
    sim.thrust += ((thrusting ? 1 : 0) - sim.thrust) * Math.min(1, dt * 7)

    // ---- proximity and docking
    let near = null
    let nearGap = Infinity
    for (const s of stops) {
      const gap = Math.hypot(s.pos[0] - sim.x, s.pos[1] - sim.y) - s.r
      if (gap < NEAR && gap < nearGap) {
        nearGap = gap
        near = s
      }
    }
    st.setNear(near ? near.id : null)
    if (near && !sim.autopilot && !st.docked && near.id !== sim.leftId && nearGap < DOCK_AT && speed < 24) dockNow(st, near)
    if (st.docked) {
      const d = stops.find((s) => s.id === st.docked)
      if (d && Math.hypot(d.pos[0] - sim.x, d.pos[1] - sim.y) - d.r > UNDOCK_AT) {
        sim.leftId = st.docked
        st.undock()
      }
    }
    if (sim.leftId) {
      const l = stops.find((s) => s.id === sim.leftId)
      if (!l || Math.hypot(l.pos[0] - sim.x, l.pos[1] - sim.y) - l.r > UNDOCK_AT + 6) sim.leftId = null
    }

    // ---- camera: follow with a little lead, shift aside while a story is open, ease down on arrival
    let ox = 0
    let oy = 0
    if (st.docked) {
      if (size.width > 760) ox = (Math.min(size.width * 0.42, 420) * 0.5 + 12) * (fovW / size.width)
      else oy = -(size.height * 0.2) * (fovH / size.height)
    }
    const targetZ = st.docked ? CAM_Z_DOCKED : CAM_Z
    const zRate = sim.camZ > 90 ? 1.5 : 3
    sim.camZ += (targetZ - sim.camZ) * Math.min(1, dt * zRate)
    const lead = 0.22
    const tx = sim.x + sim.vx * lead + ox
    const ty = sim.y + sim.vy * lead + oy
    const follow = Math.min(1, dt * 3.4)
    camera.position.x += (tx - camera.position.x) * follow
    camera.position.y += (ty - camera.position.y) * follow
    camera.position.z = sim.camZ
    sim.fps += (1 / Math.max(delta, 1e-3) - sim.fps) * 0.05
    if (import.meta.env.DEV) sim.debug = { camX: camera.position.x, camY: camera.position.y, camZ: camera.position.z, W: size.width, H: size.height, aspect: camera.aspect, ox, fovW }

    // ---- flags: project each stop's top edge to the screen; clamp to the edge when off-screen,
    // then push edge flags apart so they never stack on top of each other
    const W = size.width
    const H = size.height
    const MX = W < 760 ? 84 : 130 // half a label, roughly
    const MY = 44
    const placed = []
    for (const s of stops) {
      const el = flagEls.get(s.id)
      if (!el) continue
      v.set(s.pos[0], s.pos[1] + s.r * 1.15 + 1.4, 0).project(camera)
      let sx = (v.x * 0.5 + 0.5) * W
      let sy = (1 - (v.y * 0.5 + 0.5)) * H
      const behind = v.z > 1
      const off = behind || sx < MX || sx > W - MX || sy < MY || sy > H - MY
      let angle = 0
      let side = null
      if (off) {
        const cx = W / 2
        const cy = H / 2
        angle = Math.atan2(sy - cy, sx - cx)
        const c = Math.cos(angle) || 1e-6
        const sn = Math.sin(angle) || 1e-6
        const mX = (W / 2 - MX) / Math.abs(c)
        const mY = (H / 2 - MY - 60) / Math.abs(sn)
        const m = Math.min(mX, mY)
        side = mX < mY ? (c > 0 ? 'R' : 'L') : sn > 0 ? 'B' : 'T'
        sx = cx + c * m
        sy = cy + sn * m
      } else {
        sx = Math.min(W - MX, Math.max(MX, sx))
      }
      const dist = Math.hypot(s.pos[0] - sim.x, s.pos[1] - sim.y)
      placed.push({ el, sx, sy, off, side, angle, close: THREE.MathUtils.clamp(1 - (dist - s.r) / 60, 0, 1) })
    }
    for (const side of ['L', 'R', 'T', 'B']) {
      const group = placed.filter((f) => f.off && f.side === side)
      if (group.length < 2) continue
      const key = side === 'L' || side === 'R' ? 'sy' : 'sx'
      const gap = key === 'sy' ? 36 : 150
      const lo = key === 'sy' ? MY + 60 : MX
      const hi = key === 'sy' ? H - MY - 60 : W - MX
      group.sort((a, b) => a[key] - b[key])
      for (let i = 1; i < group.length; i++) if (group[i][key] < group[i - 1][key] + gap) group[i][key] = group[i - 1][key] + gap
      for (let i = group.length - 1; i >= 0; i--) {
        if (group[i][key] > hi) group[i][key] = hi
        if (i > 0 && group[i - 1][key] > group[i][key] - gap) group[i - 1][key] = group[i][key] - gap
      }
      for (const f of group) if (f[key] < lo) f[key] = lo
    }
    for (const f of placed) {
      f.el.style.transform = `translate3d(${f.sx.toFixed(1)}px, ${f.sy.toFixed(1)}px, 0)`
      const state = f.off ? 'edge' : 'on'
      if (f.el.dataset.place !== state) f.el.dataset.place = state
      if (f.off) f.el.style.setProperty('--arrow', `${((f.angle * 180) / Math.PI).toFixed(0)}deg`)
      f.el.style.setProperty('--close', f.close.toFixed(2))
    }
  })

  return null
}

function dockNow(st, stop) {
  sim.autopilot = null
  sim.leftId = null
  st.dock(stop.id)
}
