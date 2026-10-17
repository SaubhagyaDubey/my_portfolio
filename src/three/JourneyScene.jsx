import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { CITIES } from '../data/palette.js'
import { JOURNEY, OPEN_AIR } from '../data/journey.js'
import { WORLDS } from '../data/worlds.js'
import { DEPTH, FORK_DEPTH, FOV, LEAVE, TILT, VMAX, dockAt, restPoint, stepJourney } from '../lib/journey.js'
import { mulberry32 } from '../lib/seed.js'
import { fxEnabled, getTier } from '../lib/tier.js'
import { createAir } from './air.js'
import { GALAXY_COUNT, buildGalaxy } from './galaxy.js'
import Planet, { Earth } from './Planet.jsx'
import { GradeEffect } from './post/GradeEffect.js'
import { LensEffect } from './post/LensEffect.js'
import Quasar from './Quasar.jsx'
import ShipModel, { SHIP_EYE } from './ShipModel.jsx'
import {
  backdropFrag,
  flatVert,
  galaxyFrag,
  galaxyHaloFrag,
  galaxyVert,
  launchLineFrag,
  launchLineVert,
  launchStarFrag,
  launchStarVert,
  nebulaFrag,
} from './shaders.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

// The home page's ride, seen from the cockpit: the game's ship and its first-person eye, flying down -z from
// stop to stop (src/lib/journey.js), past one body at each, to two galaxies at the fork. `j` is the ride's
// state ref (createJourney), shared with the page; everything here reads it and nothing re-renders per frame.

// ShipModel's nose is +x with the canopy up +z; here the nose points down -z and up is +y (as in the game)
const BASIS = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)),
)
const EYE = [-SHIP_EYE[1], SHIP_EYE[2], -SHIP_EYE[0]]
const SHIP_LOOK = { accent: '#bcd4f6', accent2: '#a9bdd8', glow: '#e4efff' }
const ease = (cur, want, rate, dt) => cur + (want - cur) * (1 - Math.exp(-rate * dt))

// One clock for the ride. Runs first each frame: steps the state, blends the sky toward the stop ahead,
// and hands the page its tick and any event.
function Director({ j, dwells, live, onTick, onEvent }) {
  useFrame((_, delta) => {
    const s = j.current
    const dt = Math.min(delta, 1 / 20)
    const ev = stepJourney(s, dt, dwells)
    if (ev === 'launch') s.kick = true
    const toStop = (s.phase === 'fly' || s.phase === 'dwell') && s.i < s.n
    live.set(toStop ? JOURNEY[s.i].air : OPEN_AIR, s.reduced)
    live.step(dt)
    if (ev) onEvent(ev)
    onTick()
  })
  return null
}

// Where a fork target is in the world: a galaxy under its measured disc, or straight on for the game.
function forkPoint(s, key, aspect, H) {
  const dock = dockAt(s.n)
  const a = s.anchors?.[key]
  if (!a || key === 'play') return { pos: restPoint(dock, 0, 0.1, 1400, aspect, EYE), scale: 1 }
  const tan = Math.tan((FOV * Math.PI) / 360)
  const nx = a.x / (H / 2) / aspect
  const ny = a.y / (H / 2)
  const wpp = (2 * FORK_DEPTH * tan) / H
  return { pos: restPoint(dock, nx, ny, FORK_DEPTH, aspect, EYE), scale: a.r * wpp }
}

