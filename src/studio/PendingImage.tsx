import { LoaderCircle } from 'lucide-react'
import type { StudioEntity } from './api'

export function pendingJobs(jobs: StudioEntity[]) {
  return jobs.filter(({ data }) => data.saveStatus !== 'saved' && data.resolution !== 'tracking-stopped'
    && !['failed', 'unknown'].includes(data.status))
}

export function PendingImage({ job }: { job: StudioEntity }) {
  const { status, saveStatus, request } = job.data
  const label = saveStatus === 'downloading' || status === 'completed' ? '正在保存图片'
    : status === 'submitting' ? '正在提交' : ['pending', 'waiting', 'queued'].includes(status) ? '等待生成' : '正在生成'
  return <div className="pending-image" role="status">
    <LoaderCircle aria-hidden="true" size={22} />
    <span>{label}{request?.batchSize > 1 && ` · ${request.batchSize} 张`}</span>
  </div>
}
