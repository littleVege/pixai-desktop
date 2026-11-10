import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { buildRig, type Rig, type Segment } from './rig.ts'
import { JOINT_EULER_ORDER, JOINT_NAMES, type Figure, type JointName, type Vec3 } from './types.ts'

const DEG = Math.PI / 180

export const jointQuaternion = ([x, y, z]: Vec3) => new Quaternion().setFromEuler(new Euler(x * DEG, y * DEG, z * DEG, JOINT_EULER_ORDER))

/** Figure-root transform: ground position, then facing. */
export const figureMatrix = (fig: Pick<Figure, 'position' | 'yaw'>) =>
  new Matrix4().compose(new Vector3(...fig.position), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), fig.yaw * DEG), new Vector3(1, 1, 1))

/** World matrix of every Joint (parents come before children in JOINT_NAMES). */
export function jointMatrices(fig: Figure, rig: Rig = buildRig(fig.proportion, fig.heightCm)): Record<JointName, Matrix4> {
  const root = figureMatrix(fig)
  const out = {} as Record<JointName, Matrix4>
  for (const j of JOINT_NAMES) {
    const { parent, offset } = rig.joints[j]
    const local = new Matrix4().compose(new Vector3(...offset), jointQuaternion(fig.pose[j]), new Vector3(1, 1, 1))
    out[j] = (parent ? out[parent] : root).clone().multiply(local)
  }
  return out
}

/** Points on a segment's surface that bound it from below (exact for capsules, spheres and boxes). */
function segmentExtremes(seg: Segment, m: Matrix4): Vector3[] {
  const c = new Vector3(...seg.center)
  if (seg.shape === 'capsule') {
    const half = seg.length / 2
    const r = seg.radius * Math.max(...seg.scale)
    return [c.clone().setY(c.y - half), c.clone().setY(c.y + half)].map(p => p.applyMatrix4(m).setY(p.y - r))
  }
  if (seg.shape === 'ellipsoid' || seg.shape === 'cone') {
    const r = seg.shape === 'ellipsoid' ? Math.max(...seg.radii) : Math.max(seg.radius, seg.height / 2)
    const p = c.applyMatrix4(m)
    return [p.setY(p.y - r)]
  }
  const [sx, sy, sz] = seg.size.map(s => s / 2)
  const pts: Vector3[] = []
  for (const dx of [-sx, sx]) for (const dy of [-sy, sy]) for (const dz of [-sz, sz]) pts.push(new Vector3(c.x + dx, c.y + dy, c.z + dz).applyMatrix4(m))
  return pts
}

/** Lowest world Y of the Figure's body. */
export function lowestPoint(fig: Figure): number {
  const rig = buildRig(fig.proportion, fig.heightCm)
  const mats = jointMatrices(fig, rig)
  let min = Infinity
  for (const seg of rig.segments) for (const p of segmentExtremes(seg, mats[seg.owner])) min = Math.min(min, p.y)
  return min
}

/** Figure position moved vertically so its lowest point touches the ground. */
export function snapToGround(fig: Figure): Vec3 {
  const dy = -lowestPoint(fig)
  return [fig.position[0], fig.position[1] + dy, fig.position[2]]
}

/** World position just above the crown, where a label sits. */
export function labelAnchor(fig: Figure, lift = 0.12): Vec3 {
  const rig = buildRig(fig.proportion, fig.heightCm)
  const p = new Vector3(0, rig.headTop, 0).applyMatrix4(jointMatrices(fig, rig).head)
  return [p.x, p.y + lift, p.z]
}
