import { useQuery } from '@tanstack/react-query'
import { commands, type Collection } from '@/types'
import { queryKeys } from '@/lib/query-keys'

/** The path of the template new files in the collection start from, or null */
export const useNewFileTemplateQuery = (
  collection: Collection,
  projectPath: string
) => {
  return useQuery({
    queryKey: queryKeys.newFileTemplate(projectPath, collection.name),
    queryFn: async () => {
      const result = await commands.newFileTemplate(collection, projectPath)
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
  })
}
