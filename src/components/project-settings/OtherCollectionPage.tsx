import { Database, ExternalLink, Plug } from 'lucide-react'
import type { Collection, ProjectScan } from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { usePreferences } from '../../hooks/usePreferences'
import { openInIde } from '../../lib/ide'
import type { CompleteSchema } from '../../lib/schema'
import { describeOrigin } from '../../lib/project-settings/describe'
import { WithCode } from './Problems'
import {
  FolderInput,
  PageHeader,
  PageIcon,
  Setting,
  SettingsGroup,
} from './Setting'
import { SchemaFields } from './SchemaFields'

/**
 * A collection AE doesn't edit: a data collection, with a button to open it
 * in the IDE, or one whose loader probably doesn't read files, with a folder
 * setting in case it does. Both show their schema.
 */
export function OtherCollectionPage({
  collection,
  schema,
  scan,
  projectPath,
}: {
  collection: Collection
  schema: CompleteSchema | null
  scan: ProjectScan
  projectPath: string
}) {
  const { globalSettings, updateCollectionSettings } = usePreferences()
  const ideCommand = globalSettings?.general.ideCommand
  const isData = collection.kind === 'data'

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<PageIcon icon={isData ? Database : Plug} />}
        title={collection.name}
      >
        <WithCode text={describeOrigin(collection, scan)} />
      </PageHeader>

      {isData && ideCommand && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openInIde(collection.path, ideCommand)}
        >
          <ExternalLink /> Open in IDE
        </Button>
      )}

      {!isData && (
        <SettingsGroup title="Files">
          <Setting
            label="Folder"
            help="If its entries are Markdown files in this project, choose their folder."
            source={collection.folderSource}
          >
            {({ id }) => (
              <FolderInput
                id={id}
                value=""
                placeholder="None"
                start={projectPath}
                onChange={folder =>
                  void updateCollectionSettings(collection.name, { folder })
                }
              />
            )}
          </Setting>
        </SettingsGroup>
      )}

      <SchemaFields collection={collection} schema={schema} />
    </div>
  )
}
