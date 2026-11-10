import { StudioStore } from './store'

const names: Record<string, string> = { propose_save: '准备保存建议', search_presets: '查找生成预设', read_conversation: '读取较早对话', inspect_previous_images: '查看会话中的原图', search_models: '查找模型与 LoRA', generate_candidates: '提交生成候选', wait_for_generations: '等待生成结果', inspect_images: '检查生成图片' }
/** Durable user-visible text and tool activity. Model reasoning is never collected. */
export class RunJournal {
  private texts = new Map<string, { id: string; text: string; flushedAt: number }>()
  private tools = new Set<string>()
  constructor(private store: StudioStore, private runId: string, private workId: string, private changed: () => void, private redact: (text: string) => string = text => text) {}
  text(segment: string, delta: string) {
    let entry = this.texts.get(segment)
    if (!entry) {
      const message = this.store.create('message', { role: 'assistant', runId: this.runId, type: 'reply', text: '', status: 'streaming' }, this.workId)
      entry = { id: message.id, text: '', flushedAt: 0 }; this.texts.set(segment, entry)
    }
    entry.text += delta
    if (Date.now() - entry.flushedAt >= 150) {
      this.store.update(entry.id, { text: this.redact(entry.text) }); entry.flushedAt = Date.now(); this.changed()
    }
  }
  finishText(segment: string) {
    const entry = this.texts.get(segment)
    if (!entry) return
    this.store.update(entry.id, { text: this.redact(entry.text), status: 'complete' })
    this.texts.delete(segment); this.changed()
  }
  startTool(id: string, name: string, input: unknown) {
    const messageId = `${this.runId}:tool:${id}`
    const serialized = this.redact(JSON.stringify(input)).slice(0, 12000)
    const existing = this.store.get(messageId)
    if (existing) {
      if (existing.data.toolName !== name || existing.data.input !== serialized) throw new Error('工具调用 ID 对应的参数已改变')
      if (existing.data.status === 'complete') return
      this.store.update(messageId, { status: 'running' })
    } else this.store.create('message', { role: 'assistant', type: 'tool', runId: this.runId, toolName: name, text: names[name] ?? name, input: serialized, status: 'running' }, this.workId, messageId)
    this.tools.add(messageId); this.changed()
  }
  endTool(id: string, output: unknown, failed: boolean, durationMs: number) {
    const messageId = `${this.runId}:tool:${id}`
    if (!this.tools.has(messageId)) return
    this.store.update(messageId, { status: failed ? 'failed' : 'complete', result: this.redact(typeof output === 'string' ? output : JSON.stringify(output) ?? '').slice(0, 12000), durationMs })
    this.tools.delete(messageId); this.changed()
  }
  close(interrupted: boolean) {
    for (const entry of this.texts.values()) this.store.update(entry.id, { text: this.redact(entry.text), status: interrupted ? 'interrupted' : 'complete' })
    for (const id of this.tools) this.store.update(id, { status: 'interrupted' })
    this.texts.clear(); this.tools.clear(); this.changed()
  }
}
