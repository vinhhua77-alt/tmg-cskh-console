import { createFileRoute } from '@tanstack/react-router'
import { SettingsTemplates } from '@/features/settings-ncc/templates'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsTemplates,
})
