import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CITIES } from '../data/palette.js'
import { ease } from '../lib/lean.js'
import ShipModel, { SHIP_MUZZLES } from './ShipModel.jsx'
import { launchStarFrag, launchStarVert } from './shaders.js'
import { useShaderMaterial } from './useShaderMaterial.js'

// The ship on the launch card, parked under my name. It banks toward the side you lean into and takes
// that city's light, fires when you hover the game, and on a commit dives into the galaxy you picked
// (or flips and drops through the play button). Same model as the galaxies and the shooter, unmodified:
// it's built in steel and recoloured here by finding its materials by their starting colour.

const START = { accent: '#bcd4f6', glow: '#e4efff', accent2: '#a9bdd8' }
const LOOK = {
  none: START,
  under: { accent: CITIES.under.accent, glow: CITIES.under.glow, accent2: CITIES.under.accent2 },
  top: { accent: CITIES.top.accent, glow: CITIES.top.glow, accent2: CITIES.top.accent2 },
}
const UNIT = 3.8 // model length
const PITCH = 0.62 // nose tipped away from the camera: a three-quarter view from behind
const BOLTS = 16
const BOLT_SPEED = 950 // px/s
const BOLT_LIFE = 0.26
const BURST = 0.42 // seconds between bursts
const TRAIL = 30

