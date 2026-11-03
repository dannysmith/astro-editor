import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { resolveImageSrc } from '@/lib/files'

/**
 * A loadable URL for an image path as written in the open file (remote, or
 * resolved through the asset protocol). Image previews and thumbnails share the
 * cache, so a thumbnail that remounts doesn't resolve its path again.
 *
 * Keeps the previous image while a new path resolves, so previews don't
 * flicker. A path that can't be resolved is an error, and previews show
 * nothing for it.
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
    placeholderData: keepPreviousData,
    // A missing file isn't going to appear on a retry
    retry: false,
  })
}
