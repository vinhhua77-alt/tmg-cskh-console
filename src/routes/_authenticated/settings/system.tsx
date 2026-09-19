import { createFileRoute } from '@tanstack/react-router'
import { SettingsSystem } from '@/features/settings-ncc/system'

export const Route = createFileRoute('/_authenticated/settings/system')({
  component: SettingsSystem,
})