// The ship and the pilot's eye. The ship flies the ride; the eye sits in its canopy and glances toward the
// pointer. Picking a way out at the fork turns the ship toward it and floors it.
function Rig({ j }) {
  const { camera, size } = useThree()
  const rig = useRef()
  const thrust = useRef(0.1)
  const getThrust = useMemo(() => () => thrust.current, [])
  const head = useRef({ yaw: 0, pitch: 0, kick: 0, fov: FOV })
  const out = useRef(null)
  const v = useMemo(() => ({ eye: new THREE.Vector3(), prev: new THREE.Vector3(), first: true }), [])

  useEffect(() => {
    camera.near = 0.05
    camera.far = 6000
    camera.fov = FOV
    camera.updateProjectionMatrix()
  }, [camera])

  useFrame(({ clock }, delta) => {
    const s = j.current
    const g = rig.current
    if (!g) return
    const dt = Math.min(delta, 1 / 20)
    const t = clock.elapsedTime
    const calm = s.reduced
    const h = head.current
    let x = 0
    let y = 0
    let z = -s.d
    let yaw = 0
    let pitch = 0
    let roll = 0
    if (!calm) {
      x += Math.sin(t * 0.37) * 0.3
      y += Math.sin(t * 0.53 + 1) * 0.2
      roll += Math.sin(t * 0.21) * 0.015
    }

    let leaveFov = 0
    if (s.phase === 'leave') {
      if (!out.current) {
        const p = forkPoint(s, s.leaveKey, size.width / size.height, size.height).pos
        const dx = p[0]
        const dy = p[1] - EYE[1]
        const dz = p[2] + dockAt(s.n) - EYE[2]
        out.current = { dx, dy, dz, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
      }
      const o = out.current
      const k = Math.min(1, s.t / LEAVE)
      const turn = calm ? 1 : THREE.MathUtils.smootherstep(k, 0, 0.55)
      const go = k * k * k * 0.9
      x += o.dx * go
      y += o.dy * go
      z += o.dz * go
      yaw = o.yaw * turn
      pitch = o.pitch * turn
      roll -= o.yaw * turn * 0.5
      leaveFov = k * k * 34
    } else out.current = null

    g.position.set(x, y, z)
    g.rotation.set(pitch, yaw, roll, 'YXZ')
    g.updateMatrixWorld()

    // the rig's own velocity, for the dust's streaks (the camera shake below stays out of it)
    if (v.first) v.prev.copy(g.position)
    v.first = false
    const vel = s.vel ?? (s.vel = { x: 0, y: 0, z: 0 })
    vel.x = (g.position.x - v.prev.x) / Math.max(dt, 1e-3)
    vel.y = (g.position.y - v.prev.y) / Math.max(dt, 1e-3)
    vel.z = (g.position.z - v.prev.z) / Math.max(dt, 1e-3)
    v.prev.copy(g.position)

    // the pilot glances toward the pointer, a few degrees at most
    const look = s.pointer && !calm && s.phase !== 'leave'
    h.yaw = ease(h.yaw, look ? -(s.mouse.x - 0.5) * 0.12 : 0, 3, dt)
    h.pitch = ease(h.pitch, look ? -(s.mouse.y - 0.5) * 0.08 : 0, 3, dt)

    camera.position.set(EYE[0], EYE[1], EYE[2]).applyMatrix4(g.matrixWorld)
    camera.quaternion.copy(g.quaternion)
    camera.rotateY(h.yaw)
    camera.rotateX(TILT + h.pitch)

    // the engines spool while you hold, kick on take-off, settle when stopped
    if (s.kick) {
      h.kick = 1
      s.kick = false
    }
    h.kick = Math.max(0, h.kick - dt * 2.2)
    const shake = calm ? 0 : s.charge * s.charge * 0.012 * (s.phase === 'ready' ? 1 : 0) + h.kick * h.kick * 0.05
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
    }
    const want =
      s.phase === 'ready'
        ? 0.1 + s.charge * 0.7
        : s.phase === 'fly' || s.phase === 'leave'
          ? 0.3 + Math.min(1.5, s.speed) * 0.5
          : 0.12
    thrust.current = calm ? 0.12 : ease(thrust.current, want, 6, dt)

    const fov = FOV + (calm ? 0 : Math.min(3, s.speed) * 9 + h.kick * 4 + leaveFov)
    h.fov = calm ? fov : ease(h.fov, fov, 5, dt)
    if (Math.abs(camera.fov - h.fov) > 0.02) {
      camera.fov = h.fov
      camera.updateProjectionMatrix()
    }
  })

  return (
    <group ref={rig}>
      <group quaternion={BASIS}>
        <ShipModel accent={SHIP_LOOK.accent} accent2={SHIP_LOOK.accent2} glow={SHIP_LOOK.glow} thrust={getThrust} cockpit />
      </group>
    </group>
  )
}

