import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { resolveImageSrc } from '@/lib/files'

/**
 * A loadable URL for an image path as written in the open file (remote, or
 * resolved through the asset protocol). Image previews and thumbnails share the
 * cache, so a thumbnail that remounts doesn't resolve its path again.
 *
 * A path that can't be resolved is an error, and previews show nothing for it.
 * There's deliberately no placeholder data: showing the previous path's image
 * while a new one resolves flashes the wrong image.
 */
export const useImageSrcQuery = (
  imagePath: string | null | undefined,
  projectPath: string | null,
  currentFilePath: string | null
) => {
  return useQuery({
    queryKey: queryKeys.imageSrc(
      projectPath || '',
      currentFilePath,
      imagePath || ''
    ),
    queryFn: () => resolveImageSrc(imagePath!, projectPath!, currentFilePath),
    enabled: !!imagePath && !!projectPath,
    // A missing file isn't going to appear on a retry
    retry: false,
  })
}
