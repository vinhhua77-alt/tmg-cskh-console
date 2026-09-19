import { createFileRoute } from '@tanstack/react-router'
import { SettingsHealth } from '@/features/settings-ncc/health'

export const Route = createFileRoute('/_authenticated/settings/health')({
  component: SettingsHealth,
})
