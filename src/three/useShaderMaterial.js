import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

// Builds a ShaderMaterial once per mount and disposes it on unmount.
// `uniforms` must be a stable object (useMemo it); mutate `.value` per frame.
export function useShaderMaterial(vertexShader, fragmentShader, uniforms, options = {}) {
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

export const color = (hex) => new THREE.Color(hex)
export const vec3 = (arr) => new THREE.Vector3(arr[0], arr[1], arr[2])
