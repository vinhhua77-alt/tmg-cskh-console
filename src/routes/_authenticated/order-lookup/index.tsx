import { createFileRoute } from '@tanstack/react-router'
import { OrderLookupPage } from '@/features/order-lookup'

export const Route = createFileRoute('/_authenticated/order-lookup/')({
  component: OrderLookupPage,
})
