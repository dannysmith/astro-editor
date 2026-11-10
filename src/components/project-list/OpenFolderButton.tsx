import { FolderOpen } from 'lucide-react'
import { CommandShortcut } from '../ui/command'

/**
 * The project list's Open Folder… row, pinned between the search and the
 * projects so it's always in view. It isn't a list item, so searching never
 * highlights it; the list's Cmd+O triggers it from the keyboard.
 */
export function OpenFolderButton({
  shortcut,
  onClick,
}: {
  shortcut: string
  onClick?: () => void
}) {
  return (
    <div className="border-b p-1 px-2">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-3 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:size-5 [&_svg]:text-muted-foreground"
      >
        <FolderOpen />
        Open Folder…
        <CommandShortcut>{shortcut}</CommandShortcut>
      </button>
    </div>
  )
}
