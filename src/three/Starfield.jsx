import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../lib/seed.js'
import { backdropFrag, flatVert, starsFrag, starsVert } from './shaders.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

// Star colour by rough temperature: cool orange through white to blue-white.
function starColor(rand) {
  const t = rand()
  if (t < 0.12) return [1.0, 0.72, 0.5]
  if (t < 0.3) return [1.0, 0.88, 0.72]
  if (t < 0.78) return [0.96, 0.94, 0.9]
  if (t < 0.94) return [0.82, 0.88, 1.0]
  return [0.68, 0.78, 1.0]
}

function useStarLayer({ count, period, zRange, sizeRange, brightness, twinkle, seed, tint }) {
  const { gl } = useThree()
  const geometry = useMemo(() => {
    const rand = mulberry32(seed)
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const col = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * period[0]
      pos[i * 3 + 1] = (rand() - 0.5) * period[1]
      pos[i * 3 + 2] = zRange[0] + rand() * (zRange[1] - zRange[0])
      // many faint, few bright
      const m = Math.pow(rand(), 3.2)
      size[i] = sizeRange[0] + m * (sizeRange[1] - sizeRange[0])
      const c = starColor(rand)
      // lean 30% toward the city's star tint
      for (let k = 0; k < 3; k++) c[k] = c[k] * 0.7 + tint[k] * 0.3
      const b = brightness * (0.35 + m * 0.65)
      col[i * 3] = c[0] * b
      col[i * 3 + 1] = c[1] * b
      col[i * 3 + 2] = c[2] * b
      phase[i] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    // wrapped around the camera in the shader, so never cull
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uPeriod: { value: new THREE.Vector2(period[0], period[1]) },
      uPixelRatio: { value: gl.getPixelRatio() },
      uTwinkle: { value: twinkle },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(starsVert, starsFrag, uniforms, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return { geometry, material, uniforms }
}

export default function Starfield({ world, reduced = false }) {
  const tc = new THREE.Color(world.starTint)
  const tint = [tc.r, tc.g, tc.b]
  const far = useStarLayer({
    count: 2600,
    period: [1400, 900],
    zRange: [-520, -150],
    sizeRange: [1.2, 5.2],
    brightness: 1.0,
    twinkle: reduced ? 0 : 1,
    seed: 11,
    tint,
  })
  const dust = useStarLayer({
    count: 260,
    period: [240, 160],
    zRange: [-70, 26],
    sizeRange: [0.5, 1.3],
    brightness: 0.35,
    twinkle: 0,
    seed: 23,
    tint,
  })
  const backdropU = useMemo(
    () => ({
      uTime: { value: 0 },
      uOffset: { value: new THREE.Vector2() },
      uTint: { value: color(world.accent2) },
      uSky0: { value: color(world.sky[0]) },
      uSky1: { value: color(world.sky[1]) },
      uSmog: { value: color(world.smog) },
      uMode: { value: world.key === 'top' ? 1 : 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const backdrop = useShaderMaterial(flatVert, backdropFrag, backdropU, { depthWrite: false })
  const backdropRef = useRef()

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime()
    far.uniforms.uTime.value = t
    far.uniforms.uCam.value.set(camera.position.x, camera.position.y)
    dust.uniforms.uCam.value.set(camera.position.x, camera.position.y)
    backdropU.uTime.value = t
    backdropU.uOffset.value.set(camera.position.x * 0.00012, camera.position.y * 0.00012)
    if (backdropRef.current) backdropRef.current.position.set(camera.position.x, camera.position.y, -650)
  })

  return (
    <group>
      <mesh ref={backdropRef} material={backdrop} renderOrder={-10} frustumCulled={false}>
        <planeGeometry args={[3000, 1900]} />
      </mesh>
      <points geometry={far.geometry} material={far.material} frustumCulled={false} renderOrder={-9} />
      <points geometry={dust.geometry} material={dust.material} frustumCulled={false} renderOrder={5} />
    </group>
  )
}
