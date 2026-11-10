import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { reportError } from './Notices'
import { studio, type StudioEntity } from './api'

export function pendingJobs(jobs: StudioEntity[]) {
  return jobs.filter(({ data }) => data.saveStatus !== 'saved' && data.resolution !== 'tracking-stopped'
    && !['failed', 'unknown'].includes(data.status))
}

function ExperimentChoice({ job }: { job: StudioEntity }) {
  const [busy, setBusy] = useState(false)
  const pick = async (choice: Parameters<typeof studio.chooseExperiment>[0]['choice']) => {
    setBusy(true)
    try { await studio.chooseExperiment({ jobId: job.id, choice }) }
    catch (error) { reportError(error) }
    finally { setBusy(false) }
  }
  return <section className="experiment-choice" aria-label="PixAI 选图">
    <strong>选择本次生成结果</strong>
    <div className="experiment-options">{(['left', 'right'] as const).map(side =>
      <button key={side} disabled={busy} onClick={() => void pick(side === 'left' ? 'picked_left' : 'picked_right')}>
        {(job.data.experiment?.[side] ?? []).map((media: { mediaId: string; mediaUrl?: string }) =>
          media.mediaUrl?.startsWith('https://') && <img key={media.mediaId} src={media.mediaUrl} alt={side === 'left' ? '候选 A' : '候选 B'} />)}
        {side === 'left' ? '选择 A' : '选择 B'}
      </button>)}</div>
    <div><Button size="sm" variant="ghost" disabled={busy} onClick={() => void pick('tie')}>都喜欢</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void pick('skip')}>跳过比较</Button></div>
  </section>
}

export function PendingImage({ job }: { job: StudioEntity }) {
  const { status, saveStatus, request } = job.data
  if (status === 'selecting') return <ExperimentChoice job={job} />
  const label = saveStatus === 'downloading' || status === 'completed' ? '正在保存图片'
    : status === 'submitting' ? '正在提交' : ['pending', 'waiting', 'queued'].includes(status) ? '等待生成' : '正在生成'
  return <div className="pending-image" role="status">
    <LoaderCircle aria-hidden="true" size={22} />
    <span>{label}{request?.batchSize > 1 && ` · ${request.batchSize} 张`}</span>
  </div>
}
