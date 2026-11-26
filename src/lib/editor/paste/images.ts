import { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { savePastedImage } from '../../files'
import { assetSettings } from '../../project-scan'
import { toast } from '../../toast'
import {
  formatAsMarkdown,
  isImageFile,
  selectionAfterInsert,
  validateDropContext,
  type ProcessedFile,
} from '../dragdrop'

/** Images to paste, with alt text from the copied `<img>` if there was one */
export interface PastedImages {
  files: { file: File; name: string }[]
  alt: string | null
}

/**
 * The images to paste as files, or null to leave the paste to the text
 * handling. WebKit gives an image on the clipboard as a file: a screenshot
 * or an image copied in Preview or Photos (`Files` only), files copied in
 * Finder (with their names), and Copy Image in a browser, which also gives
 * HTML that's just the `<img>`. Copied text that has images in it (from Pages
 * or a web page) is HTML with more than an `<img>`, and goes to the text
 * handling, as does any file that isn't an image.
 */
export const imagesToPaste = (
  clipboard: DataTransfer | null
): PastedImages | null => {
  const files = [...(clipboard?.files ?? [])].map(file => ({
    file,
    name: pastedImageName(file),
  }))
  if (files.length === 0 || !files.every(({ name }) => isImageFile(name))) {
    return null
  }

  const html = clipboard?.getData('text/html') ?? ''
  if (html) {
    const body = new DOMParser().parseFromString(html, 'text/html').body
    const img = body.querySelector('img')
    const onlyAnImage =
      body.children.length === 1 &&
      body.firstElementChild === img &&
      !body.textContent?.trim()
    if (!onlyAnImage) return null
    return { files, alt: files.length === 1 ? altText(img) : null }
  }

  return clipboard?.getData('text/plain')?.trim() ? null : { files, alt: null }
}

/**
 * The name to save a pasted image under. Names made up by WebKit (`image.png`)
 * and Photos (a UUID) become `pasted-image`; a file copied in Finder keeps
 * its own.
 */
export const pastedImageName = (file: File): string => {
  const dot = file.name.lastIndexOf('.')
  const extension =
    dot > 0
      ? file.name.slice(dot + 1)
      : (file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png')
  const madeUp =
    dot <= 0 ||
    /^image\.\w+$/i.test(file.name) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
      file.name
    )
  return madeUp ? `pasted-image.${extension}` : file.name
}

/** An `<img>`'s alt text, made safe to put between `![` and `]` */
const altText = (img: HTMLImageElement | null): string | null => {
  const alt = img?.getAttribute('alt')?.replace(/\s+/g, ' ').trim()
  return alt ? alt.replace(/[[\]]/g, '\\$&') : null
}

/**
 * Saves pasted images into the open entry's collection assets, as dropped
 * files are copied, and inserts them over the selection. A single image has
 * its alt text selected.
 */
export const pasteImages = async (
  view: EditorView,
  { files, alt }: PastedImages
): Promise<void> => {
  const { projectPath } = useProjectStore.getState()
  const { currentFile } = useEditorStore.getState()
  if (!validateDropContext(projectPath, currentFile).canProceed) {
    toast.error("Images can only be pasted into a collection's entries")
    return
  }

  let pasted: ProcessedFile[]
  try {
    pasted = await Promise.all(
      files.map(async ({ file, name }) => {
        const path = await savePastedImage(file, name, {
          projectPath: projectPath!,
          collection: currentFile!.collection,
          currentFilePath: currentFile!.path,
          ...assetSettings(currentFile!.collection),
        })
        // formatAsMarkdown uses the file name as the alt text, and
        // selectionAfterInsert selects it
        const altOrName = alt ?? name
        return {
          originalPath: name,
          filename: altOrName,
          isImage: true,
          markdownText: formatAsMarkdown(altOrName, path, true),
        }
      })
    )
  } catch (error) {
    toast.error("Couldn't paste the image", {
      description: error instanceof Error ? error.message : String(error),
    })
    return
  }

  // Saving can take a while; if another file was opened meanwhile, the paths
  // (relative to this one) don't belong in it
  if (useEditorStore.getState().currentFile?.path !== currentFile!.path) return

  const insertText = pasted.map(file => file.markdownText).join('\n')
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: insertText },
    selection: selectionAfterInsert(from, insertText, pasted),
    scrollIntoView: true,
    userEvent: 'input.paste',
  })
}
