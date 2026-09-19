import { createFileRoute } from '@tanstack/react-router'
import { SettingsNcc } from '@/features/settings-ncc'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsNcc,
})
