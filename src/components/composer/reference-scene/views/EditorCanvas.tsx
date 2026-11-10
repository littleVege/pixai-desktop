import { useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { rectilinearVFov } from '@/lib/reference-scene/lens.ts'
import type { Vec3 } from '@/lib/reference-scene/types.ts'
import { Lights } from '../three/Environment'
import { SceneObjects } from '../three/SceneObjects'
import { SelectionGizmo } from '../three/SelectionGizmo'

export type EditorViewKind = 'orbit' | 'top' | 'front' | 'side'

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

const ORTHO: Record<Exclude<EditorViewKind, 'orbit'>, { position: Vec3; up: Vec3; target: Vec3 }> = {
  top: { position: [0, 30, 0], up: [0, 0, -1], target: [0, 0, 0] },
  front: { position: [0, 1, 30], up: [0, 1, 0], target: [0, 1, 0] },
  side: { position: [30, 1, 0], up: [0, 1, 0], target: [0, 1, 0] },
}

const near = (a: { x: number; y: number; z: number }, b: Vec3, eps = 1e-3) => Math.abs(a.x - b[0]) < eps && Math.abs(a.y - b[1]) < eps && Math.abs(a.z - b[2]) < eps

/** While "Look through camera" is on, the orbit view becomes the Render Camera (undistorted) and orbiting moves it. */
function LookThrough({ controls, aspect }: { controls: RefObject<OrbitControlsImpl | null>; aspect: number }) {
  const lookThrough = useReferenceSceneStore(s => s.lookThrough)
  const cam = useReferenceSceneStore(s => s.draft?.camera)
  const camera = useThree(s => s.camera) as PerspectiveCameraImpl
  const size = useThree(s => s.size)
  const invalidate = useThree(s => s.invalidate)
  const saved = useRef<{ position: Vec3; target: Vec3; fov: number } | null>(null)

  useEffect(() => {
    const c = controls.current
    if (!c) return
    if (lookThrough && !saved.current) {
      saved.current = { position: camera.position.toArray() as Vec3, target: c.target.toArray() as Vec3, fov: camera.fov }
    } else if (!lookThrough && saved.current) {
      camera.position.set(...saved.current.position)
      c.target.set(...saved.current.target)
      camera.fov = saved.current.fov
      camera.updateProjectionMatrix()
      c.update()
      saved.current = null
      invalidate()
    }
  }, [lookThrough, camera, controls, invalidate])

  useEffect(() => {
    const c = controls.current
    if (!lookThrough || !cam || !c) return
    const viewAspect = size.width / Math.max(1, size.height)
    const vfov = rectilinearVFov(cam.focalMm, aspect)
    const fov = viewAspect >= aspect ? vfov : (2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * (aspect / viewAspect)) * 180) / Math.PI
    camera.fov = Math.min(150, fov)
    camera.updateProjectionMatrix()
    if (!near(camera.position, cam.position) || !near(c.target, cam.target)) {
      camera.position.set(...cam.position)
      c.target.set(...cam.target)
      c.update()
    }
    invalidate()
  }, [lookThrough, cam, camera, controls, size, aspect, invalidate])

  useEffect(() => {
    const c = controls.current
    if (!c || !lookThrough) return
    const onChange = () => {
      const position = camera.position.toArray().map(v => Math.round(v * 1000) / 1000) as Vec3
      const target = c.target.toArray().map(v => Math.round(v * 1000) / 1000) as Vec3
      useReferenceSceneStore.getState().edit(s => { s.camera.position = position; s.camera.target = target }, 'look-through')
    }
    const onEnd = () => useReferenceSceneStore.getState().endGesture()
    c.addEventListener('change', onChange)
    c.addEventListener('end', onEnd)
    return () => { c.removeEventListener('change', onChange); c.removeEventListener('end', onEnd) }
  }, [lookThrough, camera, controls])
  return null
}

function Ground({ view }: { view: EditorViewKind }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={0.18} />
      </mesh>
      {view === 'orbit' || view === 'top'
        ? <Grid infiniteGrid cellSize={0.25} sectionSize={1} cellColor="#8a8f98" sectionColor="#5b616b" fadeDistance={view === 'top' ? 200 : 30} cellThickness={0.6} sectionThickness={1} />
        : <mesh position={[0, -0.005, 0]}><boxGeometry args={[200, 0.01, 200]} /><meshBasicMaterial color="#6b7280" /></mesh>}
    </>
  )
}

export function EditorCanvas({ view, aspect, shiftRef }: { view: EditorViewKind; aspect: number; shiftRef: RefObject<boolean> }) {
  const scene = useReferenceSceneStore(s => s.draft)
  const lookThrough = useReferenceSceneStore(s => s.lookThrough)
  const select = useReferenceSceneStore(s => s.select)
  const controls = useRef<OrbitControlsImpl>(null)
  const ortho = view === 'orbit' ? null : ORTHO[view]
  if (!scene) return null
  return (
    <Canvas shadows flat dpr={[1, 2]} frameloop="demand" gl={{ alpha: true, antialias: true }} onPointerMissed={() => select(null)} className="touch-none">
      {ortho
        ? <OrthographicCamera makeDefault position={ortho.position} up={ortho.up} zoom={110} near={0.1} far={200} />
        : <PerspectiveCamera makeDefault position={[3.2, 2.4, 4.6]} fov={40} near={0.05} far={500} />}
      <OrbitControls ref={controls} makeDefault target={ortho?.target ?? [0, 0.9, 0]} enableRotate={!ortho} enableDamping={false} screenSpacePanning />
      {view === 'orbit' && <LookThrough controls={controls} aspect={aspect} />}
      <Lights />
      <Ground view={view} />
      <SceneObjects scene={scene} interactive aspect={aspect} />
      {!(lookThrough && view === 'orbit') && <SelectionGizmo shiftRef={shiftRef} />}
    </Canvas>
  )
}
