/* ---------------------------------------------------------------
   Support domain: types, seed data, and the in-memory store the
   mock transport in api.ts reads and writes.

   This stands in for a server. Swap the transport and the shapes
   below are what the real endpoints are expected to return.
   --------------------------------------------------------------- */

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketCategory = 'editor' | 'library' | 'pack-sync' | 'billing' | 'account' | 'other'

export type Actor = {
  id: string
  name: string
  role: 'requester' | 'agent' | 'system'
  avatar?: string
}

export type Attachment = {
  id: string
  name: string
  bytes: number
  mime: string
}

export type DeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export type Message = {
  id: string
  ticketId: string
  author: Actor
  body: string
  createdAt: string
  attachments: Attachment[]
  delivery: DeliveryState
  /** system messages render as a centred rule, not a bubble */
  event?: 'status' | 'assignment' | 'priority' | 'created'
}

export type Ticket = {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  requester: Actor
  assignee: Actor | null
  createdAt: string
  updatedAt: string
  tags: string[]
  unread: number
  /** minutes remaining against the tier's first-response target */
  slaMinutes: number | null
}

export const categories: Array<{ id: TicketCategory; label: string }> = [
  { id: 'editor', label: 'Editor / viewport' },
  { id: 'library', label: 'Library' },
  { id: 'pack-sync', label: 'Resource pack sync' },
  { id: 'billing', label: 'Billing' },
  { id: 'account', label: 'Account' },
  { id: 'other', label: 'Something else' },
]

export const priorities: TicketPriority[] = ['low', 'normal', 'high', 'urgent']
export const statuses: TicketStatus[] = ['open', 'pending', 'resolved', 'closed']

export const me: Actor = { id: 'usr_galex', name: 'g.alex', role: 'requester' }

export const agents: Actor[] = [
  { id: 'agt_ruth', name: 'Ruth Calder', role: 'agent' },
  { id: 'agt_pike', name: 'Pike', role: 'agent' },
  { id: 'agt_moss', name: 'Moss', role: 'agent' },
]

const system: Actor = { id: 'sys', name: 'Vellum', role: 'system' }

/* ---------------- seed ---------------- */

