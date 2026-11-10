import { reportError } from './Notices'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { studio, type StudioEntity } from './api'

const labels: Record<string, string> = { selecting: '等待选图', submitting: '正在提交', waiting: '等待生成', pending: '排队中', running: '生成中', processing: '生成中', completed: '保存图片', failed: '任务未完成', unknown: '提交结果不明' }
export function GenerationTasks({ jobs, onChange }: { jobs: StudioEntity[]; onChange: () => Promise<void> }) {
  const [selected, setSelected] = useState<StudioEntity | null>(null)
  const [remoteId, setRemoteId] = useState('')
  const [busy, setBusy] = useState(false)
  async function resolve(action: 'link' | 'stopTracking') {
    if (!selected) return
    setBusy(true)
    try {
      await studio.reconcileJob(action === 'link' ? { jobId: selected.id, action, remoteId } : { jobId: selected.id, action })
      await onChange()
      setSelected(null)
    } catch (e) { reportError(e) } finally { setBusy(false) }
  }
  return <>
    {jobs.filter(job => job.data.saveStatus !== 'saved').map(job => <div className="job-row" key={job.id}>
      <span>{job.data.resolution === 'tracking-stopped' ? '已结束本地跟踪' : labels[job.data.status] ?? job.data.status}</span>
      <div className="min-w-0 flex-1">
        {job.data.error && <p>{job.data.error}</p>}
        {job.data.remoteId && <details><summary className="cursor-pointer">远程任务 <span className="select-all font-mono">{job.data.remoteId}</span></summary>
          <p>提交于 {new Date(job.createdAt).toLocaleString()}</p>
          {job.data.remoteUpdatedAt && <p>平台更新于 {new Date(job.data.remoteUpdatedAt).toLocaleString()}</p>}
          {job.data.checkedAt && <p>客户端查询于 {new Date(job.data.checkedAt).toLocaleString()}</p>}
        </details>}
      </div>
      {(job.data.status === 'unknown' || job.data.resolution === 'tracking-stopped') && <Button variant="outline" size="sm" onClick={() => { setSelected(job); setRemoteId('') }}>核实任务</Button>}
    </div>)}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !busy) setSelected(null) }}>
      <DialogContent><DialogHeader><DialogTitle>核实提交结果</DialogTitle><DialogDescription>提交连接中断不代表生成失败。请在 PixAI 核对这次请求；已提交张数仍计入额度。</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">提交时间：{selected ? new Date(selected.createdAt).toLocaleString() : ''}</p>
        <p className="max-h-24 overflow-auto whitespace-pre-wrap text-sm">{selected?.data.request?.prompt}</p>
        <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void resolve('link') }}>
          <label className="flex flex-col gap-2 text-sm">对应的远程任务 ID<Input value={remoteId} inputMode="numeric" pattern="[0-9]+" required onChange={e => setRemoteId(e.target.value)} /></label>
          <Button type="submit" disabled={busy || !remoteId.trim()}>{busy ? '正在核实…' : '关联并恢复查询、下载'}</Button>
        </form>
        <p className="text-sm text-muted-foreground">如果无法找到对应任务，可以结束本地跟踪。此操作不会取消远程生成，也不会返还额度；以后找到任务 ID 仍可关联。</p>
        <Button variant="outline" disabled={busy || selected?.data.resolution === 'tracking-stopped'} onClick={() => void resolve('stopTracking')}>结束本地跟踪，保留额度消耗</Button>
      </DialogContent>
    </Dialog>
  </>
}
