/**
 * Native right-click menu for files in the sidebar, built with Tauri's menu
 * API. This isn't shadcn's ContextMenu, so don't `shadcn add context-menu`
 * over it.
 */
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { error as logError } from '@tauri-apps/plugin-log'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { commands } from '@/lib/bindings'
import type { FileEntry } from '@/types'
import { useProjectStore } from '../../store/projectStore'
import { toast } from '../../lib/toast'
import { deleteFile } from '../../lib/files/delete'
import { pathMenuItems } from '../../lib/path-menu'
import { getTitle } from '@/lib/files/sorting'
import { fieldMappings, getCollection } from '@/lib/project-scan'
import { frontmatterSchema } from '@/lib/schema'

interface ContextMenuOptions {
  file: FileEntry
  position: { x: number; y: number }
  onRefresh?: () => void
  onRename?: (file: FileEntry) => void
}

export class FileContextMenu {
  private static generateDuplicatePath(originalPath: string): string {
    const lastSlashIndex = originalPath.lastIndexOf('/')
    const directory = originalPath.substring(0, lastSlashIndex)
    const fileName = originalPath.substring(lastSlashIndex + 1)

    const lastDotIndex = fileName.lastIndexOf('.')
    if (lastDotIndex === -1) {
      // No extension
      return `${directory}/${fileName}-1`
    }

    const nameWithoutExt = fileName.substring(0, lastDotIndex)
    const extension = fileName.substring(lastDotIndex)
    return `${directory}/${nameWithoutExt}-1${extension}`
  }

  static async show({
    file,
    position,
    onRefresh,
    onRename,
  }: ContextMenuOptions): Promise<void> {
    try {
      // Get project path and settings from store
      const { projectPath } = useProjectStore.getState()
      if (!projectPath) {
        throw new Error('No project path available')
      }

      // The file's collection's title field
      const titleField = fieldMappings(getCollection(file.collection)).title

      const duplicateItem = await MenuItem.new({
        id: 'duplicate-file',
        text: 'Duplicate',
        action: () => {
          void (async () => {
            try {
              const duplicatePath = FileContextMenu.generateDuplicatePath(
                file.path
              )

              // Read the original file content
              const readResult = await commands.readFile(file.path, projectPath)
              if (readResult.status === 'error') {
                throw new Error(readResult.error)
              }

              // Parse the duplicate path into directory and filename
              const lastSlashIndex = duplicatePath.lastIndexOf('/')
              const directory = duplicatePath.substring(0, lastSlashIndex)
              const filename = duplicatePath.substring(lastSlashIndex + 1)

              // Create the duplicate file
              const createResult = await commands.createFile(
                directory,
                filename,
                null,
                '',
                readResult.data,
                '',
                frontmatterSchema([]),
                projectPath
              )
              if (createResult.status === 'error') {
                throw new Error(createResult.error)
              }

              // Refresh the file list if callback is provided
              if (onRefresh) {
                onRefresh()
              }
            } catch (error) {
              void logError(`Failed to duplicate file: ${String(error)}`)
            }
          })()
        },
      })

      const renameItem = await MenuItem.new({
        id: 'rename-file',
        text: 'Rename',
        action: () => {
          try {
            if (onRename) {
              onRename(file)
            }
          } catch (error) {
            void logError(`Failed to initiate rename: ${String(error)}`)
          }
        },
      })

      const separator = await PredefinedMenuItem.new({
        text: 'separator',
        item: 'Separator',
      })

      const deleteItem = await MenuItem.new({
        id: 'delete-file',
        text: 'Delete',
        action: () => {
          void (async () => {
            try {
              const deleted = await deleteFile(
                file.path,
                projectPath,
                getTitle(file, titleField)
              )
              if (deleted && onRefresh) onRefresh()
            } catch (error) {
              void logError(`Failed to delete file: ${String(error)}`)
              toast.error("Couldn't delete the file", {
                description:
                  error instanceof Error ? error.message : String(error),
              })
            }
          })()
        },
      })

      // Create and show the context menu
      const menuItems = [
        ...(await pathMenuItems(file.path)),
        duplicateItem,
        renameItem,
        separator,
        deleteItem,
      ]

      const menu = await Menu.new({
        items: menuItems,
      })

      // Show the menu at the specified position
      await menu.popup(new LogicalPosition(position.x, position.y))
    } catch (error) {
      void logError(`Failed to show context menu: ${String(error)}`)
    }
  }
}
