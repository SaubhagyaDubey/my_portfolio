import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../lib/seed.js'
import { cometFrag, cometVert, coronaFrag, flatVert, planetFrag, sphereVert } from './shaders.js'
import { fxStep } from './toonRamp.js'
import { color, useShaderMaterial, vec3 } from './useShaderMaterial.js'

// An icy nucleus with a coma and two particle tails pointing away from the light.
export default function Comet({ stop, light, world, reduced }) {
  const { pos, r } = stop
  const { gl } = useThree()
  const dir = useMemo(() => {
    const v = new THREE.Vector2(-light[0], -light[1])
    return v.lengthSq() > 0 ? v.normalize() : v.set(1, 0)
  }, [light])

  const nucleusU = useMemo(
    () => ({
      uLight: { value: vec3(light) },
      uTime: { value: 0 },
      uSeed: { value: 4.2 },
      uFreq: { value: 4.5 },
      uKind: { value: 2 },
      uC0: { value: color('#4f6b66') },
      uC1: { value: color('#9fb8ae') },
      uC2: { value: color('#dfeee4') },
      uC3: { value: color('#f6fff8') },
      uAtmo: { value: color(world.glow) },
      uRim: { value: color(world.accent) },
      uRimW: { value: 0.2 },
      uHatch: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const nucleus = useShaderMaterial(sphereVert, planetFrag, nucleusU)

  const comaU = useMemo(
    () => ({ uTime: { value: 0 }, uStep: { value: fxStep(reduced) }, uColor: { value: color(world.accent) }, uSeed: { value: 2.2 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const coma = useShaderMaterial(flatVert, coronaFrag, comaU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const count = 900
  const geometry = useMemo(() => {
    const rand = mulberry32(77)
    const p = new Float32Array(count * 3)
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      a[i * 3] = rand()
      a[i * 3 + 1] = rand()
      a[i * 3 + 2] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(a, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
    return g
  }, [])
  const tailU = useMemo(
    () => ({
      uTime: { value: 0 },
      uLen: { value: r * 16 },
      uDir: { value: dir },
      uPixelRatio: { value: gl.getPixelRatio() },
      uIon: { value: color(world.accent) },
      uDust: { value: color('#ffc4e2') },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const tail = useShaderMaterial(cometVert, cometFrag, tailU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const group = useRef()
  const body = useRef()
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    nucleusU.uTime.value = t
    comaU.uTime.value = t
    tailU.uTime.value = t
    if (group.current) {
      // a slow drift so it never sits perfectly still
      group.current.position.set(pos[0] + Math.sin(t * 0.21) * 1.6, pos[1] + Math.cos(t * 0.17) * 1.1, 0)
    }
    if (body.current) {
      body.current.rotation.y += dt * 0.5
      body.current.rotation.x += dt * 0.2
    }
  })

  return (
    <group ref={group} position={[pos[0], pos[1], 0]}>
      <mesh ref={body} material={nucleus}>
        <sphereGeometry args={[r * 0.55, 32, 24]} />
      </mesh>
      <mesh material={coma} renderOrder={3}>
        <planeGeometry args={[r * 5, r * 5]} />
      </mesh>
      <points geometry={geometry} material={tail} frustumCulled={false} renderOrder={3} />
    </group>
  )
}
