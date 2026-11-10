import { useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { useComposerStore } from '@/store/composerStore'
import { useSuggestionStore } from './suggestionStore'
import { ReferenceMention, SlashCommand } from './extensions'
import { REFERENCE_MENTION, docIsEmpty, promptToDoc } from '@/lib/promptSerialize'
import type { RecommendedPrompt } from '@/lib/recommend'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  placeholder?: string
  onSubmit: () => void
  /** Shown while the editor is empty; Tab (or the Use button on touch) fills it in. */
  recommendation?: RecommendedPrompt
  onNextRecommendation?: () => void
}

export function Editor({ placeholder, onSubmit, recommendation, onNextRecommendation }: Props) {
  const { t, i18n } = useTranslation()
  const placeholderRef = useRef(placeholder)
  placeholderRef.current = placeholder
  const recommendationRef = useRef(recommendation)
  recommendationRef.current = recommendation
  const isMobile = useIsMobile()
  const onSubmitRef = useRef(onSubmit)
  const isMobileRef = useRef(isMobile)
  onSubmitRef.current = onSubmit
  isMobileRef.current = isMobile

  const setDoc = useComposerStore(s => s.setDoc)
  const references = useComposerStore(s => s.references)
  const pendingInsert = useComposerStore(s => s.pendingInsert)
  const consumeInsert = useComposerStore(s => s.consumeInsert)
  const docRevision = useComposerStore(s => s.docRevision)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, bold: false, italic: false, strike: false, code: false, codeBlock: false, blockquote: false,
        bulletList: false, orderedList: false, listItem: false, horizontalRule: false, link: false, underline: false,
        dropcursor: false, gapcursor: false,
      }),
      Placeholder.configure({ placeholder: () => (recommendationRef.current ? '' : placeholderRef.current ?? i18next.t('placeholder')) }),
      ReferenceMention,
      SlashCommand,
    ],
    content: useComposerStore.getState().doc,
    editorProps: {
      attributes: { class: 'tiptap max-h-[40vh] min-h-14 overflow-y-auto px-4 py-3 text-[15px] leading-6' },
      handleKeyDown: (view, event) => {
        if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey && !useSuggestionStore.getState().kind) {
          const rec = recommendationRef.current
          const empty = view.state.doc.childCount === 1 && view.state.doc.firstChild?.content.size === 0
          if (rec && empty) {
            event.preventDefault()
            fillRef.current(rec.text)
            return true
          }
        }
        if (event.key === 'Enter' && !event.shiftKey && !isMobileRef.current && !useSuggestionStore.getState().kind) {
          event.preventDefault()
          onSubmitRef.current()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => setDoc(editor.getJSON()),
  })

  const fillRef = useRef((_text: string) => {})
  fillRef.current = (text: string) => {
    if (!editor) return
    editor.chain().setContent(promptToDoc(text)).focus('end').run()
  }

  const doc = useComposerStore(s => s.doc)
  const showGhost = !!recommendation && docIsEmpty(doc)

  // Placeholder text follows the recommendation; the ghost needs room for two lines plus the hint row.
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(editor.state.tr)
    editor.view.dom.style.minHeight = showGhost ? '6rem' : ''
  }, [editor, showGhost])

  // Placeholder text follows the locale.
  useEffect(() => { editor?.view.dispatch(editor.state.tr) }, [editor, i18n.language, placeholder])

  // External replacement of the whole doc (preset load, reset).
  useEffect(() => {
    if (!editor || docRevision === 0) return
    editor.commands.setContent(useComposerStore.getState().doc, { emitUpdate: false })
  }, [editor, docRevision])

  // Insert text requested by other parts of the composer (e.g. LoRA trigger words).
  useEffect(() => {
    if (!editor || !pendingInsert) return
    const text = editor.getText()
    const sep = text.length === 0 || /[\s,]$/.test(text) ? '' : ', '
    editor.chain().focus('end').insertContent(`${sep}${pendingInsert}`).run()
    consumeInsert()
  }, [editor, pendingInsert, consumeInsert])

  // A removed Reference takes its Mentions with it; renumber the rest.
  useEffect(() => {
    if (!editor) return
    const alive = new Map(references.map((r, i) => [r.id, { label: String(i + 1), url: r.url }]))
    const tr = editor.state.tr
    let changed = false
    const ranges: { from: number; to: number }[] = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== REFERENCE_MENTION) return
      const ref = alive.get(String(node.attrs.refId))
      if (!ref) ranges.push({ from: pos, to: pos + node.nodeSize })
      else if (ref.label !== node.attrs.label || ref.url !== node.attrs.url) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...ref }); changed = true }
    })
    for (const r of ranges.reverse()) { tr.delete(r.from, r.to); changed = true }
    if (changed) editor.view.dispatch(tr)
  }, [editor, references])

  return (
    <div className="relative flex-1">
      <EditorContent editor={editor} />
      {showGhost && recommendation && (
        <div className="pointer-events-none absolute inset-x-0 top-0 px-4 py-3 text-[15px] leading-6">
          <p className="line-clamp-2 whitespace-pre-line text-muted-foreground">{recommendation.text}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground/80">
            {isMobile ? (
              <button type="button" onClick={() => fillRef.current(recommendation.text)}
                className="pointer-events-auto rounded-md border bg-background px-2 py-0.5 font-medium text-foreground">{t('suggest-use')}</button>
            ) : (
              <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1.5 font-sans text-[11px] font-medium text-foreground">Tab</kbd>{t('suggest-tab')}</span>
            )}
            <span>·</span>
            <span>{recommendation.source === 'history' ? t('suggest-from-history') : t('suggest-curated')}</span>
            {onNextRecommendation && (
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={onNextRecommendation} aria-label={t('suggest-next')} title={t('suggest-next')}
                className="pointer-events-auto rounded p-0.5 hover:bg-muted hover:text-foreground"><RefreshCw className="size-3" /></button>
            )}
            <span className="ml-auto hidden sm:inline">{t('slash-hint')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
