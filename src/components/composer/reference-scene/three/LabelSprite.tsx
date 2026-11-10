import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { Vec3 } from '@/lib/reference-scene/types.ts'

/** A text pill drawn into a texture; sized in metres so it reads the same in every editor view. */
export function LabelSprite({ text, colour, position, height = 0.09 }: { text: string; colour: string; position: Vec3; height?: number }) {
  const { texture, aspect } = useMemo(() => {
    const px = 64
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = `600 ${px * 0.55}px system-ui, sans-serif`
    const w = Math.ceil(ctx.measureText(text).width + px * 1.25)
    ctx.canvas.width = w
    ctx.canvas.height = px
    ctx.font = `600 ${px * 0.55}px system-ui, sans-serif`
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, px, px / 2)
    ctx.fill()
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(px * 0.45, px / 2, px * 0.17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, px * 0.75, px / 2 + 1)
    const tex = new CanvasTexture(ctx.canvas)
    tex.colorSpace = SRGBColorSpace
    return { texture: tex, aspect: w / px }
  }, [text, colour])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={20}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  )
}
