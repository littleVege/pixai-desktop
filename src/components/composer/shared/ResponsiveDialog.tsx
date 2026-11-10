import { useIsMobile } from '@/hooks/useIsMobile'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from 'cn'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  /** Pinned above the scrolling content (selected strip, search). */
  toolbar?: React.ReactNode
  className?: string
}

/** Dialog on desktop, bottom sheet on mobile. Same children either way. */
export function ResponsiveDialog({ open, onOpenChange, title, description, children, toolbar, className }: Props) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}
          </DrawerHeader>
          {toolbar && <div className="space-y-3 border-b px-4 pb-3">{toolbar}</div>}
          <div className={cn('overflow-y-auto px-4 pt-3 pb-6', className)}>{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl', className)}>
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {toolbar && <div className="space-y-3 border-b px-5 py-3">{toolbar}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
