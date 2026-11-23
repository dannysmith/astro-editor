import type { SchemaField } from '../../../lib/schema'
import type { FieldProps } from '../../../types/common'

/** What every frontmatter control takes. Whether it's required comes from `field` */
export interface FieldControlProps extends Omit<FieldProps, 'required'> {
  field?: SchemaField
}
