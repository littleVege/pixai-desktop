import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { reportError } from './Notices'
import { assetUrl, studio, type StudioEntity } from './api'

export function pendingJobs(jobs: StudioEntity[]) {
  return jobs.filter(({ data }) => data.saveStatus !== 'saved' && data.resolution !== 'tracking-stopped'
    && !['failed', 'unknown'].includes(data.status))
}

// Keep independently finishing siblings together until the round is ready to show.
export function visibleResults(assets: StudioEntity[], jobs: StudioEntity[]) {
  const unfinished = new Set(pendingJobs(jobs).map(job => job.data.revisionId))
  return assets.filter(asset => !unfinished.has(asset.data.revisionId))
}

function ExperimentChoice({ job }: { job: StudioEntity }) {
  const [busy, setBusy] = useState(false)
  const pick = async (choice: Parameters<typeof studio.chooseExperiment>[0]['choice']) => {
    setBusy(true)
    try { await studio.chooseExperiment({ jobId: job.id, choice }) }
    catch (error) { reportError(error) }
    finally { setBusy(false) }
  }
  const sides = ['left', 'right'] as const
  const ready = sides.every(side => job.data.experiment?.[side]?.length && job.data.experiment[side].every((m: { filename?: string }) => m.filename))
  return <section className="experiment-choice" aria-label="PixAI 选图">
    <strong>本轮候选图比较</strong>
    {ready ? <div className="experiment-options">{sides.map(side =>
      <button key={side} disabled={busy} onClick={() => void pick(side === 'left' ? 'picked_left' : 'picked_right')}>
        {job.data.experiment[side].map((media: { mediaId: string; filename: string }) =>
          <img key={media.mediaId} src={assetUrl(media.filename)} alt={side === 'left' ? '候选 A' : '候选 B'} />)}
        {side === 'left' ? '选择 A' : '选择 B'}
      </button>)}</div> : <p role="status">{job.data.error ? '预览暂不可用，正在重试' : '正在加载两张预览…'}</p>}
    <div><Button size="sm" variant="ghost" disabled={busy || !ready} onClick={() => void pick('tie')}>都喜欢</Button>
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
