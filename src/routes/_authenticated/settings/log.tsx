import { createFileRoute } from '@tanstack/react-router'
import { SettingsLog } from '@/features/settings-ncc/log'

export const Route = createFileRoute('/_authenticated/settings/log')({
  component: SettingsLog,
})
