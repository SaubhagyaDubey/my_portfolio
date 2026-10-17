import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAX_ORBS, MAX_SHOTS, game } from './state.js'

const dummy = new THREE.Object3D()

// Player bolts in the city's glow, enemy orbs in its second light. Both pooled and instanced.
export default function Bullets({ city }) {
  const shots = useRef()
  const orbs = useRef()
  const halo = useRef()
  const geo = useMemo(() => {
    const bolt = new THREE.CapsuleGeometry(0.1, 2.4, 3, 6)
    bolt.rotateX(Math.PI / 2)
    return { bolt, orb: new THREE.SphereGeometry(0.42, 12, 10), halo: new THREE.SphereGeometry(0.8, 12, 10) }
  }, [])
  const colors = useMemo(
    () => ({
      shot: new THREE.Color(city.glow).multiplyScalar(2.6),
      orb: new THREE.Color(city.accent2).multiplyScalar(2.4),
      halo: new THREE.Color(city.accent2),
    }),
    [city],
  )
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose()
    },
    [geo],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (shots.current) {
      let n = 0
      for (const s of game.shots) {
        if (!s.on) continue
        dummy.position.set(s.x, s.y, s.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        shots.current.setMatrixAt(n++, dummy.matrix)
      }
      shots.current.count = n
      shots.current.instanceMatrix.needsUpdate = true
    }
    if (orbs.current && halo.current) {
      let n = 0
      for (const o of game.orbs) {
        if (!o.on) continue
        dummy.position.set(o.x, o.y, o.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1 + Math.sin(t * 14 + n) * 0.15)
        dummy.updateMatrix()
        orbs.current.setMatrixAt(n, dummy.matrix)
        halo.current.setMatrixAt(n, dummy.matrix)
        n++
      }
      orbs.current.count = n
      halo.current.count = n
      orbs.current.instanceMatrix.needsUpdate = true
      halo.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={shots} args={[geo.bolt, undefined, MAX_SHOTS]} frustumCulled={false}>
        <meshBasicMaterial color={colors.shot} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={orbs} args={[geo.orb, undefined, MAX_ORBS]} frustumCulled={false}>
        <meshBasicMaterial color={colors.orb} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[geo.halo, undefined, MAX_ORBS]} frustumCulled={false}>
        <meshBasicMaterial color={colors.halo} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  )
}
