import { useMemo } from 'react'
import * as THREE from 'three'

// The flight plan: a faint dashed line through every stop in story order.
export default function RouteLine({ stops, tint }) {
  const line = useMemo(() => {
    const pts = []
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      const ax = a.pos[0]
      const ay = a.pos[1]
      const bx = b.pos[0]
      const by = b.pos[1]
      const dx = bx - ax
      const dy = by - ay
      const d = Math.hypot(dx, dy) || 1
      // start and end the segment outside each object's marker ring
      const pad0 = a.r * 1.5 + 2.5
      const pad1 = b.r * 1.5 + 2.5
      pts.push(new THREE.Vector3(ax + (dx / d) * pad0, ay + (dy / d) * pad0, -0.6))
      pts.push(new THREE.Vector3(bx - (dx / d) * pad1, by - (dy / d) * pad1, -0.6))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineDashedMaterial({
      color: tint,
      dashSize: 1.4,
      gapSize: 2.2,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
    const obj = new THREE.LineSegments(geo, mat)
    obj.computeLineDistances()
    return obj
  }, [stops, tint])
  return <primitive object={line} />
}
