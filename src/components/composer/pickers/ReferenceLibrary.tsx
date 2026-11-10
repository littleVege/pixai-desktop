import { useTranslation } from 'react-i18next'
import { useComposerStore } from '@/store/composerStore'
import { generations, uploads } from '@/mock/data'
import { MAX_REFERENCES, type LibraryImage } from '@/types'
import { ResponsiveDialog } from '../shared/ResponsiveDialog'
import { PickerCard, PickerGrid } from './PickerGrid'
import { SelectedStrip } from './SelectedStrip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ReferenceLibrary({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const references = useComposerStore(s => s.references)
  const addReference = useComposerStore(s => s.addReference)
  const removeReference = useComposerStore(s => s.removeReference)
  const full = references.length >= MAX_REFERENCES

  const toggle = (img: LibraryImage) => {
    if (references.some(r => r.id === img.id)) removeReference(img.id)
    else addReference({ id: img.id, url: img.url, mediaId: img.mediaId, source: img.source === 'generation' ? 'generation' : 'library', name: img.prompt })
  }
  const grid = (items: LibraryImage[]) => (
    <PickerGrid cols={5}>
      {items.map(img => {
        const idx = references.findIndex(r => r.id === img.id)
        return <PickerCard key={img.id} cover={img.url} seed={img.id} title={idx >= 0 ? `@${idx + 1}` : img.prompt?.slice(0, 40) || img.id} aspect="square" selected={idx >= 0} disabled={idx < 0 && full} onClick={() => toggle(img)} />
      })}
    </PickerGrid>
  )

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={t('references')}
      toolbar={<SelectedStrip max={MAX_REFERENCES} onRemove={removeReference} avatar="square"
        items={references.map((r, i) => ({ id: r.id, cover: r.url, name: `@${i + 1}`, meta: r.name ? r.name.slice(0, 18) : undefined }))} />}>
      <Tabs defaultValue="uploads">
        <TabsList className="mb-3">
          <TabsTrigger value="uploads">{t('uploads')}</TabsTrigger>
          <TabsTrigger value="generations">{t('generations')}</TabsTrigger>
        </TabsList>
        <TabsContent value="uploads">{grid(uploads)}</TabsContent>
        <TabsContent value="generations">{grid(generations)}</TabsContent>
      </Tabs>
    </ResponsiveDialog>
  )
}
