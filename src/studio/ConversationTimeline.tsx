import { useLayoutEffect, useRef } from 'react'
import { Play, Square, UserRound, Sparkles, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentMessage } from './AgentMessage'
import { GenerationTasks } from './GenerationTasks'
import { assetUrl, studio, type StudioEntity, type StudioSnapshot } from './api'

const statuses: Record<string, string> = { planning: '准备中', executing: '提交中', waiting: '等待生成', inspecting: '检查画面', paused: '已暂停', completed: '已完成', failed: '失败' }

export function ConversationTimeline({ data, onChange, onResume, onError, onPreview }: {
  data: StudioSnapshot
  onChange: () => Promise<void>
  onResume: (runId: string) => Promise<void>
  onError: (error: unknown) => void
  onPreview: (asset: StudioEntity) => void
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const events = [...data.messages.slice().reverse(), ...data.revisions.slice().reverse(), ...data.assets.slice().reverse().filter(asset => asset.data.source === 'generation')]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  useLayoutEffect(() => {
    if (following.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [data])
  return <div ref={scroll} className="conversation-scroll" role="region" aria-label="会话时间线" onScroll={event => {
    const node = event.currentTarget
    following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
  }}>
    {!events.length && <div className="conversation-empty">在下方写下第一个创作想法。</div>}
    <ol className="conversation-timeline">{events.map(event => {
      const revisionJobs = event.kind === 'revision' ? data.jobs.filter(job => job.data.revisionId === event.id) : []
      const manual = event.kind === 'revision' && revisionJobs.length > 0 && revisionJobs.every(job => !job.data.runId)
      const user = event.data.role === 'user' || manual
      const run = user && event.data.type !== 'resume' ? data.runs.find(item => item.id === event.data.runId) : undefined
      const jobIds = run && new Set(data.jobs.filter(job => job.data.runId === run.id).map(job => job.id))
      const selectedAsset = event.data.type === 'resultSelection' && data.assets.find(asset => asset.id === event.data.assetId)
      const output = event.kind === 'asset'
      const label = output ? '生成结果' : manual ? '你 · 直接生成' : user ? '你' : event.kind === 'revision' ? 'PixAI Agent · 生成版本' : 'PixAI Agent'
      const RoleIcon = user ? UserRound : output ? ImageIcon : Sparkles
      return <li key={event.id} className={user ? 'conversation-user' : output ? 'conversation-output' : 'conversation-assistant'}>
        <header><span className="message-author"><RoleIcon aria-hidden="true" /><b>{label}</b></span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></header>
        {event.kind === 'message' && <AgentMessage message={event} onError={onError} />}
        {selectedAsset && <button className="mt-2 block" aria-label="查看选中的生成原图" onClick={() => onPreview(selectedAsset)}>
          <img className="size-16 rounded-md object-cover" src={assetUrl(selectedAsset.data.filename)} alt="选中的生成结果" />
        </button>}
        {run && <div className="conversation-run"><span>{statuses[run.data.status] ?? run.data.status} · {run.data.imagesSpent ?? 0}/{run.data.maxImages} 张 · {run.data.modelCalls ?? 0}/{run.data.maxModelCalls} 次调用</span>
          {run.data.status === 'paused' && <span>{run.data.reason}</span>}
          <details><summary>用量明细</summary>
            <p>提交 {run.data.imagesSpent ?? 0} 张 · 已保存 {data.assets.filter(asset => asset.data.source === 'generation' && jobIds?.has(asset.data.jobId)).length} 张</p>
            <p>模型输入 {run.data.inputTokens ?? '未知'} tokens · 输出 {run.data.outputTokens ?? '未知'} tokens</p>
            <p>PixAI 积分消耗未知</p>
          </details>
          {!['completed', 'failed'].includes(run.data.status) && <Button variant="outline" size="sm" onClick={() => void (run.data.status === 'paused' ? onResume(run.id) : studio.pauseRun({ runId: run.id })).then(onChange).catch(onError)}>
            {run.data.status === 'paused' ? <Play /> : <Square />}{run.data.status === 'paused' ? '按当前草稿继续' : '停止'}</Button>}
        </div>}
        {event.kind === 'revision' && <><p className="conversation-prompt">{event.data.request?.prompt}</p>
          {event.data.explanation && <p>{event.data.explanation}</p>}
          <GenerationTasks jobs={revisionJobs} onChange={onChange} /></>}
        {event.kind === 'asset' && <button className="conversation-image" onClick={() => onPreview(event)} aria-label="查看这张生成原图"><img src={assetUrl(event.data.filename, true)} alt="本次生成结果" /></button>}
      </li>
    })}</ol>
  </div>
}
