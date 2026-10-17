import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../state/store.js'
import { launchStarFrag, launchStarVert } from './shaders.js'
import ShipModel from './ShipModel.jsx'
import { useShaderMaterial } from './useShaderMaterial.js'

const TRAIL = 40
export const SHIP_SCALE = 2.6
const TAIL = 1.9 * SHIP_SCALE // trail starts just behind the nozzles
const thrust = () => sim.thrust

// The visitor's ship. Reads `sim` every frame; never re-renders.
// Nose points along +x in local space; Simulation supplies the heading.
export default function Ship({ world }) {
  const group = useRef()
  const { gl } = useThree()

  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(TRAIL).fill(3.2), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(TRAIL), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  }, [])
  const trailU = useMemo(() => ({ uPixelRatio: { value: gl.getPixelRatio() } }), [gl])
  const trailMat = useShaderMaterial(launchStarVert, launchStarFrag, trailU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const history = useRef([])

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.getElapsedTime()
    group.current.position.set(sim.x, sim.y, 0)
    const speed = Math.hypot(sim.vx, sim.vy)
    group.current.rotation.set(0, 0, sim.angle)
    // bank into turns, plus a slow idle roll so it never looks frozen
    group.current.rotateX(Math.sin(t * 0.7) * 0.06 + THREE.MathUtils.clamp(-sim.turn, -0.7, 0.7))
    // trail
    const h = history.current
    if (speed > 4) {
      h.push([sim.x - Math.cos(sim.angle) * TAIL, sim.y - Math.sin(sim.angle) * TAIL])
      if (h.length > TRAIL) h.shift()
    } else if (h.length && Math.floor(t * 30) % 2 === 0) {
      h.shift()
    }
    const p = trail.attributes.position.array
    const a = trail.attributes.aAlpha.array
    for (let i = 0; i < TRAIL; i++) {
      const pt = h[i]
      if (pt) {
        p[i * 3] = pt[0]
        p[i * 3 + 1] = pt[1]
        p[i * 3 + 2] = -0.3
        a[i] = (i / h.length) * 0.45 * Math.min(1, speed / 20)
      } else {
        a[i] = 0
      }
    }
    trail.attributes.position.needsUpdate = true
    trail.attributes.aAlpha.needsUpdate = true
  })

  return (
    <>
      <points geometry={trail} material={trailMat} frustumCulled={false} renderOrder={4} />
      <group ref={group} scale={SHIP_SCALE}>
        <ShipModel accent={world.accent} accent2={world.accent2} glow={world.glow} thrust={thrust} />
      </group>
    </>
  )
}
