import type { JointName } from './types.ts'

/**
 * OpenPose COCO-18 keypoint index for each Joint whose position is a keypoint.
 * Nose, eyes and ears (0, 14–17) derive from the head; kept for a later skeleton export.
 */
export const OPENPOSE_KEYPOINT: Partial<Record<JointName, number>> = {
  neck: 1,
  shoulderR: 2, elbowR: 3, wristR: 4,
  shoulderL: 5, elbowL: 6, wristL: 7,
  hipR: 8, kneeR: 9, ankleR: 10,
  hipL: 11, kneeL: 12, ankleL: 13,
}
