import { forwardRef } from 'react'
import { X } from 'lucide-react'
import { cn } from 'cn'

/** Trigger button inside a tray chip. `active` = something is selected or changed. */
export const ChipButton = forwardRef<HTMLButtonElement, React.ComponentProps<'button'> & { active?: boolean }>(
  ({ active, className, ...props }, ref) => (
    <button ref={ref} type="button" {...props}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:shrink-0',
        active ? 'bg-background text-foreground shadow-xs ring-1 ring-border hover:bg-background/80' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
        className,
      )} />
  ),
)
ChipButton.displayName = 'ChipButton'

/** A selected-state chip with an optional inline remove button next to its trigger. */
export function ChipShell({ children, onRemove, removeLabel }: { children: React.ReactNode; onRemove?: () => void; removeLabel: string }) {
  return (
    <div className="inline-flex h-7 shrink-0 items-center rounded-full bg-background text-foreground shadow-xs ring-1 ring-border">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel}
          className="mr-1 -ml-1 flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

/** Thumbnail + count that summarises a multi-selection. */
export function CountBadge({ n }: { n: number }) {
  return <span className="rounded-full bg-primary/15 px-1.5 text-[11px] leading-4 font-semibold text-primary tabular-nums">+{n}</span>
}
