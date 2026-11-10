import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookmarkCheck } from 'lucide-react'
import { useComposerStore } from '@/store/composerStore'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { findModel, rememberRecipes, presets } from '@/mock/data'
import type { Preset } from '@/types'
import { ResponsiveDialog } from '../shared/ResponsiveDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function PresetPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Preset | null>(null)
  const loadPreset = useComposerStore(s => s.loadPreset)
  const presetId = useComposerStore(s => s.presetId)
  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={t('load-preset')} className="sm:max-w-lg">
        <ul className="space-y-2">
          {presets.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => setPending(p)} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left hover:bg-muted" aria-current={presetId === p.id}>
                <BookmarkCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium">{p.title}</div>
                  <div className="line-clamp-2 text-sm text-muted-foreground">{p.prompt}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{findModel(p.modelVersionId)?.title} · {p.params.aspectRatio} · {p.params.size} · ×{p.params.batchSize}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </ResponsiveDialog>
      <Dialog open={pending !== null} onOpenChange={o => !o && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('preset-confirm-title', { title: pending?.title })}</DialogTitle>
            <DialogDescription>{t('preset-confirm-body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>{t('cancel')}</Button>
            <Button onClick={() => {
              if (pending) {
                useReferenceSceneStore.getState().close()
                useReferenceSceneStore.setState({ scenes: structuredClone(pending.snapshot?.scenes ?? {}) })
                rememberRecipes(pending.snapshot?.recipeMetadata ?? [])
                loadPreset(pending)
              }
              setPending(null); onOpenChange(false)
            }}>{t('confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
