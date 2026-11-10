import { JOINT_NAMES, type JointName, type Pose, type Rot3 } from './types.ts'

export const emptyPose = (): Pose => Object.fromEntries(JOINT_NAMES.map(j => [j, [0, 0, 0]])) as unknown as Pose

export const poseFrom = (partial: Partial<Pose>): Pose => ({ ...emptyPose(), ...structuredClone(partial) })

const twin = (j: JointName): JointName =>
  j.endsWith('L') ? (`${j.slice(0, -1)}R` as JointName) : j.endsWith('R') ? (`${j.slice(0, -1)}L` as JointName) : j

/** Swap left and right. Reflecting across the sagittal plane keeps X rotations and negates Y and Z. */
export function mirrorPose(pose: Pose): Pose {
  const out = emptyPose()
  for (const j of JOINT_NAMES) {
    const [x, y, z] = pose[j]
    out[twin(j)] = [x, y === 0 ? 0 : -y, z === 0 ? 0 : -z] as Rot3
  }
  return out
}

export const posesEqual = (a: Pose, b: Pose) => JOINT_NAMES.every(j => a[j].every((v, i) => Math.abs(v - b[j][i]) < 1e-6))