// Dust around the flight line: dots at rest, streaks at speed. Fixed in the world and wrapped around the eye.
const SPAN = 900
function Dust({ j }) {
  const { gl } = useThree()
  const N = getTier() === 0 ? 360 : 720
  const dots = useMemo(() => {
    const rand = mulberry32(23)
    return Array.from({ length: N }, () => {
      const a = rand() * Math.PI * 2
      const r = 7 + Math.pow(rand(), 0.8) * 150
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, z: -rand() * SPAN, b: 0.3 + rand() * 0.7 }
    })
  }, [N])
  const pointGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7)
    return g
  }, [N])
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N * 2), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7)
    return g
  }, [N])
  useEffect(
    () => () => {
      pointGeo.dispose()
      lineGeo.dispose()
    },
    [pointGeo, lineGeo],
  )
  const pointU = useMemo(() => ({ uPixelRatio: { value: gl.getPixelRatio() } }), [gl])
  const pointMat = useShaderMaterial(launchStarVert, launchStarFrag, pointU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const lineU = useMemo(() => ({ uPull: { value: 0 } }), [])
  const lineMat = useShaderMaterial(launchLineVert, launchLineFrag, lineU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })

  useFrame(({ camera }) => {
    const s = j.current
    const vel = s.vel ?? { x: 0, y: 0, z: 0 }
    const sp = Math.hypot(vel.x, vel.y, vel.z)
    const pull = s.reduced ? 0 : Math.min(1, (sp / VMAX) * 1.6)
    lineU.uPull.value = pull
    // a streak is where the dot was a moment ago, seen from here: ahead along the way we're going
    const exp = Math.min(0.09, 0.05 + pull * 0.04)
    const cz = camera.position.z
    const pp = pointGeo.attributes.position.array
    const ps = pointGeo.attributes.aSize.array
    const pa = pointGeo.attributes.aAlpha.array
    const lp = lineGeo.attributes.position.array
    const la = lineGeo.attributes.aAlpha.array
    for (let i = 0; i < N; i++) {
      const p = dots[i]
      if (p.z > cz + 10) p.z -= SPAN
      else if (p.z < cz + 10 - SPAN) p.z += SPAN
      const ahead = cz - p.z
      const fade = THREE.MathUtils.smoothstep(SPAN - ahead, 0, 160)
      pp[i * 3] = p.x
      pp[i * 3 + 1] = p.y
      pp[i * 3 + 2] = p.z
      ps[i] = 1.1 + p.b * 2
      pa[i] = (0.25 + p.b * 0.55) * (1 - pull * 0.75) * fade
      const len = Math.min(1, p.b + 0.2) * exp
      lp[i * 6] = p.x
      lp[i * 6 + 1] = p.y
      lp[i * 6 + 2] = p.z
      lp[i * 6 + 3] = p.x + vel.x * len
      lp[i * 6 + 4] = p.y + vel.y * len
      lp[i * 6 + 5] = p.z + vel.z * len
      la[i * 2] = 0.7 * p.b * fade
      la[i * 2 + 1] = 0
    }
    pointGeo.attributes.position.needsUpdate = true
    pointGeo.attributes.aSize.needsUpdate = true
    pointGeo.attributes.aAlpha.needsUpdate = true
    lineGeo.attributes.position.needsUpdate = true
    lineGeo.attributes.aAlpha.needsUpdate = true
  })

  return (
    <>
      <points geometry={pointGeo} material={pointMat} frustumCulled={false} />
      <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
    </>
  )
}

