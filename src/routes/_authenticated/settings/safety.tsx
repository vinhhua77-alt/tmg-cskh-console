import { createFileRoute } from '@tanstack/react-router'
import { SettingsSafety } from '@/features/settings-ncc/safety'

export const Route = createFileRoute('/_authenticated/settings/safety')({
  component: SettingsSafety,
})
