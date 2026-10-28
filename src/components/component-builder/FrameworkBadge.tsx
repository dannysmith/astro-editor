import type { ComponentFramework } from '@/types'
import { Badge } from '../ui/badge'
import { FrameworkIcon } from '../icons/FrameworkIcon'
import { cn } from '../../lib/utils'

const frameworkColors: Record<ComponentFramework, string> = {
  astro: 'text-framework-astro',
  react: 'text-framework-react',
  vue: 'text-framework-vue',
  svelte: 'text-framework-svelte',
}

export function FrameworkBadge({
  framework,
}: {
  framework: ComponentFramework
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'flex shrink-0 items-center gap-1 text-xs',
        frameworkColors[framework]
      )}
    >
      <FrameworkIcon framework={framework} />
      {framework}
    </Badge>
  )
}
