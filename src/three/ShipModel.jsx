import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toonRamp } from './toonRamp.js'

// The ship itself, shared by the galaxies and the shooter. Pure model: no sim reads.
// Local frame: nose along +x, canopy up +z, wings along ±y. Unit scale is about 3.8 long, 3.3 wide.
// `thrust` is a getter (0..1) read every frame for the engine plasma; `cockpit` hides the canopy glass
// so a camera can sit inside the frame.

// cannon muzzles, wingtips, in model space
export const SHIP_MUZZLES = [
  [0.4, 1.6, -0.06],
  [0.4, -1.6, -0.06],
]
// where a first-person camera sits, in model space
export const SHIP_EYE = [0.6, 0, 0.47]

const ENGINES = [0.42, -0.42] // pod offsets in y

function fuselageGeometry(scaleR = 1, from = -1.5) {
  // radius along the axis, tail to nose
  const profile = [
    [0.16, -1.5],
    [0.28, -1.38],
    [0.35, -1.05],
    [0.33, -0.55],
    [0.37, 0.05],
    [0.36, 0.55],
    [0.3, 1.0],
    [0.19, 1.45],
    [0.07, 1.82],
    [0.0, 1.95],
  ].filter(([, y]) => y >= from)
  const pts = profile.map(([r, y]) => new THREE.Vector2(r * scaleR, y))
  const g = new THREE.LatheGeometry(pts, 18)
  g.rotateZ(-Math.PI / 2) // lathe axis y → nose +x
  g.scale(1, 1.12, 0.8) // a little wider than tall
  return g
}

function wingGeometry(side) {
  const s = side
  const shape = new THREE.Shape()
  shape.moveTo(0.35, 0.2 * s)
  shape.lineTo(-0.62, 1.52 * s)
  shape.lineTo(-1.02, 1.6 * s)
  shape.lineTo(-1.05, 1.18 * s)
  shape.lineTo(-1.3, 0.95 * s)
  shape.lineTo(-1.28, 0.2 * s)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.025,
    bevelSegments: 1,
  })
  g.translate(0, 0, -0.03)
  return g
}

function wingPlateGeometry(side) {
  // dark chevron inset on top of each wing
  const s = side
  const shape = new THREE.Shape()
  shape.moveTo(-0.05, 0.42 * s)
  shape.lineTo(-0.62, 1.2 * s)
  shape.lineTo(-0.86, 1.22 * s)
  shape.lineTo(-0.36, 0.42 * s)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false })
  return g
}

function finGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.45, 0)
  shape.lineTo(-1.18, 0.72)
  shape.lineTo(-1.42, 0.74)
  shape.lineTo(-1.36, 0)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
  })
  g.translate(0, 0, -0.02)
  g.rotateX(Math.PI / 2) // shape y → up (+z)
  return g
}

function canardGeometry(side) {
  const s = side
  const shape = new THREE.Shape()
  shape.moveTo(1.12, 0.22 * s)
  shape.lineTo(0.86, 0.62 * s)
  shape.lineTo(0.72, 0.62 * s)
  shape.lineTo(0.8, 0.22 * s)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false })
  g.translate(0, 0, -0.015)
  return g
}

// cone with its base at the origin and its tip at x = -1, so scale.x is the flame length
function flameGeometry(r, seg) {
  const g = new THREE.ConeGeometry(r, 1, seg, 1, true)
  g.rotateZ(Math.PI / 2)
  g.translate(-0.5, 0, 0)
  return g
}

