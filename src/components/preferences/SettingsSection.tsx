import React from 'react'
import { Separator } from '@/components/ui/separator'
import { FieldGroup } from '@/components/ui/field'

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-heading">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <FieldGroup>{children}</FieldGroup>
  </div>
)
