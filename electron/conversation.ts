import type { StudioStore } from './store'

/** Read the same work-scoped messages and versions as the conversation view. */
export function conversationPage(store: StudioStore, workId: string, before?: string, limit = 20) {
  const messages = store.list('message', workId).reverse().filter(item => item.data.type !== 'tool')
  const events = [...messages, ...store.list('revision', workId).reverse(), ...store.list('asset', workId).reverse().filter(item => item.data.source === 'generation')]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const end = before ? events.findIndex(event => event.id === before) : events.length
  if (end < 0) throw new Error('未找到当前会话的历史位置')
  const start = Math.max(0, end - limit)
  const page = events.slice(start, end)
  return {
    earlierThan: start ? page[0].id : null,
    events: page.map(event => {
      const { id, kind, createdAt, data } = event
      if (kind === 'revision') {
        const request = data.request as Record<string, unknown> | undefined
        return { id, kind, createdAt, prompt: String(request?.prompt ?? '').slice(0, 2500), modelVersionId: request?.modelVersionId, explanation: data.explanation }
      }
      if (kind === 'asset') return { id, kind: 'generatedImage', createdAt, revisionId: data.revisionId, width: data.width, height: data.height }
      if (data.type === 'resultSelection') return { id, kind: data.type, role: data.role, text: data.text, assetId: data.assetId, revisionId: data.revisionId }
      if (data.type === 'promptFeedback') return { id, kind: data.type, role: data.role, action: data.action, prompt: String(data.after ?? '').slice(0, 2500) }
      if (data.type === 'saveProposal') return { id, kind: data.type, target: data.target, status: data.status, text: data.text }
      return { id, kind: data.type ?? 'message', createdAt, role: data.role, runId: data.runId, text: String(data.text ?? '').slice(0, 2500) }
    }),
  }
}