// The far sky: a painted backdrop that turns with the eye, and two nebulae and a star sheet that travel with
// the ship but stay put when it turns. All of it takes the live air.
function Far({ live, j }) {
  const { gl } = useThree()
  const backdrop = useRef()
  const far = useRef()
  const stars = useMemo(() => {
    const rand = mulberry32(77)
    const n = 1400
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const alpha = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 7000
      pos[i * 3 + 1] = (rand() - 0.5) * 4400
      pos[i * 3 + 2] = -1150 - rand() * 250
      size[i] = 1.1 + Math.pow(rand(), 4) * 3.6
      alpha[i] = 0.2 + rand() * 0.6
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    return g
  }, [])
  useEffect(() => () => stars.dispose(), [stars])
  const starU = useMemo(() => ({ uPixelRatio: { value: gl.getPixelRatio() } }), [gl])
  const starMat = useShaderMaterial(launchStarVert, launchStarFrag, starU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const skyU = useMemo(
    () => ({
      uTime: { value: 0 },
      uOffset: { value: new THREE.Vector2() },
      uSky0: { value: live.live.sky0.clone() },
      uSky1: { value: live.live.sky1.clone() },
      uSmog: { value: live.live.smog.clone() },
      uMode: { value: 1 },
    }),
    [live],
  )
  const sky = useShaderMaterial(flatVert, backdropFrag, skyU, { depthWrite: false })
  const nebU = useMemo(
    () => [
      { uTime: { value: 0 }, uSeed: { value: 3 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uDensity: { value: 0.2 }, uCore: { value: 0 } },
      { uTime: { value: 4 }, uSeed: { value: 7 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uDensity: { value: 0.14 }, uCore: { value: 0 } },
    ],
    [],
  )
  const neb0 = useShaderMaterial(flatVert, nebulaFrag, nebU[0], { transparent: true, depthWrite: false })
  const neb1 = useShaderMaterial(flatVert, nebulaFrag, nebU[1], { transparent: true, depthWrite: false })
  const glow = useMemo(() => new THREE.Color(), [])

  useFrame(({ camera, clock }, delta) => {
    const s = j.current
    const dt = Math.min(delta, 1 / 20)
    const a = live.live
    skyU.uTime.value = s.reduced ? 0 : clock.elapsedTime
    skyU.uSky0.value.copy(a.sky0)
    skyU.uSky1.value.copy(a.sky1)
    skyU.uSmog.value.copy(a.smog)
    // the haze drifts a little as you travel, so the sky isn't painted on the glass
    skyU.uOffset.value.set(camera.position.x * 0.00008, camera.position.y * 0.00008 - camera.position.z * 0.000012)
    // the paint stays in the sky's own darks and mids, so the card in front of it reads
    glow.copy(a.mid).multiplyScalar(0.7)
    nebU[0].uA.value.copy(a.sky1)
    nebU[0].uB.value.copy(glow)
    nebU[1].uA.value.copy(a.sky0)
    nebU[1].uB.value.copy(a.smog)
    if (!s.reduced) {
      nebU[0].uTime.value += dt
      nebU[1].uTime.value += dt
    }
    if (backdrop.current) {
      backdrop.current.position.copy(camera.position)
      backdrop.current.quaternion.copy(camera.quaternion)
    }
    // very far away: follows the ship along the way, barely across it
    if (far.current) far.current.position.set(camera.position.x * 0.92, camera.position.y * 0.92, camera.position.z)
  })

  return (
    <>
      <group ref={backdrop}>
        <mesh material={sky} position={[0, 0, -1400]} renderOrder={-10} frustumCulled={false}>
          <planeGeometry args={[8000, 4400]} />
        </mesh>
      </group>
      <group ref={far}>
        <mesh material={neb0} position={[-480, 200, -1250]} rotation={[0, 0, 0.4]} renderOrder={-9} frustumCulled={false}>
          <planeGeometry args={[1300, 1300]} />
        </mesh>
        <mesh material={neb1} position={[620, -260, -1300]} rotation={[0, 0, -0.8]} renderOrder={-9} frustumCulled={false}>
          <planeGeometry args={[1500, 1500]} />
        </mesh>
        <points geometry={stars} material={starMat} renderOrder={-8} frustumCulled={false} />
      </group>
    </>
  )
}

// The thing outside the canopy at each stop, placed so the docked pilot sees it where the stop asks. Each one
// is only out there for its own leg: it grows out of the dark as you set off toward it, stays while you're
// stopped, and is gone once you've flown past it. Before take-off the canopy is empty.
function Bodies({ j, reduced }) {
  const { size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const holders = useRef([])
  const placed = useMemo(() => {
    const tan = Math.tan((FOV * Math.PI) / 360)
    return JOURNEY.map((st, i) => {
      const b = st.body
      const src = WORLDS[b.world].stops.find((x) => x.id === b.stop)
      const [x, y, z] = restPoint(dockAt(i), b.at[0], b.at[1], DEPTH, aspect, EYE)
      // on a tall screen a body keeps to the narrow width instead of the height
      const r = b.size * DEPTH * tan * Math.min(1, aspect * 1.25)
      return { id: st.id, kind: b.kind, world: WORLDS[b.world], stop: { ...src, pos: [0, 0], r }, at: [x, y, z], key: `${st.id}-${Math.round(r * 4)}` }
    })
  }, [aspect])

  useFrame(() => {
    const s = j.current
    const going = s.phase === 'fly' || s.phase === 'dwell'
    for (let k = 0; k < placed.length; k++) {
      const g = holders.current[k]
      if (!g) continue
      // its own leg and stop, and the start of the next leg while you pass it
      const own = going && s.i === k
      const passing = s.phase === 'fly' && s.i === k + 1
      g.visible = own || passing
      if (!g.visible) continue
      const grow = own && s.phase === 'fly' && !s.reduced ? THREE.MathUtils.smoothstep(s.u, 0, 0.45) : 1
      g.scale.setScalar(Math.max(0.001, grow))
    }
  })

  return placed.map((p, k) => (
    <group
      key={p.key}
      position={p.at}
      visible={false}
      ref={(el) => {
        holders.current[k] = el
      }}
    >
      {p.kind === 'earth' ? (
        <Suspense fallback={null}>
          <Earth stop={p.stop} light={p.world.sun} world={p.world} />
        </Suspense>
      ) : p.kind === 'quasar' ? (
        <Quasar stop={p.stop} world={p.world} reduced={reduced} />
      ) : (
        <Planet stop={p.stop} light={p.world.sun} world={p.world} />
      )}
    </group>
  ))
}

// One city's galaxy at the fork, under the page's measured disc for it. It brightens while you point at its
// side, and glows hot as you head into it.
function ForkGalaxy({ id, j }) {
  const { gl, size } = useThree()
  const city = CITIES[id]
  const geometry = useMemo(() => {
    const { pos, size: sz, col, phase, radius } = buildGalaxy(id, GALAXY_COUNT[getTier()])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aR', new THREE.BufferAttribute(radius, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7)
    return g
  }, [id])
  useEffect(() => () => geometry.dispose(), [geometry])
  const dir = id === 'under' ? 1 : -1
  const uniforms = useMemo(
    () => ({
      uSpin: { value: id === 'under' ? 0.4 : 1.9 },
      uSpinDir: { value: dir },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uScale: { value: 1 },
      uBirth: { value: 1 },
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl, id, dir],
  )
  const material = useShaderMaterial(galaxyVert, galaxyFrag, uniforms, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const haloU = useMemo(() => ({ uColor: { value: color(city.accent) }, uGlow: { value: 0 }, uBirth: { value: 1 } }), [city])
  const halo = useShaderMaterial(flatVert, galaxyHaloFrag, haloU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const group = useRef()

  useFrame(({ clock }, delta) => {
    const s = j.current
    const g = group.current
    if (!g) return
    // out there only at the end: it unwinds from its core over the last leg
    const there = s.phase === 'fork' || s.phase === 'leave'
    const arriving = s.phase === 'fly' && s.i === s.n
    g.visible = Boolean(s.anchors?.[id]) && (there || arriving)
    if (!g.visible) return
    const birth = there || s.reduced ? 1 : THREE.MathUtils.smoothstep(s.u, 0.15, 0.85)
    uniforms.uBirth.value = birth
    haloU.uBirth.value = birth
    const dt = Math.min(delta, 1 / 20)
    const at = forkPoint(s, id, size.width / Math.max(1, size.height), size.height)
    g.position.set(at.pos[0], at.pos[1], at.pos[2])
    g.scale.setScalar(at.scale)
    const picked = s.leaveKey === id
    const want = picked ? 1.4 : s.leaveKey ? 0 : s.hover === id ? 1 : s.hover ? 0.1 : 0.35
    const glow = s.reduced ? want : ease(uniforms.uGlow.value, want, 5, dt)
    uniforms.uGlow.value = glow
    haloU.uGlow.value = glow
    if (!s.reduced) uniforms.uSpin.value += dt * (0.04 + glow * 0.1) * dir
    uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <group ref={group}>
      <mesh material={halo} renderOrder={1} scale={3}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
    </group>
  )
}

function Light({ live }) {
  const bg = useRef()
  const ambient = useRef()
  useFrame(() => {
    bg.current?.copy(live.live.sky0)
    ambient.current?.color.copy(live.live.ambient)
  })
  return (
    <>
      <color ref={bg} attach="background" args={[OPEN_AIR.sky[0]]} />
      <ambientLight ref={ambient} intensity={0.6} />
      <directionalLight position={[-0.5, 1, 0.8]} intensity={1.5} color="#f2f6ff" />
      <directionalLight position={[0.6, -0.3, -1]} intensity={0.5} color="#9fb4d8" />
    </>
  )
}

// Bloom, the grade (its split tone follows the live air) and the lens. No ink: a clean frame at speed, like the game.
function JourneyEffects({ live }) {
  const tier = getTier()
  const grade = useMemo(() => new GradeEffect({ a: OPEN_AIR.grade, b: OPEN_AIR.grade, mix: 0, vignette: 0.55 }), [])
  const lens = useMemo(() => new LensEffect({ ca: tier === 0 ? 0 : 0.004 }), [tier])
  useEffect(
    () => () => {
      grade.dispose()
      lens.dispose()
    },
    [grade, lens],
  )
  useFrame(() => {
    grade.uniforms.get('uShadowA').value.copy(live.live.shadow)
    grade.uniforms.get('uMidA').value.copy(live.live.mid)
    grade.uniforms.get('uHighA').value.copy(live.live.high)
  })
  return (
    <EffectComposer multisampling={tier === 0 ? 0 : 4}>
      <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.58} luminanceSmoothing={0.35} radius={0.8} resolutionScale={tier === 0 ? 0.35 : 0.5} />
      <primitive object={grade} dispose={null} />
      <primitive object={lens} dispose={null} />
    </EffectComposer>
  )
}

export default function JourneyScene({ j, dwells, onTick, onEvent }) {
  const live = useMemo(() => createAir(OPEN_AIR), [])
  const reduced = j.current.reduced
  return (
    <>
      <Director j={j} dwells={dwells} live={live} onTick={onTick} onEvent={onEvent} />
      <Light live={live} />
      <Far live={live} j={j} />
      <Bodies j={j} reduced={reduced} />
      <ForkGalaxy id="under" j={j} />
      <ForkGalaxy id="top" j={j} />
      <Dust j={j} />
      <Rig j={j} />
      {fxEnabled() ? <JourneyEffects live={live} /> : null}
    </>
  )
}
