import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChefHat, Layers, Upload, Images, BookmarkCheck, ChevronDown, ArrowUp, Loader2, Check, Store, PersonStanding } from 'lucide-react'
import { cn } from 'cn'
import { useComposerStore } from '@/store/composerStore'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { findModel, models, recentModelVersionIds, recommendedModelVersionIds } from '@/mock/data'
import { modelTypeLabel } from '@/types'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { MediaImg } from './shared/MediaImg'
import type { PickerTarget } from './pickers/types'

interface Props {
  actions?: React.ReactNode
  submitLabel: string
  canSubmit: boolean
  sending: boolean
  onSubmit: () => void
  onOpen: (target: PickerTarget) => void
  onFiles: (files: FileList | File[]) => void
}

type MenuEntry = { type: 'item'; key: string; label: React.ReactNode; icon?: React.ReactNode; onSelect: () => void; muted?: boolean } | { type: 'label'; key: string; label: string } | { type: 'separator'; key: string }

/** Dropdown on desktop, bottom sheet on mobile; same entries either way. */
function ResponsiveMenu({ trigger, title, entries, align }: { trigger: React.ReactNode; title: string; entries: MenuEntry[]; align: 'start' | 'end' }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left"><DrawerTitle>{title}</DrawerTitle><DrawerDescription className="sr-only">{title}</DrawerDescription></DrawerHeader>
          <div className="px-2 pb-8">
            {entries.map(e =>
              e.type === 'separator' ? <div key={e.key} className="my-1 border-t" /> :
              e.type === 'label' ? <div key={e.key} className="px-3 pt-2 pb-1 text-xs text-muted-foreground">{e.label}</div> :
              <button key={e.key} type="button" onClick={() => { setOpen(false); e.onSelect() }} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm active:bg-muted [&_svg]:size-4', e.muted && 'text-muted-foreground')}>{e.icon}{e.label}</button>,
            )}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side="top" className="w-64">
        {entries.map(e =>
          e.type === 'separator' ? <DropdownMenuSeparator key={e.key} /> :
          e.type === 'label' ? <DropdownMenuLabel key={e.key} className="text-xs text-muted-foreground">{e.label}</DropdownMenuLabel> :
          <DropdownMenuItem key={e.key} onSelect={e.onSelect} className={cn('gap-2.5', e.muted && 'text-muted-foreground')}>{e.icon}{e.label}</DropdownMenuItem>,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BottomBar({ actions, submitLabel, canSubmit, sending, onSubmit, onOpen, onFiles }: Props) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const modelVersionId = useComposerStore(s => s.modelVersionId)
  const setModel = useComposerStore(s => s.setModel)
  const savedModel = useComposerStore(s => s.promptContext?.model)
  const catalogModel = findModel(modelVersionId)
  const model = catalogModel ?? (savedModel?.versionId === modelVersionId ? savedModel : undefined)

  const modelEntry = (versionId: string): MenuEntry | null => {
    const m = findModel(versionId)
    if (!m) return null
    return {
      type: 'item', key: versionId, onSelect: () => setModel(versionId),
      icon: <MediaImg src={m.cover} seed={m.id} className="size-7 rounded-md" />,
      label: <span className="flex min-w-0 flex-1 items-center gap-2"><span className="flex-1 truncate">{m.title}</span><span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{modelTypeLabel(m.type)}</span>{versionId === modelVersionId && <Check className="size-4 text-primary" />}</span>,
    }
  }
  const addEntries: MenuEntry[] = [
    { type: 'item', key: 'recipe', icon: <ChefHat />, label: t('add-recipe'), onSelect: () => onOpen('recipes') },
    { type: 'item', key: 'lora', icon: <Layers />, label: t('add-lora'), onSelect: () => onOpen('loras') },
    { type: 'separator', key: 's1' },
    { type: 'item', key: 'upload', icon: <Upload />, label: t('upload-reference'), onSelect: () => fileRef.current?.click() },
    { type: 'item', key: 'library', icon: <Images />, label: t('choose-from-library'), onSelect: () => onOpen('references') },
    { type: 'item', key: 'scene', icon: <PersonStanding />, label: t('pose-a-scene'), onSelect: () => useReferenceSceneStore.getState().openNew() },
    { type: 'separator', key: 's2' },
    { type: 'item', key: 'preset', icon: <BookmarkCheck />, label: t('load-preset'), onSelect: () => onOpen('presets') },
  ]
  const modelEntries: MenuEntry[] = [
    { type: 'label', key: 'rec', label: t('recommended') },
    ...recommendedModelVersionIds.map(modelEntry).filter((e): e is MenuEntry => e !== null),
    { type: 'separator', key: 's1' },
    { type: 'label', key: 'recent', label: t('recently-used') },
    ...recentModelVersionIds.filter(id => !recommendedModelVersionIds.includes(id)).map(modelEntry).filter((e): e is MenuEntry => e !== null),
    { type: 'separator', key: 's2' },
    { type: 'item', key: 'browse', icon: <Store />, label: t('browse-all-models', { count: models.length }), onSelect: () => onOpen('models'), muted: true },
  ]

  return (
    <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = '' }} />
      <ResponsiveMenu align="start" title={t('add')} entries={addEntries}
        trigger={<Button variant="ghost" size="icon" className="rounded-full" aria-label={t('add')}><Plus /></Button>} />

      {actions}
      <div className="flex-1" />

      <ResponsiveMenu align="end" title={t('model')} entries={modelEntries}
        trigger={
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-full px-2 text-sm font-normal">
            {catalogModel && <MediaImg src={catalogModel.cover} seed={catalogModel.id} className="size-5 rounded-full" />}
            <span className="max-w-36 truncate">{model?.title ?? t('model')}</span>
            {model && <span className="text-xs text-muted-foreground">{modelTypeLabel(model.type)}</span>}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        } />

      <Button size="sm" className="rounded-full px-4" disabled={!canSubmit || sending} onClick={onSubmit}>
        {sending ? <Loader2 className="animate-spin" /> : <ArrowUp />}{submitLabel}
      </Button>
    </div>
  )
}
