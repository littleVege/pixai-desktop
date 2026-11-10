import { Matrix4, Quaternion, Vector3 } from 'three'
import type { RenderCamera, Vec3 } from './types.ts'

const UP = new Vector3(0, 1, 0)
const DEG = Math.PI / 180

/** Orientation of a camera at `position` looking at `target`, then rolled about its viewing axis. */
export function cameraQuaternion(position: Vec3, target: Vec3, roll: number): Quaternion {
  const eye = new Vector3(...position)
  const at = new Vector3(...target)
  const dir = at.clone().sub(eye)
  // Looking straight up or down: pick an up vector that is not parallel to the view.
  const up = Math.abs(dir.normalize().dot(UP)) > 0.9999 ? new Vector3(0, 0, -Math.sign(dir.y)) : UP
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, at, up))
  return q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll * DEG))
}

/** Inverse of cameraQuaternion: a target at the same distance along the new view axis, and the roll. */
export function aimFromQuaternion(position: Vec3, q: Quaternion, distance: number): Pick<RenderCamera, 'target' | 'roll'> {
  const fwd = new Vector3(0, 0, -1).applyQuaternion(q)
  const target = new Vector3(...position).addScaledVector(fwd, Math.max(0.05, distance))
  const t: Vec3 = [target.x, target.y, target.z]
  const unrolled = cameraQuaternion(position, t, 0)
  const rel = unrolled.invert().multiply(q)
  const roll = (2 * Math.atan2(rel.z, rel.w)) / DEG
  return { target: t, roll: Math.round(((((roll + 180) % 360) + 360) % 360 - 180) * 1000) / 1000 }
}

export const cameraDistance = (cam: Pick<RenderCamera, 'position' | 'target'>) => new Vector3(...cam.position).distanceTo(new Vector3(...cam.target))

/** World → camera-space matrix for a Render Camera. */
export function viewMatrix(cam: Pick<RenderCamera, 'position' | 'target' | 'roll'>): Matrix4 {
  const world = new Matrix4().compose(new Vector3(...cam.position), cameraQuaternion(cam.position, cam.target, cam.roll), new Vector3(1, 1, 1))
  return world.invert()
}
