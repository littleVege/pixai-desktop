import type { JointName, Pose, Rot3 } from './types.ts'

export type Range = [number, number]
export type JointLimits = [Range, Range, Range]

/**
 * Normal range of motion per axis, in degrees, for the left side and the centre line.
 * Left-side conventions (rest pose: arms and legs hanging straight down):
 *  shoulder/hip  X- raises the limb forward, Z+ raises it sideways, Y twists it
 *  elbow         X- bends the forearm forward
 *  knee          X+ bends the shin back
 *  ankle         X+ points the toes down
 *  spine/neck    X+ bends forward, Y+ turns to the figure's left, Z+ leans to its right
 */
const LEFT_AND_CENTRE: Record<string, JointLimits> = {
  pelvis: [[-180, 180], [-180, 180], [-180, 180]],
  waist: [[-30, 60], [-40, 40], [-30, 30]],
  chest: [[-25, 40], [-35, 35], [-25, 25]],
  neck: [[-40, 50], [-60, 60], [-35, 35]],
  head: [[-25, 25], [-25, 25], [-15, 15]],
  shoulder: [[-180, 60], [-90, 90], [-20, 180]],
  elbow: [[-150, 0], [-90, 90], [0, 0]],
  wrist: [[-80, 80], [-20, 20], [-30, 30]],
  hip: [[-125, 30], [-45, 45], [-30, 50]],
  knee: [[0, 150], [0, 0], [0, 0]],
  ankle: [[-25, 50], [-20, 20], [-25, 25]],
}

const mirrorRange = ([lo, hi]: Range): Range => [-hi, -lo]

/** The right side mirrors the left across the figure's sagittal plane: Y and Z ranges flip. */
export function limitsFor(joint: JointName): JointLimits {
  const side = joint.endsWith('R') ? 'R' : joint.endsWith('L') ? 'L' : null
  const base = LEFT_AND_CENTRE[side ? joint.slice(0, -1) : joint]
  if (side !== 'R') return base
  return [base[0], mirrorRange(base[1]), mirrorRange(base[2])]
}

/** Joints whose range is unlimited (whole-body tilt); never shown as out of range. */
export const isFreeJoint = (joint: JointName) => joint === 'pelvis'

const EPS = 0.01

export function isOutOfRange(joint: JointName, rot: Rot3): boolean {
  const lim = limitsFor(joint)
  return rot.some((v, i) => v < lim[i][0] - EPS || v > lim[i][1] + EPS)
}

export function outOfRangeJoints(pose: Pose): JointName[] {
  return (Object.keys(pose) as JointName[]).filter(j => isOutOfRange(j, pose[j]))
}

/**
 * Clamp a rotation to the joint's range. `allowOut` (Shift held) skips clamping.
 * `from` is the value when the drag started: an axis already out of range may stay where it was,
 * so dragging an out-of-range joint without Shift never snaps it back.
 */
export function clampRotation(joint: JointName, rot: Rot3, opts: { allowOut?: boolean; from?: Rot3 } = {}): Rot3 {
  if (opts.allowOut) return [...rot]
  const lim = limitsFor(joint)
  return rot.map((v, i) => {
    let [lo, hi] = lim[i]
    if (opts.from) { lo = Math.min(lo, opts.from[i]); hi = Math.max(hi, opts.from[i]) }
    return Math.min(hi, Math.max(lo, v))
  }) as Rot3
}

/** Wrap degrees into (-180, 180]. */
export const wrapDeg = (d: number) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r }
