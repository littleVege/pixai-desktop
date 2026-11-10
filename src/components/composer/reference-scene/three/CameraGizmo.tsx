import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { angleAtRadius, type Lens } from '@/lib/reference-scene/lens.ts'
import { cameraDistance, cameraQuaternion } from '@/lib/reference-scene/camera.ts'
import type { RenderCamera } from '@/lib/reference-scene/types.ts'
import { objectName } from './names'

/** Ray direction (camera space) through an image-plane point given in mm. */
function rayAt(lens: Lens, x: number, y: number, len: number): [number, number, number] {
  const rho = Math.hypot(x, y)
  const theta = angleAtRadius(rho, lens.f, lens.kappa)
  const c = rho > 0 ? [x / rho, y / rho] : [0, 0]
  return [Math.sin(theta) * c[0] * len, Math.sin(theta) * c[1] * len, -Math.cos(theta) * len]
}

/** Edge rays plus the frame outline, sampled along each edge so lens curvature shows. */
function frustumGeometry(lens: Lens, len: number) {
  const hw = lens.sensorW / 2, hh = lens.sensorH / 2
  const outline: [number, number][] = []
  const N = 12
  for (let i = 0; i < N; i++) outline.push([-hw + (2 * hw * i) / N, hh])
  for (let i = 0; i < N; i++) outline.push([hw, hh - (2 * hh * i) / N])
  for (let i = 0; i < N; i++) outline.push([hw - (2 * hw * i) / N, -hh])
  for (let i = 0; i < N; i++) outline.push([-hw, -hh + (2 * hh * i) / N])
  const pts: number[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = rayAt(lens, ...outline[i], len), b = rayAt(lens, ...outline[(i + 1) % outline.length], len)
    pts.push(...a, ...b)
  }
  for (const [x, y] of [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]] as const) pts.push(0, 0, 0, ...rayAt(lens, x, y, len))
  // "up" marker above the frame
  const up = rayAt(lens, 0, hh * 1.35, len), l = rayAt(lens, -hw * 0.25, hh * 1.02, len), r = rayAt(lens, hw * 0.25, hh * 1.02, len)
  pts.push(...l, ...up, ...up, ...r)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pts, 3))
  return g
}

export function CameraGizmo({ camera, lens, selected, onPick }: { camera: RenderCamera; lens: Lens; selected: boolean; onPick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const q = useMemo(() => cameraQuaternion(camera.position, camera.target, camera.roll), [camera.position, camera.target, camera.roll])
  const len = Math.min(1.6, Math.max(0.4, cameraDistance(camera) * 0.5))
  const geom = useMemo(() => frustumGeometry(lens, len), [lens, len])
  const colour = selected ? '#facc15' : '#3b82f6'
  const pick = onPick ? (e: ThreeEvent<MouseEvent>) => { if (e.delta > 4) return; e.stopPropagation(); onPick(e) } : undefined
  return (
    <>
      <group name={objectName.camera} position={camera.position} quaternion={q}>
        <mesh onClick={pick}><boxGeometry args={[0.16, 0.11, 0.12]} /><meshBasicMaterial color={colour} /></mesh>
        <mesh position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]} onClick={pick}><cylinderGeometry args={[0.045, 0.05, 0.07, 16]} /><meshBasicMaterial color={colour} /></mesh>
        <lineSegments geometry={geom}><lineBasicMaterial color={colour} transparent opacity={0.8} /></lineSegments>
      </group>
      <mesh position={camera.target}><sphereGeometry args={[0.03, 12, 8]} /><meshBasicMaterial color={colour} /></mesh>
    </>
  )
}
