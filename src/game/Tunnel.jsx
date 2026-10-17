import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getTier } from '../lib/tier.js'
import { mulberry32 } from '../lib/seed.js'
import { backdropFrag, flatVert, launchLineFrag, launchLineVert, launchStarFrag, launchStarVert, nebulaFrag } from '../three/shaders.js'
import { useShaderMaterial } from '../three/useShaderMaterial.js'
import { pal } from './lanes.js'
import { game } from './state.js'

const NEAR = 20
const FAR = -560

// Speed streaks rushing past, a far star sheet, two painted nebulae and the lane's sky behind it all.
// The sky and nebulae copy the lane's live colours every frame; the city only picks smog bands or haze.
export default function Tunnel({ cityKey }) {
  const { gl } = useThree()
  const N = getTier() === 0 ? 320 : 640
  const streaks = useMemo(() => {
    const rand = mulberry32(41)
    return Array.from({ length: N }, () => {
      const a = rand() * Math.PI * 2
      const r = 9 + Math.pow(rand(), 0.7) * 110
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75, z: FAR + rand() * (NEAR - FAR), b: 0.3 + rand() * 0.7 }
    })
  }, [N])
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N * 2), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  }, [N])
  const lineU = useMemo(() => ({ uPull: { value: 1 } }), [])
  const lineMat = useShaderMaterial(launchLineVert, launchLineFrag, lineU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })

  const starGeo = useMemo(() => {
    const rand = mulberry32(77)
    const n = 900
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const alpha = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 2600
      pos[i * 3 + 1] = (rand() - 0.5) * 1500
      pos[i * 3 + 2] = -1100 - rand() * 200
      size[i] = 1.2 + Math.pow(rand(), 4) * 4
      alpha[i] = 0.25 + rand() * 0.6
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    return g
  }, [])
  const starU = useMemo(() => ({ uPixelRatio: { value: gl.getPixelRatio() } }), [gl])
  const starMat = useShaderMaterial(launchStarVert, launchStarFrag, starU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })

  const skyU = useMemo(
    () => ({
      uTime: { value: 0 },
      uOffset: { value: new THREE.Vector2() },
      uTint: { value: pal.star.clone() },
      uSky0: { value: pal.sky0.clone() },
      uSky1: { value: pal.sky1.clone() },
      uSmog: { value: pal.smog.clone() },
      uMode: { value: cityKey === 'top' ? 1 : 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const sky = useShaderMaterial(flatVert, backdropFrag, skyU, { depthWrite: false })
  const nebU = useMemo(
    () => [
      { uTime: { value: 0 }, uSeed: { value: 3 }, uA: { value: pal.smog.clone() }, uB: { value: pal.accent.clone() }, uDensity: { value: 0.3 }, uCore: { value: 0 } },
      { uTime: { value: 4 }, uSeed: { value: 7 }, uA: { value: pal.sky1.clone() }, uB: { value: pal.accent2.clone() }, uDensity: { value: 0.22 }, uCore: { value: 0 } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const neb0 = useShaderMaterial(flatVert, nebulaFrag, nebU[0], { transparent: true, depthWrite: false })
  const neb1 = useShaderMaterial(flatVert, nebulaFrag, nebU[1], { transparent: true, depthWrite: false })
  const far = useRef()

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 1 / 15)
    const t = clock.elapsedTime
    skyU.uTime.value = t
    skyU.uTint.value.copy(pal.star)
    skyU.uSky0.value.copy(pal.sky0)
    skyU.uSky1.value.copy(pal.sky1)
    skyU.uSmog.value.copy(pal.smog)
    nebU[0].uA.value.copy(pal.smog)
    nebU[0].uB.value.copy(pal.accent)
    nebU[1].uA.value.copy(pal.sky1)
    nebU[1].uB.value.copy(pal.accent2)
    skyU.uOffset.value.set(camera.position.x * 0.00008 + t * 0.0012, camera.position.y * 0.00008)
    nebU[0].uTime.value += dt
    nebU[1].uTime.value += dt
    // the far layer barely moves with the camera: it is very far away
    if (far.current) far.current.position.set(camera.position.x * 0.92, camera.position.y * 0.92, 0)

    const sp = game.speed * 1.5
    const len = 2 + game.speed * 0.07 * (1 + game.boost * 2.5)
    const pos = lineGeo.attributes.position.array
    const al = lineGeo.attributes.aAlpha.array
    for (let i = 0; i < N; i++) {
      const s = streaks[i]
      s.z += sp * dt
      if (s.z > NEAR) s.z -= NEAR - FAR
      const fade = THREE.MathUtils.smoothstep(s.z, FAR, FAR + 160)
      pos[i * 6] = s.x
      pos[i * 6 + 1] = s.y
      pos[i * 6 + 2] = s.z
      pos[i * 6 + 3] = s.x
      pos[i * 6 + 4] = s.y
      pos[i * 6 + 5] = s.z - len * s.b
      al[i * 2] = 0.65 * s.b * fade
      al[i * 2 + 1] = 0
    }
    lineGeo.attributes.position.needsUpdate = true
    lineGeo.attributes.aAlpha.needsUpdate = true
  })

  return (
    <>
      <group ref={far}>
        <mesh material={sky} position={[0, 0, -1500]} renderOrder={-10}>
          <planeGeometry args={[5600, 3200]} />
        </mesh>
        <mesh material={neb0} position={[-420, 160, -1250]} rotation={[0, 0, 0.4]} renderOrder={-9}>
          <planeGeometry args={[1100, 1100]} />
        </mesh>
        <mesh material={neb1} position={[560, -220, -1300]} rotation={[0, 0, -0.8]} renderOrder={-9}>
          <planeGeometry args={[1300, 1300]} />
        </mesh>
        <points geometry={starGeo} material={starMat} renderOrder={-8} frustumCulled={false} />
      </group>
      <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
    </>
  )
}
