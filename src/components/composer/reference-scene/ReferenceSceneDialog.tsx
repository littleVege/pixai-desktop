import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Circle, Cylinder, Eye, LayoutGrid, Loader2, Move3d, Redo2, Rotate3d, Scale3d, Square, Undo2, UserPlus, X, RectangleHorizontal } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useComposerStore } from '@/store/composerStore'
import { findFigure, findProp, useReferenceSceneStore, type GizmoMode } from '@/store/referenceSceneStore'
import { aspectOf, canAddFigure, cloneScene, createFigure, createProp, newId, nextFigurePosition, renderSize } from '@/lib/reference-scene/scene.ts'
import { MAX_FIGURES, type PropKind } from '@/lib/reference-scene/types.ts'
import { MAX_REFERENCES } from '@/types'
import { Viewports } from './views/Viewports'
import type { RenderCanvasHandle } from './views/RenderCanvas'
import { FigurePanel } from './panels/FigurePanel'
import { JointPanel } from './panels/JointPanel'
import { PropPanel } from './panels/PropPanel'
import { CameraPanel } from './panels/CameraPanel'
import { ScenePanel } from './panels/ScenePanel'
import { editScene } from './panels/fields'

const PROP_ICONS: Record<PropKind, typeof Box> = { box: Box, sphere: Circle, cylinder: Cylinder, plane: Square }

