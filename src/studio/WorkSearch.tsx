import { useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StudioEntity } from './api'
import { reportError } from './Notices'

interface Props {
  works: StudioEntity[]
  shelfTitle: string
  deleted: boolean
  onChoose: (item: StudioEntity) => Promise<void>
}

export function WorkSearch({ works, shelfTitle, deleted, onChoose }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = works.filter(item => String(item.data.title).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  async function choose(item: StudioEntity) {
    try {
      await onChoose(item)
      setOpen(false)
    } catch (error) { reportError(error) }
  }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); setQuery('') }}>
    <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="搜索作品"><Search /></Button></DialogTrigger>
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>搜索{shelfTitle === '作品' ? '作品' : shelfTitle + '的作品'}</DialogTitle>
      <Input autoFocus type="search" aria-label="按标题搜索作品" placeholder="输入作品名称…" value={query} onChange={event => setQuery(event.target.value)} />
      <ul className="work-search-results">{matches.map(item =>
        <li key={item.id}><button onClick={() => void choose(item)}>
          <span>{item.data.title}</span><small>{deleted ? '恢复作品' : new Date(item.updatedAt).toLocaleDateString()}</small>
        </button></li>
      )}</ul>
      {!matches.length && <p className="text-sm text-muted-foreground">没有匹配的作品</p>}
    </DialogContent>
  </Dialog>
}