const t = (daysAgo: number, hour = 10, min = 0) => {
  const d = new Date(2026, 8, 18, hour, min, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

let seq = 1043

const seedTickets: Ticket[] = [
  {
    id: 'TCK-1042',
    subject: 'Pack push leaves 7 clients on the old hash',
    status: 'open',
    priority: 'high',
    category: 'pack-sync',
    requester: me,
    assignee: agents[0],
    createdAt: t(2, 9, 14),
    updatedAt: t(0, 8, 41),
    tags: ['pack', 'realm'],
    unread: 2,
    slaMinutes: 74,
  },
  {
    id: 'TCK-1039',
    subject: 'Quad view drops the top orthographic grid',
    status: 'pending',
    priority: 'normal',
    category: 'editor',
    requester: me,
    assignee: agents[1],
    createdAt: t(5, 15, 2),
    updatedAt: t(1, 17, 26),
    tags: ['viewport'],
    unread: 0,
    slaMinutes: null,
  },
  {
    id: 'TCK-1031',
    subject: 'Library pagination resets after renaming a model',
    status: 'open',
    priority: 'low',
    category: 'library',
    requester: me,
    assignee: null,
    createdAt: t(8, 11, 48),
    updatedAt: t(3, 12, 9),
    tags: [],
    unread: 0,
    slaMinutes: 320,
  },
  {
    id: 'TCK-1024',
    subject: 'Seat count still reads 1 of 1 after upgrade',
    status: 'resolved',
    priority: 'urgent',
    category: 'billing',
    requester: me,
    assignee: agents[2],
    createdAt: t(14, 8, 30),
    updatedAt: t(11, 16, 55),
    tags: ['tier'],
    unread: 0,
    slaMinutes: null,
  },
  {
    id: 'TCK-1018',
    subject: 'Export writes an empty .vellum when a group is hidden',
    status: 'closed',
    priority: 'normal',
    category: 'editor',
    requester: me,
    assignee: agents[0],
    createdAt: t(21, 13, 5),
    updatedAt: t(19, 9, 12),
    tags: ['export'],
    unread: 0,
    slaMinutes: null,
  },
]

const msg = (
  id: string,
  ticketId: string,
  author: Actor,
  body: string,
  createdAt: string,
  extra: Partial<Message> = {},
): Message => ({
  id,
  ticketId,
  author,
  body,
  createdAt,
  attachments: [],
  delivery: 'read',
  ...extra,
})

const seedMessages: Message[] = [
  // TCK-1042
  msg('m-1', 'TCK-1042', system, 'Ticket opened', t(2, 9, 14), { event: 'created' }),
  msg(
    'm-2',
    'TCK-1042',
    me,
    'Pushed a fresh pack this morning and the dashboard still shows 7 clients on the old hash an hour later. They reconnect fine, they just never pick up the new archive.',
    t(2, 9, 14),
    {
      attachments: [
        { id: 'att-1', name: 'pack-adoption.png', bytes: 184_320, mime: 'image/png' },
        { id: 'att-2', name: 'realm.log', bytes: 42_118, mime: 'text/plain' },
      ],
    },
  ),
  msg('m-3', 'TCK-1042', system, 'Assigned to Ruth Calder', t(2, 10, 2), { event: 'assignment' }),
  msg(
    'm-4',
    'TCK-1042',
    agents[0],
    'Thanks - the log shows the manifest served with a stale ETag, so those clients are being told nothing changed. Can you confirm the sha1 on the dashboard matches what current.zip actually hashes to locally?',
    t(2, 10, 8),
  ),
  msg('m-5', 'TCK-1042', me, 'Dashboard says 9f2c04e1. Local shasum agrees.', t(1, 9, 30)),
  msg(
    'm-6',
    'TCK-1042',
    agents[0],
    'That confirms it. The archive is right and the cache header is wrong, so this is ours, not yours. I have raised it with the realm team and we are shipping a fix that stamps the manifest with the pack hash instead of the upload time.',
    t(0, 8, 39),
  ),
  msg(
    'm-7',
    'TCK-1042',
    agents[0],
    'In the meantime: bumping the pack version forces every client to refetch. Do you want me to walk through that, or would you rather wait for the fix?',
    t(0, 8, 41),
  ),

  // TCK-1039
  msg('m-10', 'TCK-1039', system, 'Ticket opened', t(5, 15, 2), { event: 'created' }),
  msg(
    'm-11',
    'TCK-1039',
    me,
    'In quad view the top orthographic cell renders the model but not the grid plane. Perspective and the two side views are fine.',
    t(5, 15, 2),
  ),
  msg(
    'm-12',
    'TCK-1039',
    agents[1],
    'Reproduced. The plane is there, it is just edge-on at exactly 90 degrees so it collapses to a hairline. We will clamp the top view a hair off the axis.',
    t(4, 11, 20),
  ),
  msg('m-13', 'TCK-1039', system, 'Status changed to pending', t(1, 17, 26), { event: 'status' }),

  // TCK-1031
  msg('m-20', 'TCK-1031', system, 'Ticket opened', t(8, 11, 48), { event: 'created' }),
  msg(
    'm-21',
    'TCK-1031',
    me,
    'Rename a model on page 3 of the library and the grid jumps back to page 1. Minor, but it makes bulk renaming tedious.',
    t(8, 11, 48),
  ),
  msg(
    'm-22',
    'TCK-1031',
    system,
    'Waiting on triage - no agent assigned',
    t(3, 12, 9),
    { event: 'assignment' },
  ),

  // TCK-1024
  msg('m-30', 'TCK-1024', system, 'Ticket opened', t(14, 8, 30), { event: 'created' }),
  msg('m-31', 'TCK-1024', me, 'Upgraded to the team tier but seats still read 1 of 1.', t(14, 8, 30)),
  msg(
    'm-32',
    'TCK-1024',
    agents[2],
    'The subscription webhook landed but the seat grant did not. I have reconciled it by hand - you should see 5 of 5 on a reload. Sorry for the delay.',
    t(11, 16, 50),
  ),
  msg('m-33', 'TCK-1024', system, 'Status changed to resolved', t(11, 16, 55), { event: 'status' }),

  // TCK-1018
  msg('m-40', 'TCK-1018', system, 'Ticket opened', t(21, 13, 5), { event: 'created' }),
  msg(
    'm-41',
    'TCK-1018',
    me,
    'Hiding a group before export writes a .vellum with no geometry at all.',
    t(21, 13, 5),
  ),
  msg(
    'm-42',
    'TCK-1018',
    agents[0],
    'Fixed in 0.4.1 - hidden groups are now excluded from the visibility walk rather than short-circuiting it.',
    t(19, 9, 10),
  ),
  msg('m-43', 'TCK-1018', system, 'Status changed to closed', t(19, 9, 12), { event: 'status' }),
]

/* ---------------- store ---------------- */

export type StoreEvent =
  | { type: 'message.created'; message: Message }
  | { type: 'message.updated'; message: Message }
  | { type: 'ticket.updated'; ticket: Ticket }
  | { type: 'agent.typing'; ticketId: string; actor: Actor; until: number }

type Listener = (e: StoreEvent) => void

class Store {
  tickets: Ticket[] = seedTickets.map((x) => ({ ...x }))
  messages: Message[] = seedMessages.map((x) => ({ ...x }))
  private listeners = new Set<Listener>()

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  emit(e: StoreEvent) {
    for (const fn of [...this.listeners]) fn(e)
  }

  nextTicketId() {
    seq += 1
    return `TCK-${seq}`
  }

  touch(ticketId: string, at: string) {
    const ticket = this.tickets.find((x) => x.id === ticketId)
    if (!ticket) return
    ticket.updatedAt = at
    this.emit({ type: 'ticket.updated', ticket: { ...ticket } })
  }
}

export const store = new Store()

/* ---------------- formatting helpers ---------------- */

export function relativeTime(iso: string, now = new Date(2026, 8, 18, 23, 30)) {
  const diff = now.getTime() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function clockTime(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
