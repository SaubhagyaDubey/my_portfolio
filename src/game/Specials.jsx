import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useShaderMaterial } from '../three/useShaderMaterial.js'
import { LANCE, SHIELD_R, SPECIALS } from './specials.js'
import { MAX_MISSILES, SPAWN_Z, game, useGame } from './state.js'

const dummy = new THREE.Object3D()
const FWD = new THREE.Vector3(0, 0, 1)
const dir = new THREE.Vector3()
const hotColor = (hex, k) => new THREE.Color(hex).multiplyScalar(k)
const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }

// Nova: two rings of light running down the lane from where it was fired, widening as they go.
function Nova() {
  const group = useRef()
  const inner = useRef()
  const outer = useRef()
  useFrame(() => {
    const n = game.nova
    const g = group.current
    if (!g) return
    g.visible = n.t >= 0
    if (!g.visible) return
    const k = Math.min(1, n.z / (SPAWN_Z - 40))
    g.position.set(n.x * (1 - k), n.y * (1 - k), n.z)
    inner.current.scale.setScalar(5 + k * 30)
    outer.current.scale.setScalar(8 + k * 46)
    inner.current.material.opacity = 1 - k * 0.8
    outer.current.material.opacity = 0.45 * (1 - k)
  })
  return (
    <group ref={group} visible={false}>
      <mesh ref={inner}>
        <torusGeometry args={[1, 0.07, 8, 72]} />
        <meshBasicMaterial color={hotColor(SPECIALS.nova.color, 2.4)} {...additive} />
      </mesh>
      <mesh ref={outer}>
        <torusGeometry args={[1, 0.12, 8, 72]} />
        <meshBasicMaterial color={hotColor(SPECIALS.lance.color, 1.4)} {...additive} />
      </mesh>
    </group>
  )
}

// Lance: a white core inside a coloured sheath, from the nose to far down the lane. It fades in fast,
// shimmers while it burns and thins out over its last quarter second. From the cockpit it starts a little
// way out, so it doesn't fill the canopy.
function Lance() {
  const group = useRef()
  const core = useRef()
  const sheath = useRef()
  // thin at the nose (+z end after the turn), full width far down the lane
  const geo = useMemo(() => new THREE.CylinderGeometry(0.25, 1, 1, 14, 1, true).rotateX(Math.PI / 2), [])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(({ clock }) => {
    const l = game.lance
    const g = group.current
    if (!g) return
    g.visible = l.t > 0
    if (!g.visible) return
    const p = game.player
    const fade = Math.min(1, (LANCE.time - l.t) / 0.08) * Math.min(1, l.t / 0.25)
    const w = fade * (1 + Math.sin(clock.elapsedTime * 50) * 0.08)
    const from = useGame.getState().cam === 'cockpit' ? 12 : 2
    const len = LANCE.len - from
    g.position.set(p.x, p.y, -from - len / 2)
    core.current.scale.set(0.32 * w, 0.32 * w, len)
    sheath.current.scale.set(LANCE.r * w, LANCE.r * w, len)
    sheath.current.material.opacity = 0.3 * fade
  })
  return (
    <group ref={group} visible={false}>
      <mesh ref={core} geometry={geo}>
        <meshBasicMaterial color={hotColor('#ffffff', 3)} {...additive} />
      </mesh>
      <mesh ref={sheath} geometry={geo}>
        <meshBasicMaterial color={hotColor(SPECIALS.lance.color, 1.8)} {...additive} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// Swarm: small hot darts pointed along their flight. The sparks behind them come from GameLoop's bursts.
function Missiles() {
  const mesh = useRef()
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.16, 1.1, 3, 6).rotateX(Math.PI / 2), [])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(() => {
    const m0 = mesh.current
    if (!m0) return
    let n = 0
    for (const m of game.missiles) {
      if (!m.on) continue
      dummy.position.set(m.x, m.y, m.z)
      dir.set(m.vx, m.vy, m.vz).normalize()
      dummy.quaternion.setFromUnitVectors(FWD, dir)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      m0.setMatrixAt(n++, dummy.matrix)
    }
    m0.count = n
    m0.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, MAX_MISSILES]} frustumCulled={false}>
      <meshBasicMaterial color={hotColor(SPECIALS.swarm.color, 2.6)} toneMapped={false} />
    </instancedMesh>
  )
}

const shieldVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`
// flat painted bands of rim light rather than a smooth fresnel, like the galaxies' light FX
const shieldFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float a = step(0.62, f) * 0.16 + step(0.86, f) * 0.6;
  gl_FragColor = vec4(uColor * a * uAlpha, a * uAlpha);
}
`

// Shield: a bubble around the ship while it holds, bursting outward when it eats a hit. Not drawn from the
// cockpit, where the camera would sit inside it; the HUD says it's there.
function Shield() {
  const mesh = useRef()
  const cockpit = useGame((s) => s.cam === 'cockpit')
  const uniforms = useMemo(() => ({ uColor: { value: hotColor(SPECIALS.shield.color, 1.6) }, uAlpha: { value: 1 } }), [])
  const material = useShaderMaterial(shieldVert, shieldFrag, uniforms, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const p = game.player
    const pop = game.shieldPop / 0.4
    m.visible = !cockpit && p.alive && (p.shield > 0 || pop > 0)
    if (!m.visible) return
    m.position.set(p.x, p.y, -0.2)
    if (p.shield > 0) {
      m.scale.set(SHIELD_R * 1.2, SHIELD_R * 0.75, SHIELD_R * 1.1)
      uniforms.uAlpha.value = 0.8 + Math.sin(clock.elapsedTime * 3) * 0.12
    } else {
      m.scale.set(SHIELD_R * (1.2 + (1 - pop) * 0.9), SHIELD_R * (0.75 + (1 - pop) * 0.9), SHIELD_R * (1.1 + (1 - pop) * 0.9))
      uniforms.uAlpha.value = pop
    }
  })
  return (
    <mesh ref={mesh} material={material} visible={false}>
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  )
}

export default function Specials() {
  return (
    <>
      <Nova />
      <Lance />
      <Missiles />
      <Shield />
    </>
  )
}
