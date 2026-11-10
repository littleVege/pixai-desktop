import { Extension, mergeAttributes } from '@tiptap/react'
import Mention from '@tiptap/extension-mention'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { REFERENCE_MENTION } from '@/lib/promptSerialize'
import { suggestionRenderer } from './suggestionStore'

/** Inline atom pointing at one attached Reference. Rendered as a chip with the thumbnail and "@1". */
export const ReferenceMention = Mention.extend({
  name: REFERENCE_MENTION,
  addAttributes() {
    return {
      refId: { default: null, parseHTML: el => el.getAttribute('data-ref-id'), renderHTML: a => ({ 'data-ref-id': a.refId }) },
      label: { default: '', parseHTML: el => el.getAttribute('data-label'), renderHTML: a => ({ 'data-label': a.label }) },
      url: { default: '', parseHTML: el => el.getAttribute('data-url'), renderHTML: a => ({ 'data-url': a.url }) },
    }
  },
  parseHTML() {
    return [{ tag: `span[data-type="${REFERENCE_MENTION}"]` }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-type': REFERENCE_MENTION, class: 'reference-mention' }, HTMLAttributes),
      ['img', { src: node.attrs.url, alt: '' }],
      `@${node.attrs.label}`,
    ]
  },
  renderText({ node }) {
    return `@${node.attrs.label}`
  },
}).configure({
  suggestion: {
    char: '@',
    pluginKey: new PluginKey('referenceSuggestion'),
    allowSpaces: false,
    render: suggestionRenderer('at'),
  },
})

/** "/" opens the recipe + LoRA command menu. The command only removes the typed "/query"; the menu does the rest. */
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        pluginKey: new PluginKey('slashSuggestion'),
        allowSpaces: false,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run()
        },
        render: suggestionRenderer('slash'),
      }),
    ]
  },
})
