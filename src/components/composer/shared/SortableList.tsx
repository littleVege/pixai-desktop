import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from 'cn'

interface Props {
  ids: string[]
  onMove: (from: number, to: number) => void
  children: (id: string, index: number, handle: React.ReactNode) => React.ReactNode
}

/** Vertical drag-to-reorder list. `data-vaul-no-drag` keeps the mobile bottom sheet from hijacking the drag. */
export function SortableList({ ids, onMove, children }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from >= 0 && to >= 0) onMove(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="relative space-y-0.5">
          {ids.map((id, i) => <Row key={id} id={id} index={i} render={children} />)}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Row({ id, index, render }: { id: string; index: number; render: Props['children'] }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button type="button" data-vaul-no-drag {...attributes} {...listeners} aria-label={t('reorder-hint')}
      className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing">
      <GripVertical className="size-4" />
    </button>
  )
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-lg', isDragging && 'relative z-10 bg-popover shadow-md ring-1 ring-border')}>
      {render(id, index, handle)}
    </li>
  )
}
