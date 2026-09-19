import { createFileRoute } from '@tanstack/react-router'
import { Ncc } from '@/features/ncc'

export const Route = createFileRoute('/_authenticated/ncc/')({
  component: Ncc,
})
