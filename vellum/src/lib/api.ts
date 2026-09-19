/* ---------------------------------------------------------------
   The support API.

   Two halves:
   1. `endpoints` - a machine-readable catalogue of the REST surface.
      The API reference panel in the UI renders straight from it, so
      the documentation cannot drift from what the client calls.
   2. `api` - the typed client. Every method names the endpoint it
      maps to. It currently runs against the in-memory store in
      support.ts; point `transport` at fetch and the shapes are
      already what a real server would need to return.
   --------------------------------------------------------------- */

import {
  agents,
  categories,
  me,
  relativeTime,
  store,
} from './support'
import type {
  Actor,
  Attachment,
  Message,
  StoreEvent,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './support'

import type { EndpointSpec as Spec, HttpMethod } from './endpoint'

export const API_BASE = '/api/v1'

export type { HttpMethod, Param } from './endpoint'
export type EndpointSpec = Spec<'Tickets' | 'Messages' | 'Realtime' | 'Attachments' | 'Meta'>

export const endpoints: EndpointSpec[] = [
  {
    method: 'GET',
    path: '/tickets',
    group: 'Tickets',
    summary: 'List tickets for the authenticated requester.',
    params: [
      { name: 'status', type: 'open | pending | resolved | closed', note: 'Repeatable. Omit for all.' },
      { name: 'priority', type: 'low | normal | high | urgent', note: 'Repeatable.' },
      { name: 'category', type: 'string', note: 'Category id.' },
      { name: 'q', type: 'string', note: 'Full-text over subject, tags and message bodies.' },
      { name: 'cursor', type: 'string', note: 'Opaque cursor from the previous page.' },
      { name: 'limit', type: 'integer', note: '1-100, default 25.' },
    ],
    returns: '{ data: Ticket[], nextCursor: string | null, total: integer }',
    usedBy: 'Ticket list',
  },
  {
    method: 'POST',
    path: '/tickets',
    group: 'Tickets',
    summary: 'Open a ticket. The description becomes its first message.',
    body: [
      { name: 'subject', type: 'string', required: true, note: '3-140 characters.' },
      { name: 'category', type: 'string', required: true, note: 'One of GET /support/categories.' },
      { name: 'priority', type: 'string', note: 'Defaults to normal. urgent requires a paid tier.' },
      { name: 'description', type: 'string', required: true, note: 'Markdown. Becomes message #1.' },
      { name: 'attachmentIds', type: 'string[]', note: 'Ids from POST /uploads.' },
      { name: 'tags', type: 'string[]', note: 'Free-form labels.' },
    ],
    returns: 'Ticket (201)',
    usedBy: 'New ticket',
  },
  {
    method: 'GET',
    path: '/tickets/{ticketId}',
    group: 'Tickets',
    summary: 'Retrieve a single ticket with its current SLA state.',
    returns: 'Ticket',
  },
  {
    method: 'PATCH',
    path: '/tickets/{ticketId}',
    group: 'Tickets',
    summary: 'Update status, priority, assignee or tags. Each change appends a system message.',
    body: [
      { name: 'status', type: 'string', note: 'Requesters may only resolve or reopen.' },
      { name: 'priority', type: 'string', note: '' },
      { name: 'assigneeId', type: 'string | null', note: 'Agents only.' },
      { name: 'tags', type: 'string[]', note: 'Replaces the whole set.' },
    ],
    returns: 'Ticket',
    usedBy: 'Thread header',
  },
  {
    method: 'DELETE',
    path: '/tickets/{ticketId}',
    group: 'Tickets',
    summary: 'Archive a ticket. Soft delete - messages are retained for audit.',
    returns: '204',
  },
  {
    method: 'GET',
    path: '/tickets/{ticketId}/messages',
    group: 'Messages',
    summary: 'List the thread, oldest first.',
    params: [
      { name: 'cursor', type: 'string', note: 'Page backwards through long threads.' },
      { name: 'limit', type: 'integer', note: '1-200, default 50.' },
    ],
    returns: '{ data: Message[], nextCursor: string | null }',
    usedBy: 'Thread',
  },
  {
    method: 'POST',
    path: '/tickets/{ticketId}/messages',
    group: 'Messages',
    summary: 'Post a reply. Accepts a client id so an optimistic bubble can be reconciled.',
    body: [
      { name: 'body', type: 'string', required: true, note: 'Markdown, 1-8000 characters.' },
      { name: 'attachmentIds', type: 'string[]', note: 'Ids from POST /uploads.' },
      { name: 'clientId', type: 'string', note: 'Echoed back for idempotent retries.' },
    ],
    returns: 'Message (201)',
    usedBy: 'Composer',
  },
  {
    method: 'PATCH',
    path: '/tickets/{ticketId}/messages/{messageId}',
    group: 'Messages',
    summary: 'Edit a message within 15 minutes of posting.',
    body: [{ name: 'body', type: 'string', required: true, note: '' }],
    returns: 'Message',
  },
  {
    method: 'DELETE',
    path: '/tickets/{ticketId}/messages/{messageId}',
    group: 'Messages',
    summary: 'Retract a message. Leaves a tombstone in the thread.',
    returns: '204',
  },
  {
    method: 'POST',
    path: '/tickets/{ticketId}/read',
    group: 'Messages',
    summary: 'Mark the thread read up to the newest message. Clears the unread badge.',
    body: [{ name: 'upTo', type: 'string', note: 'Message id. Defaults to newest.' }],
    returns: '{ unread: 0 }',
    usedBy: 'Thread',
  },
  {
    method: 'GET',
    path: '/tickets/{ticketId}/events',
    group: 'Realtime',
    summary:
      'Server-sent events for one thread: message.created, message.updated, ticket.updated, agent.typing.',
    params: [
      { name: 'lastEventId', type: 'string', note: 'Resume after a dropped connection.' },
    ],
    returns: 'text/event-stream',
    usedBy: 'Messaging engine',
  },
  {
    method: 'POST',
    path: '/tickets/{ticketId}/typing',
    group: 'Realtime',
    summary: 'Signal that the requester is composing. Debounce to one call every 3s.',
    returns: '202',
    usedBy: 'Composer',
  },
  {
    method: 'POST',
    path: '/uploads',
    group: 'Attachments',
    summary: 'multipart/form-data. Returns an attachment id to attach to a ticket or message.',
    body: [
      { name: 'file', type: 'binary', required: true, note: 'Max 25 MB.' },
      { name: 'purpose', type: 'ticket | message', note: '' },
    ],
    returns: 'Attachment (201)',
    usedBy: 'Composer',
  },
  {
    method: 'GET',
    path: '/attachments/{attachmentId}',
    group: 'Attachments',
    summary: 'Redirects to a signed URL valid for 5 minutes.',
    returns: '302',
  },
  {
    method: 'GET',
    path: '/support/categories',
    group: 'Meta',
    summary: 'Category ids and labels for the ticket form.',
    returns: 'Category[]',
    usedBy: 'New ticket',
  },
  {
    method: 'GET',
    path: '/support/agents',
    group: 'Meta',
    summary: 'Agents who can be assigned on this plan.',
    returns: 'Actor[]',
  },
  {
    method: 'GET',
    path: '/support/sla',
    group: 'Meta',
    summary: 'First-response target and queue position for the current tier.',
    returns: '{ tier: string, firstResponseMinutes: integer, queue: integer }',
  },
]

export const webhookEvents = [
  { name: 'ticket.created', note: 'Fired once, after the first message is written.' },
  { name: 'ticket.updated', note: 'Status, priority, assignee or tag change.' },
  { name: 'ticket.resolved', note: 'Terminal. Also fires ticket.updated.' },
  { name: 'message.created', note: 'Both directions. Deduplicate on message.id.' },
]

export function endpointLabel(spec: EndpointSpec) {
  return `${spec.method} ${API_BASE}${spec.path}`
}

export function findEndpoint(method: HttpMethod, path: string) {
  return endpoints.find((e) => e.method === method && e.path === path)
}

/* =================================================================
   Mock transport
   ================================================================= */

const latency = (ms = 180) => new Promise((r) => setTimeout(r, ms + Math.random() * 140))

let clientSeq = 0
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(clientSeq += 1)}`

export type Page<T> = { data: T[]; nextCursor: string | null; total: number }

export type ListTicketParams = {
  status?: TicketStatus[]
  q?: string
  limit?: number
}

/** Canned agent replies, so the thread answers back and the delivery states move. */
const replies = [
  'Got it - pulling the realm logs for that window now.',
  'Thanks, that narrows it down. One more thing: does it reproduce on a fresh project, or only this one?',
  'Reproduced on our side. Raising it with the team and I will update this ticket when the fix lands.',
  'That should be sorted on the next deploy. Anything else on this one before I resolve it?',
]
let replyIdx = 0

function scheduleAgentReply(ticket: Ticket) {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return
  const agent = ticket.assignee ?? agents[0]

  const typingFor = 2600
  window.setTimeout(() => {
    store.emit({
      type: 'agent.typing',
      ticketId: ticket.id,
      actor: agent,
      until: Date.now() + typingFor,
    })
  }, 900)

  window.setTimeout(() => {
    const reply: Message = {
      id: nextId('msg'),
      ticketId: ticket.id,
      author: agent,
      body: replies[replyIdx++ % replies.length],
      createdAt: new Date().toISOString(),
      attachments: [],
      delivery: 'delivered',
    }
    store.messages.push(reply)
    store.emit({ type: 'message.created', message: reply })

    const live = store.tickets.find((x) => x.id === ticket.id)
    if (live) {
      live.unread += 1
      live.updatedAt = reply.createdAt
      store.emit({ type: 'ticket.updated', ticket: { ...live } })
    }
  }, 900 + typingFor)
}

export const api = {
  /** GET /tickets */
  async listTickets(params: ListTicketParams = {}): Promise<Page<Ticket>> {
    await latency(120)
    const q = params.q?.trim().toLowerCase()
    let rows = [...store.tickets]

    if (params.status?.length) rows = rows.filter((x) => params.status!.includes(x.status))
    if (q) {
      rows = rows.filter(
        (x) =>
          x.subject.toLowerCase().includes(q) ||
          x.id.toLowerCase().includes(q) ||
          x.tags.some((tag) => tag.includes(q)) ||
          store.messages.some((m) => m.ticketId === x.id && m.body.toLowerCase().includes(q)),
      )
    }

    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const limit = params.limit ?? 25
    return { data: rows.slice(0, limit), nextCursor: null, total: rows.length }
  },

  /** POST /tickets */
  async createTicket(input: {
    subject: string
    category: TicketCategory
    priority: TicketPriority
    description: string
    attachments?: Attachment[]
    tags?: string[]
  }): Promise<Ticket> {
    await latency(320)
    const now = new Date().toISOString()
    /* The option is disabled in the form, but a disabled option is a UI
       courtesy, not a rule - the endpoint documents "urgent requires a
       paid tier" and has to be the one that enforces it. */
    const priority = input.priority === 'urgent' ? 'high' : input.priority
    const ticket: Ticket = {
      id: store.nextTicketId(),
      subject: input.subject.trim(),
      status: 'open',
      priority,
      category: input.category,
      requester: me,
      assignee: null,
      createdAt: now,
      updatedAt: now,
      tags: input.tags ?? [],
      unread: 0,
      slaMinutes: 480,
    }
    store.tickets.unshift(ticket)

    store.messages.push({
      id: nextId('msg'),
      ticketId: ticket.id,
      author: { id: 'sys', name: 'Vellum', role: 'system' },
      body:
        input.priority === 'urgent'
          ? 'Ticket opened \u00b7 urgent is a paid tier, so this was filed as high'
          : 'Ticket opened',
      createdAt: now,
      attachments: [],
      delivery: 'read',
      event: 'created',
    })
    store.messages.push({
      id: nextId('msg'),
      ticketId: ticket.id,
      author: me,
      body: input.description.trim(),
      createdAt: now,
      attachments: input.attachments ?? [],
      delivery: 'delivered',
    })

    store.emit({ type: 'ticket.updated', ticket: { ...ticket } })
    scheduleAgentReply(ticket)
    return { ...ticket }
  },

  /** PATCH /tickets/{ticketId} */
  async updateTicket(
    ticketId: string,
    patch: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null },
  ): Promise<Ticket> {
    await latency(160)
    const ticket = store.tickets.find((x) => x.id === ticketId)
    if (!ticket) throw new Error(`404 ticket ${ticketId}`)
    const now = new Date().toISOString()

    if (patch.status && patch.status !== ticket.status) {
      ticket.status = patch.status
      store.messages.push({
        id: nextId('msg'),
        ticketId,
        author: { id: 'sys', name: 'Vellum', role: 'system' },
        body: `Status changed to ${patch.status}`,
        createdAt: now,
        attachments: [],
        delivery: 'read',
        event: 'status',
      })
    }
    if (patch.priority && patch.priority !== ticket.priority) {
      ticket.priority = patch.priority
      store.messages.push({
        id: nextId('msg'),
        ticketId,
        author: { id: 'sys', name: 'Vellum', role: 'system' },
        body: `Priority set to ${patch.priority}`,
        createdAt: now,
        attachments: [],
        delivery: 'read',
        event: 'priority',
      })
    }
    if (patch.assigneeId !== undefined) {
      ticket.assignee = agents.find((a) => a.id === patch.assigneeId) ?? null
    }

    ticket.updatedAt = now
    store.emit({ type: 'ticket.updated', ticket: { ...ticket } })
    return { ...ticket }
  },

  /** GET /tickets/{ticketId}/messages */
  async listMessages(ticketId: string): Promise<Page<Message>> {
    await latency(140)
    const data = store.messages
      .filter((m) => m.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return { data, nextCursor: null, total: data.length }
  },

  /** POST /tickets/{ticketId}/messages */
  async sendMessage(
    ticketId: string,
    input: { body: string; clientId: string; attachments?: Attachment[] },
  ): Promise<Message> {
    await latency(260)
    const ticket = store.tickets.find((x) => x.id === ticketId)
    if (!ticket) throw new Error(`404 ticket ${ticketId}`)

    const message: Message = {
      id: input.clientId,
      ticketId,
      author: me,
      body: input.body,
      createdAt: new Date().toISOString(),
      attachments: input.attachments ?? [],
      delivery: 'sent',
    }
    store.messages.push(message)
    store.emit({ type: 'message.created', message })
    store.touch(ticketId, message.createdAt)

    // the server acknowledges, then the agent's client reads it
    window.setTimeout(() => {
      message.delivery = 'delivered'
      store.emit({ type: 'message.updated', message: { ...message } })
    }, 420)
    window.setTimeout(() => {
      message.delivery = 'read'
      store.emit({ type: 'message.updated', message: { ...message } })
    }, 1500)

    scheduleAgentReply(ticket)
    return { ...message }
  },

  /** POST /tickets/{ticketId}/read */
  async markRead(ticketId: string): Promise<{ unread: 0 }> {
    const ticket = store.tickets.find((x) => x.id === ticketId)
    if (ticket && ticket.unread !== 0) {
      ticket.unread = 0
      store.emit({ type: 'ticket.updated', ticket: { ...ticket } })
    }
    return { unread: 0 }
  },

  /** POST /tickets/{ticketId}/typing */
  async sendTyping(_ticketId: string): Promise<void> {
    /* 202, no body - debounced by the caller */
  },

  /** POST /uploads */
  async upload(file: { name: string; bytes: number; mime: string }): Promise<Attachment> {
    await latency(240)
    return { id: nextId('att'), ...file }
  },

  /** GET /tickets/{ticketId}/events - SSE stand-in */
  stream(ticketId: string, onEvent: (e: StoreEvent) => void): () => void {
    return store.subscribe((e) => {
      const id =
        'message' in e ? e.message.ticketId : 'ticket' in e ? e.ticket.id : e.ticketId
      if (id === ticketId) onEvent(e)
    })
  },

  /** GET /tickets/{ticketId}/events - unfiltered, for the list's badges */
  streamAll(onEvent: (e: StoreEvent) => void): () => void {
    return store.subscribe(onEvent)
  },

  /** GET /support/categories */
  async listCategories() {
    return categories
  },

  /** GET /support/agents */
  async listAgents(): Promise<Actor[]> {
    return agents
  },

  /** GET /support/sla */
  async getSla() {
    return { tier: 'Free', firstResponseMinutes: 480, queue: 12 }
  },
}

export { relativeTime }
