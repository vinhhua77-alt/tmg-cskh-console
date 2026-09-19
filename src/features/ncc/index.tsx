// NCC Hub v3 — trang "NCC & Nhóm" thật (Phase B), thay admin/public/js/views/ncc.js cũ.
// 2 sub-tab: NCC (danh bạ nhà cung cấp) và Nhóm Zalo (raw group list + phân loại).
import { useState } from 'react'
import { useNccState } from '@/hooks/use-ncc-state'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { BulkMapDialog } from './bulk-map-dialog'
import type { Vendor } from './data'
import { GroupTable } from './group-table'
import { NccEditDialog } from './ncc-edit-dialog'
import { NccTable } from './ncc-table'

export function Ncc() {
  const { data } = useNccState()
  const [tab, setTab] = useState<'ncc' | 'groups'>('ncc')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [bulkMapOpen, setBulkMapOpen] = useState(false)

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4'>
          <h1 className='text-2xl font-bold tracking-tight'>NCC &amp; Nhóm</h1>
          <p className='text-muted-foreground'>Danh bạ nhà cung cấp · nhóm Zalo</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'ncc' | 'groups')}>
          <TabsList>
            <TabsTrigger value='ncc' className='gap-1.5'>
              NCC <Badge variant='secondary'>{data?.ncc.length ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value='groups' className='gap-1.5'>
              Nhóm Zalo <Badge variant='secondary'>{data?.groups.length ?? 0}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='ncc' className='mt-4'>
            <NccTable
              onAdd={() => {
                setEditing(null)
                setEditOpen(true)
              }}
              onEdit={(vendor) => {
                setEditing(vendor)
                setEditOpen(true)
              }}
              onBulkMap={() => setBulkMapOpen(true)}
            />
          </TabsContent>
          <TabsContent value='groups' className='mt-4'>
            <GroupTable onGotoNcc={() => setTab('ncc')} />
          </TabsContent>
        </Tabs>
      </Main>

      <NccEditDialog open={editOpen} onOpenChange={setEditOpen} vendor={editing} />
      <BulkMapDialog open={bulkMapOpen} onOpenChange={setBulkMapOpen} />
    </>
  )
}