export default function LaunchShip({ state }) {
  const { gl, size } = useThree()
  const pos = useRef()
  const yawG = useRef()
  const rollG = useRef()
  const model = useRef()
  const thrust = useRef(0.15)
  const getThrust = useMemo(() => () => thrust.current, [])
  const rim = useRef()
  const mats = useRef({ accent: [], glow: [], accent2: [], lights: [] })
  const cur = useMemo(() => ({ accent: new THREE.Color(START.accent), glow: new THREE.Color(START.glow), accent2: new THREE.Color(START.accent2) }), [])
  const want = useMemo(() => new THREE.Color(), [])
  const sim = useRef({ init: false, x: 0, y: 0, yaw: 0, roll: 0, from: null, fireT: 0, shot: 0 })

  // find the recolourable materials once the model has mounted
  useLayoutEffect(() => {
    const m = { accent: [], glow: [], accent2: [], lights: [] }
    const a = new THREE.Color(START.accent)
    const g = new THREE.Color(START.glow)
    const a2 = new THREE.Color(START.accent2)
    model.current?.traverse((o) => {
      if (o.isPointLight && o.color.equals(g)) m.lights.push(o)
      const mat = o.material
      if (!mat) return
      if (mat.isMeshBasicMaterial && mat.color.equals(a)) m.accent.push(mat)
      else if (mat.isMeshBasicMaterial && mat.color.equals(g)) m.glow.push(mat)
      else if (mat.isMeshToonMaterial && mat.emissive?.equals(a2)) m.accent2.push(mat)
    })
    mats.current = m
  }, [])

  // bolts: thin additive capsules from both wingtips
  const boltGeo = useMemo(() => new THREE.CapsuleGeometry(2.2, 30, 2, 8), [])
  const boltMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(START.glow).multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }),
    [],
  )
  const bolts = useRef([])
  const boltState = useMemo(() => Array.from({ length: BOLTS }, () => ({ alive: false, x: 0, y: 0, a: 0, t: 0 })), [])
  const nextBolt = useRef(0)
  const tmpP = useMemo(() => new THREE.Vector3(), [])

  // the dive's trail
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(TRAIL).fill(4), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(TRAIL), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [])
  const trailU = useMemo(() => ({ uPixelRatio: { value: gl.getPixelRatio() } }), [gl])
  const trailMat = useShaderMaterial(launchStarVert, launchStarFrag, trailU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const history = useRef([])

  const fire = (sp, angle) => {
    const m = model.current
    if (!m) return
    const i = sp.shot % 2
    sp.shot++
    tmpP.set(...SHIP_MUZZLES[i]).applyMatrix4(m.matrixWorld)
    const b = boltState[nextBolt.current]
    nextBolt.current = (nextBolt.current + 1) % BOLTS
    b.alive = true
    b.x = tmpP.x
    b.y = tmpP.y
    b.a = angle
    b.t = 0
  }

  useFrame(({ clock }, delta) => {
    const s = state.current
    const dt = Math.min(delta, 0.05)
    const sp = sim.current
    const anchor = s.discs.ship
    if (!anchor || !pos.current) return
    const t = clock.getElapsedTime()
    const reduced = s.reduced
    const px = (s.stacked ? 64 : 92) / UNIT

    // ---- colour: the armed city's light, steel otherwise
    const look = LOOK[s.warp === 'under' || s.warp === 'top' ? s.warp : s.armed === 'under' || s.armed === 'top' ? s.armed : 'none']
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9)
    for (const key of ['accent', 'glow', 'accent2']) {
      cur[key].lerp(want.set(look[key]), k)
      for (const mat of mats.current[key]) {
        if (key === 'accent2') mat.emissive.copy(cur[key])
        else mat.color.copy(cur[key])
      }
    }
    for (const l of mats.current.lights) l.color.copy(cur.glow)
    if (rim.current) rim.current.color.copy(cur.accent)
    boltMat.color.copy(cur.glow).multiplyScalar(2.4)

    // ---- where it sits: the anchor, risen from below during the cold open, leaning with you
    const rise = s.fx.ship
    const restX = anchor.x + (reduced ? 0 : s.leanS * 24)
    // the anchor's centre, nudged up so the engine flames have room above the label
    const restY = anchor.y + anchor.h * 0.12 + (reduced ? 0 : Math.sin(t * 0.9) * 2) - (1 - rise) * (anchor.y + size.height / 2 + 140)
    let yaw = -s.leanS * 0.32
    let roll = s.leanS * 0.55 + (reduced ? 0 : Math.sin(t * 0.7) * 0.06)
    let x = restX
    let y = restY
    let scale = 1
    let th = rise < 1 ? 1 : s.armed === 'play' ? 0.3 : s.armed ? 0.55 : 0.15

    if (s.warp && !reduced) {
      if (!sp.from) sp.from = { x: sp.x, y: sp.y, yaw: sp.yaw }
      const w = s.warpT
      th = 1
      if (s.warp === 'play') {
        // flip nose-down, then drop through the button and off the bottom of the screen
        const f = Math.min(1, w / 0.3)
        yaw = sp.from.yaw + (Math.PI - sp.from.yaw) * (1 - Math.pow(1 - f, 3))
        const e = Math.max(0, (w - 0.25) / 0.75)
        y = sp.from.y - e * e * (sp.from.y + size.height / 2 + 160)
        x = sp.from.x
        roll = 0
        if (w > 0.12 && sp.shot < 2) fire(sp, yaw + Math.PI / 2)
      } else {
        // turn toward the galaxy's core, burn, and dive into it
        const g = s.discs[s.warp]
        const gx = g ? g.x : sp.from.x
        const gy = g ? g.y : sp.from.y
        const aim = Math.atan2(gy - sp.from.y, gx - sp.from.x) - Math.PI / 2
        const f = Math.min(1, w / 0.25)
        yaw = sp.from.yaw + (aim - sp.from.yaw) * (1 - Math.pow(1 - f, 3))
        roll = (aim > 0 ? 1 : -1) * 0.5 * (1 - f * 0.4)
        const e = Math.pow(Math.max(0, (w - 0.25) / 0.75), 2.2)
        x = sp.from.x + (gx - sp.from.x) * e
        y = sp.from.y + (gy - sp.from.y) * e
        scale = 1 - 0.75 * e
      }
    } else {
      sp.from = null
    }

    if (reduced || s.warp || !sp.init) {
      sp.init = true
      sp.x = x
      sp.y = y
      sp.yaw = yaw
      sp.roll = roll
    } else {
      sp.x = ease(sp.x, x, 10, dt)
      sp.y = rise < 1 ? y : ease(sp.y, y, 10, dt)
      sp.yaw = ease(sp.yaw, yaw, 6, dt)
      sp.roll = ease(sp.roll, roll, 6, dt)
    }
    thrust.current = reduced ? 0 : ease(thrust.current, th, 6, dt)

    pos.current.position.set(sp.x, sp.y, 120)
    pos.current.scale.setScalar(px * scale)
    yawG.current.rotation.set(0, 0, Math.PI / 2 + sp.yaw)
    rollG.current.rotation.set(sp.roll, PITCH, 0, 'YXZ') // roll about the nose first, then tip it away

    // ---- bolts while the game is hovered
    if (s.armed === 'play' && !s.warp && !reduced && rise >= 1) {
      sp.fireT -= dt
      if (sp.fireT <= 0) {
        sp.fireT = BURST
        sp.shot = 0
        pos.current.updateMatrixWorld()
        fire(sp, sp.yaw + Math.PI / 2)
        window.setTimeout(() => fire(sp, sim.current.yaw + Math.PI / 2), 70)
      }
    } else if (!s.warp) {
      sp.fireT = 0
      sp.shot = 0
    }
    if (import.meta.env.DEV) s.boltsLive = boltState.filter((b) => b.alive).length // for scripts/shoot.mjs
    for (let i = 0; i < BOLTS; i++) {
      const b = boltState[i]
      const m = bolts.current[i]
      if (b.alive) {
        b.t += dt
        if (b.t > BOLT_LIFE) b.alive = false
      }
      if (!m) continue
      m.visible = b.alive
      if (!b.alive) continue
      const d = BOLT_SPEED * b.t
      m.position.set(b.x + Math.cos(b.a) * d, b.y + Math.sin(b.a) * d, 140)
      m.rotation.set(0, 0, b.a - Math.PI / 2)
      m.scale.setScalar(1 - (b.t / BOLT_LIFE) * 0.4)
    }

    // ---- trail during the dive
    const h = history.current
    if (s.warp && !reduced) {
      const a = sp.yaw + Math.PI / 2
      h.push([sp.x - Math.cos(a) * 30 * scale, sp.y - Math.sin(a) * 30 * scale])
      if (h.length > TRAIL) h.shift()
    } else if (h.length) {
      h.shift()
    }
    const tp = trail.attributes.position.array
    const ta = trail.attributes.aAlpha.array
    for (let i = 0; i < TRAIL; i++) {
      const p = h[i]
      if (p) {
        tp[i * 3] = p[0]
        tp[i * 3 + 1] = p[1]
        tp[i * 3 + 2] = 100
        ta[i] = (i / h.length) * 0.6
      } else {
        ta[i] = 0
      }
    }
    trail.attributes.position.needsUpdate = true
    trail.attributes.aAlpha.needsUpdate = true
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[-300, 400, 500]} intensity={1.5} color="#f2f6ff" />
      <directionalLight ref={rim} position={[0, 200, -300]} intensity={1.2} color={START.accent} />
      <points geometry={trail} material={trailMat} frustumCulled={false} renderOrder={4} />
      <group ref={pos}>
        <group ref={yawG}>
          <group ref={rollG}>
            <group ref={model}>
              <ShipModel accent={START.accent} accent2={START.accent2} glow={START.glow} thrust={getThrust} />
            </group>
          </group>
        </group>
      </group>
      {boltState.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            bolts.current[i] = el
          }}
          geometry={boltGeo}
          material={boltMat}
          visible={false}
          frustumCulled={false}
          renderOrder={6}
        />
      ))}
    </>
  )
}