function RailButton({ label, onClick, active, disabled, children }: { label: string; onClick?: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={active ? 'secondary' : 'ghost'} size="icon" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={cn(active && 'ring-1 ring-border')}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/** The Reference Scene editor. Opened from the Composer's + menu or by clicking a Scene Reference. */
export function ReferenceSceneDialog({ onNotice }: { onNotice: (msg: string) => void }) {
  const { t } = useTranslation('scene')
  const isMobile = useIsMobile()
  const dialog = useReferenceSceneStore(s => s.dialog)
  const draft = useReferenceSceneStore(s => s.draft)
  const selection = useReferenceSceneStore(s => s.selection)
  const gizmoMode = useReferenceSceneStore(s => s.gizmoMode)
  const lookThrough = useReferenceSceneStore(s => s.lookThrough)
  const canUndo = useReferenceSceneStore(s => s.past.length > 0)
  const canRedo = useReferenceSceneStore(s => s.future.length > 0)
  const { close, undo, redo, select, setGizmoMode, setLookThrough, saveScene } = useReferenceSceneStore.getState()
  const aspectRatio = useComposerStore(s => s.params.aspectRatio)
  const referenceCount = useComposerStore(s => s.references.length)
  const aspect = aspectOf(aspectRatio)
  const shiftRef = useRef(false)
  const renderRef = useRef<RenderCanvasHandle>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'selection' | 'camera'>('selection')
  const open = dialog !== null && draft !== null
  const editing = dialog?.referenceId ?? null
  const full = referenceCount >= MAX_REFERENCES

  useEffect(() => { if (selection?.kind === 'camera') setTab('camera'); else if (selection) setTab('selection') }, [selection])
  useEffect(() => { if (open) setTab('selection') }, [open])

  useEffect(() => {
    if (!open) return
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = true
      if (isTyping(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (mod || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'w') setGizmoMode('translate')
      else if (k === 'e') setGizmoMode('rotate')
      else if (k === 'r') setGizmoMode('scale')
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useReferenceSceneStore.getState().selection
        if (sel?.kind === 'figure') { editScene(s => { s.figures = s.figures.filter(f => f.id !== sel.id) }); select(null) }
        if (sel?.kind === 'prop') { editScene(s => { s.props = s.props.filter(p => p.id !== sel.id) }); select(null) }
      }
    }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false }
    const blur = () => { shiftRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [open, undo, redo, setGizmoMode, select])

  if (!open || !draft) return null

  const addFigure = () => {
    if (!canAddFigure(draft)) { onNotice(t('figures-full', { max: MAX_FIGURES })); return }
    const fig = createFigure(draft.figures, nextFigurePosition(draft.figures))
    editScene(s => { s.figures.push(fig) })
    select({ kind: 'figure', id: fig.id })
  }
  const addProp = (kind: PropKind) => {
    const prop = createProp(kind)
    editScene(s => { s.props.push(prop) })
    select({ kind: 'prop', id: prop.id })
  }

  const use = async (asNew: boolean) => {
    const handle = renderRef.current
    if (!handle || busy) return
    setBusy(true)
    try {
      const [w, h] = renderSize(aspectRatio)
      const blob = await handle.capture(draft, w, h)
      if (useReferenceSceneStore.getState().dialog !== dialog) return
      const url = URL.createObjectURL(blob)
      const composer = useComposerStore.getState()
      if (editing && !asNew) {
        const old = composer.references.find(r => r.id === editing)
        saveScene(draft)
        composer.replaceReference(editing, { url, mediaId: undefined })
        if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url)
      } else {
        const scene = asNew ? cloneScene(draft, newId('scene')) : draft
        if (composer.references.length >= MAX_REFERENCES) { onNotice(t('references-full', { max: MAX_REFERENCES })); URL.revokeObjectURL(url); return }
        saveScene(scene)
        composer.addReference({ id: newId('ref'), source: 'scene', sceneId: scene.id, url, name: t('scene-reference') })
      }
      close()
    } catch (err) {
      onNotice(t('render-failed', { message: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const selFigure = selection?.kind === 'figure' || selection?.kind === 'joint' ? findFigure(draft, selection.kind === 'figure' ? selection.id : selection.figureId) : undefined
  const selProp = selection?.kind === 'prop' ? findProp(draft, selection.id) : undefined
  const modes: { mode: GizmoMode; icon: typeof Move3d; key: string }[] = [
    { mode: 'translate', icon: Move3d, key: 'W' },
    { mode: 'rotate', icon: Rotate3d, key: 'E' },
    { mode: 'scale', icon: Scale3d, key: 'R' },
  ]

  const rail = (
    <div className={cn('flex gap-1', isMobile ? 'flex-row items-center overflow-x-auto border-b px-2 py-1.5' : 'flex-col items-center border-r px-1.5 py-2')}>
      <RailButton label={t('add-figure')} onClick={addFigure} disabled={!canAddFigure(draft)}><UserPlus /></RailButton>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t('add-prop')}><Box /></Button></DropdownMenuTrigger></TooltipTrigger>
          <TooltipContent side="right">{t('add-prop')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="start">
          {(Object.keys(PROP_ICONS) as PropKind[]).map(k => { const Icon = PROP_ICONS[k]; return <DropdownMenuItem key={k} onSelect={() => addProp(k)}><Icon />{t(`prop.${k}`)}</DropdownMenuItem> })}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className={cn('bg-border', isMobile ? 'mx-1 h-5 w-px' : 'my-1 h-px w-5')} />
      {modes.map(({ mode, icon: Icon, key }) => (
        <RailButton key={mode} label={`${t(`gizmo.${mode}`)} (${key})`} active={gizmoMode === mode} onClick={() => setGizmoMode(mode)}><Icon /></RailButton>
      ))}
      <div className={cn('bg-border', isMobile ? 'mx-1 h-5 w-px' : 'my-1 h-px w-5')} />
      <RailButton label={lookThrough ? t('stop-looking-through') : t('look-through')} active={lookThrough} onClick={() => setLookThrough(!lookThrough)}><Eye /></RailButton>
    </div>
  )

  const panel = (
    <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList className="mx-3 mt-3 grid w-auto grid-cols-2">
        <TabsTrigger value="selection">{t('tab-selection')}</TabsTrigger>
        <TabsTrigger value="camera">{t('tab-camera')}</TabsTrigger>
      </TabsList>
      <TabsContent value="selection" className="min-h-0 flex-1 overflow-y-auto">
        {selection?.kind === 'joint' && selFigure ? <JointPanel fig={selFigure} joint={selection.joint} />
          : selFigure ? <FigurePanel fig={selFigure} />
          : selProp ? <PropPanel prop={selProp} />
          : <ScenePanel scene={draft} />}
      </TabsContent>
      <TabsContent value="camera" className="min-h-0 flex-1 overflow-y-auto"><CameraPanel camera={draft.camera} aspect={aspect} /></TabsContent>
    </Tabs>
  )

  return (
    <Dialog open onOpenChange={o => { if (!o) close() }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={e => { if (useReferenceSceneStore.getState().selection) { e.preventDefault(); select(null) } else if (canUndo) e.preventDefault() }}
        onInteractOutside={e => e.preventDefault()}
        className={cn('flex flex-col gap-0 overflow-hidden p-0', isMobile ? 'h-dvh w-screen max-w-none rounded-none' : 'h-[90vh] w-[94vw] max-w-[1600px] sm:max-w-[1600px]')}
      >
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <DialogTitle className="text-sm font-semibold">{editing ? t('title-edit') : t('title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('description')}</DialogDescription>
          <span className="hidden text-xs text-muted-foreground md:inline">{t('output-hint', { ratio: aspectRatio, size: renderSize(aspectRatio).join('×') })}</span>
          <div className="flex-1" />
          {!isMobile && (
            <div className="flex rounded-lg border p-0.5">
              <Button variant={draft.layout === 'single' ? 'secondary' : 'ghost'} size="xs" onClick={() => editScene(s => { s.layout = 'single' })}><RectangleHorizontal />{t('layout-single')}</Button>
              <Button variant={draft.layout === 'four' ? 'secondary' : 'ghost'} size="xs" onClick={() => editScene(s => { s.layout = 'four' })}><LayoutGrid />{t('layout-four')}</Button>
            </div>
          )}
          <Button variant="ghost" size="icon-sm" aria-label={t('undo')} disabled={!canUndo} onClick={undo}><Undo2 /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('redo')} disabled={!canRedo} onClick={redo}><Redo2 /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('cancel')} onClick={close}><X /></Button>
        </header>

        <div className={cn('flex min-h-0 flex-1', isMobile ? 'flex-col' : 'flex-row')}>
          {rail}
          <div className={cn('relative min-w-0', isMobile ? 'h-[52dvh] flex-none' : 'flex-1')}>
            <Viewports aspect={aspect} shiftRef={shiftRef} renderRef={renderRef} forceSingle={isMobile} />
          </div>
          <aside className={cn('flex min-h-0 flex-col', isMobile ? 'flex-1 border-t' : 'w-80 flex-none border-l')}>{panel}</aside>
        </div>

        <footer className="flex items-center gap-2 border-t px-3 py-2">
          <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">{t('footer-hint')}</span>
          <div className="flex-1 sm:hidden" />
          <Button variant="ghost" size="sm" onClick={close}>{t('cancel')}</Button>
          {editing && <Button variant="outline" size="sm" disabled={busy || full} onClick={() => void use(true)}>{t('save-as-new')}</Button>}
          <Button size="sm" disabled={busy || (!editing && full)} onClick={() => void use(false)}>
            {busy && <Loader2 className="animate-spin" />}{editing ? t('update-reference') : t('use-as-reference')}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
