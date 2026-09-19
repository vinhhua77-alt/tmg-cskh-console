import { createFileRoute } from '@tanstack/react-router'
import { ChatsPage } from '@/features/chats-ncc'

export const Route = createFileRoute('/_authenticated/chats/')({
  component: ChatsPage,
})