export default function ShipModel({ accent, accent2, glow, thrust, cockpit = false }) {
  const flames = useRef([])
  const light = useRef()
  const beacon = useRef()

  const geo = useMemo(() => {
    const canopy = new THREE.SphereGeometry(0.3, 22, 14)
    canopy.scale(1.4, 0.75, 0.62)
    // canopy frame: two hoops across and a spine along the top
    const hoop = (k) => {
      const g = new THREE.TorusGeometry(0.31, 0.018, 6, 28, Math.PI)
      g.rotateX(Math.PI / 2)
      g.rotateZ(Math.PI / 2) // arc spans y, rises in z
      g.scale(1, 0.75 * k, 0.62 * k)
      return g
    }
    const spine = new THREE.TorusGeometry(1, 0.05, 6, 30, Math.PI)
    spine.rotateX(Math.PI / 2)
    spine.scale(0.43, 1, 0.195)
    const ring = new THREE.TorusGeometry(0.36, 0.022, 6, 26)
    ring.rotateY(Math.PI / 2)
    ring.scale(1, 1.13, 0.81)
    const intake = new THREE.TorusGeometry(0.17, 0.04, 8, 20)
    intake.rotateY(Math.PI / 2)
    const pod = new THREE.CylinderGeometry(0.17, 0.2, 1.05, 16)
    pod.rotateZ(-Math.PI / 2)
    const nozzle = new THREE.CylinderGeometry(0.2, 0.25, 0.32, 16, 1, true)
    nozzle.rotateZ(-Math.PI / 2)
    const core = new THREE.CircleGeometry(0.17, 16)
    core.rotateY(-Math.PI / 2) // faces -x, out the back
    const barrel = new THREE.CylinderGeometry(0.055, 0.065, 1.1, 10)
    barrel.rotateZ(-Math.PI / 2)
    const muzzle = new THREE.CylinderGeometry(0.03, 0.034, 0.3, 8)
    muzzle.rotateZ(-Math.PI / 2)
    const stripe = new THREE.BoxGeometry(1.7, 0.02, 0.05)
    return {
      body: fuselageGeometry(),
      nose: fuselageGeometry(1.03, 1.3),
      canopy,
      hoopMid: hoop(1.06),
      hoopFore: hoop(0.84),
      hoopAft: hoop(0.84),
      spine,
      ring,
      wingR: wingGeometry(-1),
      wingL: wingGeometry(1),
      plateR: wingPlateGeometry(-1),
      plateL: wingPlateGeometry(1),
      fin: finGeometry(),
      canardR: canardGeometry(-1),
      canardL: canardGeometry(1),
      intake,
      pod,
      nozzle,
      core,
      barrel,
      muzzle,
      stripe,
      flameOuter: flameGeometry(0.17, 14),
      flameInner: flameGeometry(0.09, 10),
    }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const th = thrust ? thrust() : 0
    for (let i = 0; i < flames.current.length; i++) {
      const f = flames.current[i]
      if (!f) continue
      const inner = i % 2 === 1
      const flicker = 0.85 + Math.random() * 0.3
      const len = inner ? 0.12 + th * 1.5 * flicker : 0.18 + th * 2.6 * flicker
      const w = inner ? 0.6 + th * 0.35 : 0.65 + th * 0.5
      f.scale.set(len, w, w)
      f.visible = th > 0.03
    }
    if (light.current) light.current.intensity = th * 10
    if (beacon.current) beacon.current.visible = Math.sin(t * 3.1) > 0.55
  })

  const gm = toonRamp()
  const hull = { color: '#d8c9a8', gradientMap: gm }
  const dark = { color: '#43362d', gradientMap: gm }
  const metal = { color: '#8c8175', gradientMap: gm }
  const glass = { color: '#0d1c1a', gradientMap: gm, emissive: accent2, emissiveIntensity: 0.55 }
  const lit = { color: accent, toneMapped: false }
  const plasma = { transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }
  const flameRef = (i) => (el) => {
    flames.current[i] = el
  }

  return (
    <group>
      {/* fuselage, dark nose cap, panel rings, accent stripes down both flanks */}
      <mesh geometry={geo.body}>
        <meshToonMaterial {...hull} />
      </mesh>
      <mesh geometry={geo.nose}>
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh geometry={geo.ring} position={[-0.25, 0, 0]}>
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh geometry={geo.ring} position={[-0.95, 0, 0]} scale={[1, 0.96, 0.96]}>
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh geometry={geo.stripe} position={[-0.05, 0.415, 0.03]}>
        <meshBasicMaterial {...lit} />
      </mesh>
      <mesh geometry={geo.stripe} position={[-0.05, -0.415, 0.03]}>
        <meshBasicMaterial {...lit} />
      </mesh>

      {/* canopy and its frame */}
      {cockpit ? null : (
        <mesh geometry={geo.canopy} position={[0.62, 0, 0.24]}>
          <meshToonMaterial {...glass} />
        </mesh>
      )}
      {cockpit ? null : (
        <mesh geometry={geo.hoopMid} position={[0.62, 0, 0.24]}>
          <meshToonMaterial {...dark} />
        </mesh>
      )}
      <mesh geometry={geo.hoopFore} position={[0.86, 0, 0.24]}>
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh geometry={geo.hoopAft} position={[0.38, 0, 0.24]}>
        <meshToonMaterial {...dark} />
      </mesh>
      {cockpit ? null : (
        <mesh geometry={geo.spine} position={[0.62, 0, 0.24]}>
          <meshToonMaterial {...dark} />
        </mesh>
      )}

      {/* swept cream wings with dark chevrons, a little dihedral */}
      <group position={[0, 0, -0.06]}>
        <mesh geometry={geo.wingL} rotation={[0.07, 0, 0]}>
          <meshToonMaterial {...hull} />
        </mesh>
        <mesh geometry={geo.wingR} rotation={[-0.07, 0, 0]}>
          <meshToonMaterial {...hull} />
        </mesh>
        <mesh geometry={geo.plateL} rotation={[0.07, 0, 0]} position={[0, 0, 0.055]}>
          <meshToonMaterial {...dark} />
        </mesh>
        <mesh geometry={geo.plateR} rotation={[-0.07, 0, 0]} position={[0, 0, 0.055]}>
          <meshToonMaterial {...dark} />
        </mesh>
      </group>
      <mesh geometry={geo.canardL}>
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh geometry={geo.canardR}>
        <meshToonMaterial {...dark} />
      </mesh>

      {/* wingtip cannons */}
      {SHIP_MUZZLES.map((m, i) => (
        <group key={i} position={[0, m[1], m[2]]}>
          <mesh geometry={geo.barrel} position={[-0.5, 0, 0]}>
            <meshToonMaterial {...metal} />
          </mesh>
          <mesh geometry={geo.muzzle} position={[0.2, 0, 0]}>
            <meshToonMaterial {...dark} />
          </mesh>
          <mesh position={[-1.08, 0, 0]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color={m[1] > 0 ? '#ff5a4d' : '#5cff8a'} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* dorsal fin, antenna, beacon */}
      <mesh geometry={geo.fin} position={[0, 0, 0.2]}>
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh position={[-1.32, 0, 1.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 5]} />
        <meshToonMaterial {...metal} />
      </mesh>
      <mesh ref={beacon} position={[-1.32, 0, 1.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial {...lit} />
      </mesh>

      {/* spine greebles and RCS blocks */}
      <mesh position={[-0.05, 0, 0.31]}>
        <boxGeometry args={[0.32, 0.18, 0.06]} />
        <meshToonMaterial {...metal} />
      </mesh>
      <mesh position={[-0.42, 0.09, 0.28]}>
        <boxGeometry args={[0.18, 0.08, 0.05]} />
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh position={[-0.42, -0.09, 0.28]}>
        <boxGeometry args={[0.18, 0.08, 0.05]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {[
        [1.18, 0.29, 0.04],
        [1.18, -0.29, 0.04],
        [-1.2, 0.3, 0.12],
        [-1.2, -0.3, 0.12],
      ].map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.1, 0.07, 0.07]} />
          <meshToonMaterial {...metal} />
        </mesh>
      ))}

      {/* twin engines: pod, intake ring, flared nozzle, a hot core that always glows a little */}
      {ENGINES.map((y, i) => (
        <group key={y} position={[0, y, -0.08]}>
          <mesh geometry={geo.pod} position={[-1.02, 0, 0]}>
            <meshToonMaterial {...metal} />
          </mesh>
          <mesh geometry={geo.intake} position={[-0.49, 0, 0]}>
            <meshToonMaterial {...dark} />
          </mesh>
          <mesh geometry={geo.nozzle} position={[-1.7, 0, 0]}>
            <meshToonMaterial {...dark} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={geo.core} position={[-1.62, 0, 0]}>
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
          <mesh ref={flameRef(i * 2)} geometry={geo.flameOuter} position={[-1.84, 0, 0]}>
            <meshBasicMaterial color={glow} opacity={0.55} {...plasma} />
          </mesh>
          <mesh ref={flameRef(i * 2 + 1)} geometry={geo.flameInner} position={[-1.82, 0, 0]}>
            <meshBasicMaterial color="#fff3dc" opacity={0.9} {...plasma} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} position={[-2.3, 0, 0.3]} color={glow} distance={10} decay={2} intensity={0} />
    </group>
  )
}
