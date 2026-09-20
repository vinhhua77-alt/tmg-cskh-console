import { createFileRoute } from '@tanstack/react-router'
import { CskhInboxPage } from '@/features/cskh-inbox'

export const Route = createFileRoute('/_authenticated/cskh-inbox/')({
  component: CskhInboxPage,
})
