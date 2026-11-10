import { useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight } from 'lucide-react'
import { cn } from 'cn'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { EditorCanvas, type EditorViewKind } from './EditorCanvas'
import { RenderCanvas, type RenderCanvasHandle } from './RenderCanvas'

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** Largest box of the given aspect that fits. */
const fit = (w: number, h: number, aspect: number) => (w / Math.max(1, h) > aspect ? { width: h * aspect, height: h } : { width: w, height: w / aspect })

function PaneLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('pointer-events-none absolute top-2 left-2 z-10 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white', className)}>{children}</span>
}

/** The Render View sized to the output aspect ratio, letterboxed inside its pane. */
function RenderPane({ aspect, renderRef, label }: { aspect: number; renderRef: RefObject<RenderCanvasHandle | null>; label: string }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const box = fit(size.w, size.h, aspect)
  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center bg-neutral-900/90">
      <div className="relative" style={box}>
        {box.width > 0 && <div className="absolute inset-0"><RenderCanvas ref={renderRef} aspect={aspect} /></div>}
        <PaneLabel>{label}</PaneLabel>
      </div>
    </div>
  )
}

export function Viewports({ aspect, shiftRef, renderRef, forceSingle }: { aspect: number; shiftRef: RefObject<boolean>; renderRef: RefObject<RenderCanvasHandle | null>; forceSingle: boolean }) {
  const { t } = useTranslation('scene')
  const layout = useReferenceSceneStore(s => (forceSingle ? 'single' : s.draft?.layout ?? 'single'))
  const swapped = useReferenceSceneStore(s => s.swapped)
  const setSwapped = useReferenceSceneStore(s => s.setSwapped)
  const focal = useReferenceSceneStore(s => s.draft?.camera.focalMm ?? 50)
  const lookThrough = useReferenceSceneStore(s => s.lookThrough)
  const renderLabel = `${t('render-view')} · ${Math.round(focal)} mm`

  if (layout === 'four') {
    const cell = (kind: EditorViewKind) => (
      <div key={kind} className="relative overflow-hidden bg-muted/60">
        <EditorCanvas view={kind} aspect={aspect} shiftRef={shiftRef} />
        <PaneLabel>{t(`view.${kind}`)}</PaneLabel>
      </div>
    )
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-px bg-border">
        {cell('top')}{cell('front')}{cell('side')}
        <div className="relative overflow-hidden"><RenderPane aspect={aspect} renderRef={renderRef} label={renderLabel} /></div>
      </div>
    )
  }

  // Single view: both panes stay mounted; swapping only moves them, so neither WebGL context restarts.
  const pip = 'absolute right-3 bottom-3 z-20 overflow-hidden rounded-lg shadow-xl ring-1 ring-black/20'
  const pipStyle = { width: 'clamp(140px, 30%, 360px)', aspectRatio: String(aspect), maxHeight: '45%' }
  const swapButton = (
    <button type="button" onClick={() => setSwapped(!swapped)} aria-label={t('swap-views')} title={t('swap-views')}
      className="absolute top-1.5 right-1.5 z-20 rounded-md bg-black/50 p-1 text-white hover:bg-black/70"><ArrowLeftRight className="size-3.5" /></button>
  )
  return (
    <div className="relative h-full overflow-hidden bg-muted/60">
      <div className={cn('bg-muted', swapped ? pip : 'absolute inset-0')} style={swapped ? pipStyle : undefined}>
        <EditorCanvas view="orbit" aspect={aspect} shiftRef={shiftRef} />
        <PaneLabel>{lookThrough ? t('looking-through') : t('view.orbit')}</PaneLabel>
        {swapped && swapButton}
      </div>
      <div className={swapped ? 'absolute inset-0' : pip} style={swapped ? undefined : pipStyle}>
        <RenderPane aspect={aspect} renderRef={renderRef} label={renderLabel} />
        {!swapped && swapButton}
      </div>
    </div>
  )
}
