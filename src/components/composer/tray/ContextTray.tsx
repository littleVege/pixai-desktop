import { RecipeChip } from './RecipeChip'
import { LoraChip } from './LoraChip'
import { OutputChip } from './OutputChip'
import { AdvancedChip } from './AdvancedChip'
import type { PickerTarget } from '../pickers/types'

/** The tray tucked behind the top edge of the Composer card: recipes, LoRAs, output and advanced settings. */
export function ContextTray({ onOpen }: { onOpen: (t: PickerTarget) => void }) {
  return (
    <div className="composer-tray mx-2 mt-1">
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto p-px [scrollbar-width:none]">
          <RecipeChip onOpen={onOpen} />
          <LoraChip onOpen={onOpen} />
        </div>
        <div className="flex shrink-0 items-center gap-1 p-px">
          <OutputChip />
          <AdvancedChip />
        </div>
      </div>
    </div>
  )
}
