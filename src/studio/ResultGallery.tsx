import { PendingImage, pendingJobs } from './PendingImage'
import { useState } from 'react'
import { Download, History, Columns2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { assetUrl, studio, type StudioEntity } from './api'
import { findModel } from '@/mock/data'

export function ResultGallery({ preview, setPreview, assets, jobs, revisions, busy, onRestore, onError }: { preview: string[]; setPreview: (ids: string[]) => void; assets: StudioEntity[]; jobs: StudioEntity[]; revisions: StudioEntity[]; busy: boolean; onRestore: (revisionId: string, assetId: string) => Promise<void>; onError: (error: unknown) => void }) {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const revisionOrder = [...revisions].reverse()
  const version = (id: string) => `v${revisionOrder.findIndex(r => r.id === id) + 1}`
  const shown = assets.filter(asset => filter === 'all' || asset.data.revisionId === filter)
  const pending = pendingJobs(jobs).filter(job => filter === 'all' || job.data.revisionId === filter)
  const inspected = preview.map(id => assets.find(asset => asset.id === id)).filter((asset): asset is StudioEntity => !!asset)
  function toggle(id: string) {
    setSelected(ids => ids.includes(id) ? ids.filter(item => item !== id) : ids.length < 2 ? [...ids, id] : [ids[1], id])
  }
  return <>
    <div className="results-toolbar">
      <Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="按版本查看" className="w-44"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="all">全部版本 · {assets.length} 张</SelectItem>
        {revisionOrder.map(revision => <SelectItem key={revision.id} value={revision.id}>{version(revision.id)} · {assets.filter(a => a.data.revisionId === revision.id).length} 张</SelectItem>)}
      </SelectContent></Select>
      <Button variant="outline" disabled={selected.length !== 2} onClick={() => setPreview(selected)}><Columns2 data-icon="inline-start" />比较{selected.length ? ` (${selected.length}/2)` : ''}</Button>
      {!!selected.length && <Button variant="ghost" onClick={() => setSelected([])}>清除选择</Button>}
    </div>
    <div className="studio-image-grid">{pending.map(job => <PendingImage key={job.id} job={job} />)}{shown.map(asset => <figure key={asset.id}>
      <button className="result-preview" aria-label={`预览 ${version(asset.data.revisionId)} 图片`} onClick={() => setPreview([asset.id])}><img src={assetUrl(asset.data.filename, true)} alt={`${version(asset.data.revisionId)} 生成结果`} /></button>
      <figcaption><span>{version(asset.data.revisionId)} · {new Date(asset.createdAt).toLocaleTimeString()}</span>
        <Button variant={selected.includes(asset.id) ? 'default' : 'ghost'} size="icon" aria-label="选择比较图片" aria-pressed={selected.includes(asset.id)} onClick={() => toggle(asset.id)}><Columns2 /></Button>
        <Button variant="ghost" size="icon" aria-label="从此图继续" disabled={busy} onClick={() => void onRestore(asset.data.revisionId, asset.id)}><History /></Button>
        <Button variant="ghost" size="icon" aria-label="导出图片" onClick={() => void studio.exportAsset({ assetId: asset.id }).catch(onError)}><Download /></Button>
      </figcaption>
    </figure>)}</div>
    {!shown.length && !pending.length && <p className="py-8 text-center text-sm text-muted-foreground">这个版本还没有保存完成的图片。</p>}
    <Dialog open={inspected.length > 0} onOpenChange={open => { if (!open) setPreview([]) }}><DialogContent className="result-dialog sm:max-w-[min(1280px,94vw)]"><DialogHeader>
      <DialogTitle>{inspected.length === 2 ? '版本比较' : '查看原图'}</DialogTitle><DialogDescription>查看生成时的 Prompt 与参数，或沿用此版本继续创作。</DialogDescription>
    </DialogHeader><div className={`result-inspection ${inspected.length === 2 ? 'comparing' : ''}`}>
      {inspected.map(asset => {
        const revision = revisions.find(r => r.id === asset.data.revisionId)
        const request = revision?.data.request
        return <section key={asset.id}><img src={assetUrl(asset.data.filename)} alt={`${version(asset.data.revisionId)} 原始结果`} />
          <h3>{version(asset.data.revisionId)} · {revision?.data.snapshot?.promptContext?.model?.title ?? findModel(request?.modelVersionId)?.title ?? request?.modelVersionId ?? '模型未知'}</h3>
          <p className="text-xs text-muted-foreground">{asset.data.width ?? '?'} × {asset.data.height ?? '?'} · Seed {request?.seed ?? '随机'}</p>
          <p className="result-prompt">{request?.prompt}</p>
          {request?.negativePrompt && <p className="result-prompt text-muted-foreground">负面：{request.negativePrompt}</p>}
          {revision?.data.explanation && <p className="text-sm text-muted-foreground">{revision.data.explanation}</p>}
          <Button variant="outline" disabled={busy} onClick={() => { void onRestore(asset.data.revisionId, asset.id); setPreview([]) }}>从此版本继续</Button>
        </section>
      })}
    </div></DialogContent></Dialog>
  </>
}
