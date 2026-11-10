import { useMemo } from 'react'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { labelAnchor } from '@/lib/reference-scene/fk.ts'
import { lensFor } from '@/lib/reference-scene/lens.ts'
import { colourHex, type ReferenceScene } from '@/lib/reference-scene/types.ts'
import { FigureMesh } from './FigureMesh'
import { PropMesh } from './PropMesh'
import { CameraGizmo } from './CameraGizmo'
import { LabelSprite } from './LabelSprite'

/** Figures and Props. In the editor they are pickable and carry labels, handles and the camera gizmo. */
export function SceneObjects({ scene, interactive, aspect }: { scene: ReferenceScene; interactive: boolean; aspect: number }) {
  const selection = useReferenceSceneStore(s => s.selection)
  const select = useReferenceSceneStore(s => s.select)
  const lens = useMemo(() => lensFor(scene.camera, aspect), [scene.camera, aspect])
  return (
    <>
      {scene.figures.map(fig => {
        const active = (selection?.kind === 'figure' && selection.id === fig.id) || (selection?.kind === 'joint' && selection.figureId === fig.id)
        return (
          <group key={fig.id}>
            <FigureMesh
              fig={fig}
              interaction={interactive ? {
                showHandles: active,
                selectedJoint: selection?.kind === 'joint' && selection.figureId === fig.id ? selection.joint : null,
                onPick: t => select(t.kind === 'figure' ? { kind: 'figure', id: fig.id } : { kind: 'joint', figureId: fig.id, joint: t.joint }),
              } : undefined}
            />
            {interactive && <LabelSprite text={fig.colour} colour={colourHex(fig.colour)} position={labelAnchor(fig)} />}
          </group>
        )
      })}
      {scene.props.map(p => (
        <PropMesh key={p.id} prop={p} selected={selection?.kind === 'prop' && selection.id === p.id} onPick={interactive ? () => select({ kind: 'prop', id: p.id }) : undefined} />
      ))}
      {interactive && <CameraGizmo camera={scene.camera} lens={lens} selected={selection?.kind === 'camera'} onPick={() => select({ kind: 'camera' })} />}
    </>
  )
}
