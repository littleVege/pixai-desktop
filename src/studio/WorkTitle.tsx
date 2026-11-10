import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { studio, type StudioEntity } from './api'

export function WorkTitle({ work, onChange, onError }: { work: StudioEntity; onChange: () => Promise<void>; onError: (error: unknown) => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(work.data.title as string)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!title.trim()) return
    setSaving(true)
    try { await studio.renameWork({ workId: work.id, title: title.trim() }); await onChange(); setEditing(false) }
    catch (error) { onError(error) } finally { setSaving(false) }
  }
  if (!editing) return <div className="work-title"><h1>{work.data.title}</h1><Button variant="ghost" size="icon" aria-label="重命名作品" onClick={() => { setTitle(work.data.title); setEditing(true) }}><Pencil /></Button></div>
  return <form className="work-title" onSubmit={event => { event.preventDefault(); void save() }}>
    <Input autoFocus aria-label="作品名称" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} />
    <Button size="icon" type="submit" disabled={saving || !title.trim()} aria-label="保存作品名称"><Check /></Button>
    <Button size="icon" variant="ghost" type="button" disabled={saving} onClick={() => setEditing(false)} aria-label="取消重命名"><X /></Button>
  </form>
}
