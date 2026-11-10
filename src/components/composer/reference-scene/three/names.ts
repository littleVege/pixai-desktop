import type { JointName } from '@/lib/reference-scene/types.ts'

/** Object3D names, so the gizmo can find what the selection points at. */
export const objectName = {
  figure: (id: string) => `figure:${id}`,
  joint: (figureId: string, joint: JointName) => `joint:${figureId}:${joint}`,
  prop: (id: string) => `prop:${id}`,
  camera: 'render-camera',
}
