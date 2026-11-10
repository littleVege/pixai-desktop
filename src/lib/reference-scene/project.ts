import { Vector3 } from 'three'
import { radiusAtAngle, type Lens } from './lens.ts'
import { viewMatrix } from './camera.ts'
import type { RenderCamera, Vec3 } from './types.ts'

/**
 * Where a world point lands in the rendered image, in pixels (origin top-left), through the distorted lens.
 * Null when the lens cannot see it.
 */
export function projectToImage(point: Vec3, cam: Pick<RenderCamera, 'position' | 'target' | 'roll'>, lens: Lens, width: number, height: number): [number, number] | null {
  const p = new Vector3(...point).applyMatrix4(viewMatrix(cam))
  const theta = Math.atan2(Math.hypot(p.x, p.y), -p.z)
  const rho = radiusAtAngle(theta, lens.f, lens.kappa)
  if (!Number.isFinite(rho)) return null
  const phi = Math.atan2(p.y, p.x)
  const u = 0.5 + (rho * Math.cos(phi)) / lens.sensorW
  const v = 0.5 + (rho * Math.sin(phi)) / lens.sensorH
  if (u < 0 || u > 1 || v < 0 || v > 1) return null
  return [u * width, (1 - v) * height]
}
