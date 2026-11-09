import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { useCollection } from '../../../hooks/settings'
import { stemWithDate } from '../../../lib/files/file-name-pattern'
import { entryStem, renameOpenFile } from '../../../lib/files/rename'

/**
 * A link below the published date when the file's name has another date in it,
 * by its collection's file name pattern, to rename the file to match. Renders
 * nothing when the name already matches or doesn't follow the pattern.
 */
export const RenameToDateLink: React.FC<{ date: Date | undefined }> = ({
  date,
}) => {
  const path = useEditorStore(state => state.currentFile?.path)
  const collectionName = useEditorStore(state => state.currentFile?.collection)
  const collection = useCollection(collectionName)
  if (!date || !path || !collection) return null

  const stem = entryStem(path, collection)
  const renamed = stemWithDate(
    stem,
    collection.settings.fileNamePattern.value,
    date
  )
  if (!renamed || renamed === stem) return null

  return (
    <button
      type="button"
      onClick={() => void renameOpenFile(renamed)}
      className="w-fit text-xs text-muted-foreground hover:text-foreground"
    >
      Rename file to match
    </button>
  )
}
