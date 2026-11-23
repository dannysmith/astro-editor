import React from 'react'
import { shownFilePath, useEditorStore } from '../../../store/editorStore'
import { useCollection } from '../../../hooks/settings'
import { stemWithDate } from '../../../lib/files/file-name-pattern'
import { renamableStem, renameOpenFile } from '../../../lib/files/rename'

/**
 * A link below the published date when the file's name has another date in it,
 * by its collection's file name pattern, to rename the file to match. Renders
 * nothing when the name already matches or doesn't follow the pattern.
 */
export const RenameToDateLink: React.FC<{ date: Date | undefined }> = ({
  date,
}) => {
  const path = useEditorStore(shownFilePath)
  // While the previous file's values are held, this name is for that file
  const isHeld = useEditorStore(state => state.heldFrontmatter !== null)
  const collectionName = useEditorStore(state => state.currentFile?.collection)
  const collection = useCollection(collectionName)
  if (!date || !path || !collection) return null

  const stem = renamableStem(path)
  if (stem === null) return null
  const renamed = stemWithDate(
    stem,
    collection.settings.fileNamePattern.value,
    date
  )
  if (!renamed || renamed === stem) return null

  return (
    <button
      type="button"
      disabled={isHeld}
      onClick={() => void renameOpenFile(renamed)}
      className="w-fit text-xs text-muted-foreground hover:text-foreground"
    >
      Rename file to match
    </button>
  )
}
