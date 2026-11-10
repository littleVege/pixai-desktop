import { useEffect, useRef, useState, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import type { Object3D } from 'three'
import { useReferenceSceneStore, findFigure, findProp } from '@/store/referenceSceneStore'
import { clampRotation } from '@/lib/reference-scene/limits.ts'
import { aimFromQuaternion, cameraDistance } from '@/lib/reference-scene/camera.ts'
import type { RenderCamera, Rot3, Vec3 } from '@/lib/reference-scene/types.ts'
import { objectName } from './names'

const DEG = Math.PI / 180
const round = (n: number, step = 0.1) => Math.round(n / step) * step
const vec = (o: { x: number; y: number; z: number }, step = 0.001): Vec3 => [round(o.x, step), round(o.y, step), round(o.z, step)]

/** Transform handles for whatever is selected. Joints rotate within range unless Shift (or the unlock toggle) is on. */
export function SelectionGizmo({ shiftRef }: { shiftRef: RefObject<boolean> }) {
  const scene = useThree(s => s.scene)
  const invalidate = useThree(s => s.invalidate)
  const selection = useReferenceSceneStore(s => s.selection)
  const gizmoMode = useReferenceSceneStore(s => s.gizmoMode)
  const draft = useReferenceSceneStore(s => s.draft)
  const [obj, setObj] = useState<Object3D | null>(null)
  const start = useRef<{ rot?: Rot3; camera?: RenderCamera; distance?: number; key: string } | null>(null)

  const name = !selection ? null
    : selection.kind === 'figure' ? objectName.figure(selection.id)
    : selection.kind === 'joint' ? objectName.joint(selection.figureId, selection.joint)
    : selection.kind === 'prop' ? objectName.prop(selection.id)
    : objectName.camera
  useEffect(() => { setObj(name ? scene.getObjectByName(name) ?? null : null) }, [name, scene, draft])
  if (!selection || !obj || !draft) return null

  const mode = selection.kind === 'joint' ? 'rotate'
    : selection.kind === 'prop' ? gizmoMode
    : gizmoMode === 'scale' ? 'translate' : gizmoMode
  const yawOnly = selection.kind === 'figure' && mode === 'rotate'
  const { edit, endGesture } = useReferenceSceneStore.getState()

  const onMouseDown = () => {
    const s = useReferenceSceneStore.getState()
    const key = `gizmo-${Date.now()}`
    if (selection.kind === 'joint') start.current = { key, rot: findFigure(s.draft, selection.figureId)?.pose[selection.joint] }
    else if (selection.kind === 'camera' && s.draft) start.current = { key, camera: structuredClone(s.draft.camera), distance: cameraDistance(s.draft.camera) }
    else start.current = { key }
  }

  const onObjectChange = () => {
    const st = start.current
    if (!st) return
    if (selection.kind === 'joint') {
      const raw: Rot3 = [obj.rotation.x / DEG, obj.rotation.y / DEG, obj.rotation.z / DEG]
      const clamped = clampRotation(selection.joint, raw, { allowOut: shiftRef.current || useReferenceSceneStore.getState().unlocked, from: st.rot }).map(v => round(v)) as Rot3
      obj.rotation.set(clamped[0] * DEG, clamped[1] * DEG, clamped[2] * DEG)
      edit(s => { const f = findFigure(s, selection.figureId); if (f) f.pose[selection.joint] = clamped }, st.key)
    } else if (selection.kind === 'figure') {
      const id = selection.id
      if (yawOnly) {
        const yaw = round((2 * Math.atan2(obj.quaternion.y, obj.quaternion.w)) / DEG)
        edit(s => { const f = findFigure(s, id); if (f) f.yaw = yaw }, st.key)
      } else {
        const position = vec(obj.position)
        edit(s => { const f = findFigure(s, id); if (f) f.position = position }, st.key)
      }
    } else if (selection.kind === 'prop') {
      const id = selection.id
      const position = vec(obj.position), scale = vec(obj.scale)
      const rotation: Vec3 = [round(obj.rotation.x / DEG), round(obj.rotation.y / DEG), round(obj.rotation.z / DEG)]
      edit(s => { const p = findProp(s, id); if (p) Object.assign(p, { position, rotation, scale }) }, st.key)
    } else if (st.camera) {
      const position = vec(obj.position)
      if (mode === 'translate') {
        const d = position.map((v, i) => v - st.camera!.position[i])
        const target = st.camera.target.map((v, i) => round(v + d[i], 0.001)) as Vec3
        edit(s => { s.camera.position = position; s.camera.target = target }, st.key)
      } else {
        const aim = aimFromQuaternion(position, obj.quaternion, st.distance ?? 1)
        edit(s => { s.camera.target = vec({ x: aim.target[0], y: aim.target[1], z: aim.target[2] }); s.camera.roll = round(aim.roll) }, st.key)
      }
    }
    invalidate()
  }

  return (
    <TransformControls
      object={obj}
      mode={mode}
      space={selection.kind === 'joint' || (selection.kind === 'camera' && mode === 'rotate') ? 'local' : 'world'}
      showX={!yawOnly}
      showZ={!yawOnly}
      size={selection.kind === 'joint' ? 0.7 : 0.9}
      onMouseDown={onMouseDown}
      onMouseUp={() => { start.current = null; endGesture() }}
      onObjectChange={onObjectChange}
    />
  )
}
