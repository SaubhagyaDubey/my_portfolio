import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'

// A dashed ring around a stop: faint until you are near or it is the autopilot target.
export default function Marker({ stop, tint }) {
  const { pos, r } = stop
  const isNear = useStore((s) => s.near === stop.id)
  const isTarget = useStore((s) => s.target === stop.id)
  const isDocked = useStore((s) => s.docked === stop.id)
  const line = useMemo(() => {
    const radius = r * 1.5 + 1.2
    const pts = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0).getPoints(96)
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)))
    const mat = new THREE.LineDashedMaterial({
      color: tint,
      dashSize: radius * 0.14,
      gapSize: radius * 0.14,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
    const obj = new THREE.Line(geo, mat)
    obj.computeLineDistances()
    return obj
  }, [r, tint])
  const ref = useRef()
  useFrame(({ clock }, dt) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.z += dt * (isNear || isTarget ? 0.6 : 0.15)
    const want = isDocked ? 0.05 : isNear || isTarget ? 0.85 : 0.22
    line.material.opacity += (want - line.material.opacity) * Math.min(1, dt * 6)
    const pulse = isTarget && !isDocked ? 1 + Math.sin(t * 5) * 0.04 : 1
    ref.current.scale.setScalar(pulse)
  })
  return (
    <group ref={ref} position={[pos[0], pos[1], 0.2]}>
      <primitive object={line} />
    </group>
  )
}
