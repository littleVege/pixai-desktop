import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'cn'
import { useComposerStore, selectState } from '@/store/composerStore'
import { buildSubmission, canSubmit as computeCanSubmit } from '@/lib/submission'
import { MAX_REFERENCES, type ComposerSubmission } from '@/types'
import { useIsMobile } from '@/hooks/useIsMobile'
import { recommendPrompts } from '@/lib/recommend'
import { findModel } from '@/mock/data'
import { curatedPrompts } from '@/mock/promptPool'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Editor } from './editor/Editor'
import { SuggestionMenu } from './editor/SuggestionMenu'
import { ReferenceRow } from './ReferenceRow'
import { ContextTray } from './tray/ContextTray'
import { BottomBar } from './BottomBar'
import { RecipePicker } from './pickers/RecipePicker'
import { LoraPicker } from './pickers/LoraPicker'
import { ReferenceLibrary } from './pickers/ReferenceLibrary'
import { PresetPicker } from './pickers/PresetPicker'
import { ModelBrowse } from './pickers/ModelBrowse'
import { ReferenceSceneDialog } from './reference-scene/ReferenceSceneDialog'
import type { PickerTarget } from './pickers/types'

interface Props {
  actions?: React.ReactNode
  review?: React.ReactNode
  onSubmit: (submission: ComposerSubmission) => void | Promise<void>
  disabled?: boolean
  agentMode?: boolean
  /** The user's past prompts, most recent first. Empty for a new user. */
  promptHistory?: string[]
  className?: string
}

export function Composer({ actions, review, onSubmit, disabled = false, agentMode = false, promptHistory = [], className }: Props) {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [sending, setSending] = useState(false)
  const submitting = useRef(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const doc = useComposerStore(s => s.doc)
  const recipeIds = useComposerStore(s => s.recipeIds)
  const addReference = useComposerStore(s => s.addReference)
  const canSubmit = !disabled && computeCanSubmit({ doc, recipeIds: agentMode ? [] : recipeIds })

  const modelType = useComposerStore(s => findModel(s.modelVersionId)?.type ?? '')
  const recommendations = useMemo(
    () => recommendPrompts({ history: promptHistory, curated: curatedPrompts, modelType, locale: i18n.language }),
    [promptHistory, modelType, i18n.language],
  )
  const [recIndex, setRecIndex] = useState(0)
  useEffect(() => setRecIndex(0), [recommendations])
  const recommendation = !agentMode && recommendations.length ? recommendations[recIndex % recommendations.length] : undefined

  const notify = useCallback((msg: string) => setNotice(msg), [])
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 2200)
    return () => clearTimeout(id)
  }, [notice])

  const submit = useCallback(async () => {
    if (!canSubmit || submitting.current) return
    submitting.current = true
    setSending(true)
    try {
      await onSubmit(buildSubmission(selectState(useComposerStore.getState())))
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      submitting.current = false
      setSending(false)
    }
  }, [canSubmit, onSubmit, notify])

  const addFiles = useCallback((files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const res = addReference({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url: URL.createObjectURL(file), source: 'upload', name: file.name })
      if (res === 'full') { notify(t('references-full', { max: MAX_REFERENCES })); break }
    }
  }, [addReference, notify, t])

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn('relative w-full', className)}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onPasteCapture={e => { const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); addFiles(files) } }}
      >
        <div className={cn('composer-shell relative flex flex-col', dragging && 'ring-2 ring-primary')}>
          <ContextTray onOpen={setPicker} />
          {review}
          <ReferenceRow />
          <Editor placeholder={agentMode ? '描述创作目标，或告诉 Agent 如何调整当前画面…' : undefined} onSubmit={submit} recommendation={recommendation} onNextRecommendation={recommendations.length > 1 ? () => setRecIndex(i => i + 1) : undefined} />
          <BottomBar actions={actions} submitLabel={agentMode ? '发送给 Agent' : '生成图片'} canSubmit={canSubmit} sending={sending} onSubmit={submit} onOpen={setPicker} onFiles={addFiles} />
          {dragging && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/80 text-sm font-medium">{t('drop-hint')}</div>}
        </div>
        {notice && <div className={cn('absolute left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs whitespace-nowrap text-background shadow', isMobile ? '-top-9' : '-bottom-10')}>{notice}</div>}
      </div>
      <SuggestionMenu onBrowse={setPicker} />
      <RecipePicker open={picker === 'recipes'} onOpenChange={o => !o && setPicker(null)} />
      <LoraPicker open={picker === 'loras'} onOpenChange={o => !o && setPicker(null)} />
      <ReferenceLibrary open={picker === 'references'} onOpenChange={o => !o && setPicker(null)} />
      <PresetPicker open={picker === 'presets'} onOpenChange={o => !o && setPicker(null)} />
      <ModelBrowse open={picker === 'models'} onOpenChange={o => !o && setPicker(null)} />
      <ReferenceSceneDialog onNotice={notify} />
    </TooltipProvider>
  )
}
