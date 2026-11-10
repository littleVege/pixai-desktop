import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { NoToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer, type Scene } from 'three'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { lensFor } from '@/lib/reference-scene/lens.ts'
import { labelAnchor } from '@/lib/reference-scene/fk.ts'
import { projectToImage } from '@/lib/reference-scene/project.ts'
import { colourHex, type ReferenceScene } from '@/lib/reference-scene/types.ts'
import { Lights, RenderEnvironment } from '../three/Environment'
import { SceneObjects } from '../three/SceneObjects'
import { LensRenderer } from '../three/LensRenderer'

export interface RenderCanvasHandle {
  /** Render the scene through the lens at `width`×`height` and return a PNG. */
  capture: (scene: ReferenceScene, width: number, height: number) => Promise<Blob>
}

function LensOutput({ aspect, sceneRef }: { aspect: number; sceneRef: React.RefObject<Scene | null> }) {
  const draft = useReferenceSceneStore(s => s.draft)
  const renderer = useMemo(() => new LensRenderer(), [])
  const lens = useMemo(() => (draft ? lensFor(draft.camera, aspect) : null), [draft, aspect])
  const scene = useThree(s => s.scene)
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => { sceneRef.current = scene }, [scene, sceneRef])
  useEffect(() => () => renderer.dispose(), [renderer])
  useEffect(() => { invalidate() }, [draft, aspect, invalidate])
  useFrame(({ gl, size, viewport }) => {
    if (!draft || !lens) return
    renderer.render(gl, scene, { camera: draft.camera, lens, width: size.width * viewport.dpr, height: size.height * viewport.dpr, supersample: 1.5, cubeSize: 1024 })
  }, 1)
  return null
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: ReferenceScene, aspect: number, w: number, h: number) {
  const lens = lensFor(scene.camera, aspect)
  const font = Math.round(h * 0.026)
  ctx.font = `600 ${font}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const fig of scene.figures) {
    const p = projectToImage(labelAnchor(fig, 0.08), scene.camera, lens, w, h)
    if (!p) continue
    const text = fig.colour
    const tw = ctx.measureText(text).width + font
    const th = font * 1.5
    ctx.fillStyle = colourHex(fig.colour)
    ctx.beginPath()
    ctx.roundRect(p[0] - tw / 2, p[1] - th / 2, tw, th, th / 2)
    ctx.fill()
    ctx.fillStyle = fig.colour === 'white' || fig.colour === 'yellow' ? '#111' : '#fff'
    ctx.fillText(text, p[0], p[1])
  }
}

/** What the Render Camera sees, lens distortion included. Also renders the Scene Reference image. */
export const RenderCanvas = forwardRef<RenderCanvasHandle, { aspect: number; className?: string }>(function RenderCanvas({ aspect, className }, ref) {
  const scene = useReferenceSceneStore(s => s.draft)
  const sceneRef = useRef<Scene | null>(null)

  useImperativeHandle(ref, () => ({
    capture: async (draft, width, height) => {
      const three = sceneRef.current
      if (!three) throw new Error('Render view not ready')
      const ss = 2
      const canvas = document.createElement('canvas')
      const gl = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
      try {
        gl.setPixelRatio(1)
        gl.setSize(width * ss, height * ss, false)
        gl.shadowMap.enabled = true
        gl.shadowMap.type = PCFSoftShadowMap
        gl.outputColorSpace = SRGBColorSpace
        gl.toneMapping = NoToneMapping
        const lensRenderer = new LensRenderer()
        lensRenderer.render(gl, three, { camera: draft.camera, lens: lensFor(draft.camera, aspect), width: width * ss, height: height * ss, supersample: 1.25, cubeSize: 1536 })
        lensRenderer.dispose()
        const out = document.createElement('canvas')
        out.width = width
        out.height = height
        const ctx = out.getContext('2d')!
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(canvas, 0, 0, width, height)
        if (draft.burnLabels) drawLabels(ctx, draft, aspect, width, height)
        return await new Promise<Blob>((resolve, reject) => out.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'))
      } finally {
        gl.dispose()
        gl.forceContextLoss()
      }
    },
  }), [aspect])

  if (!scene) return null
  return (
    <Canvas shadows flat dpr={[1, 2]} frameloop="demand" className={className} gl={{ antialias: false }}>
      <Lights />
      <RenderEnvironment />
      <SceneObjects scene={scene} interactive={false} aspect={aspect} />
      <LensOutput aspect={aspect} sceneRef={sceneRef} />
    </Canvas>
  )
})
