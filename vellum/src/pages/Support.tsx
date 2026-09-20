import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '../components/Card'
import { Icon } from '../lib/icons'
import { api } from '../lib/api'
import {
  categories,
  clockTime,
  formatBytes,
  priorities,
  relativeTime,
  statuses,
} from '../lib/support'
import type {
  Attachment,
  Message,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../lib/support'
import './Support.css'

/* ---------------- shared bits ---------------- */

function StatusPill({ status }: { status: TicketStatus }) {
  return <span className={`pill pill--${status}`}>{status}</span>
}

function PriorityMark({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`prio prio--${priority}`} title={`Priority: ${priority}`}>
      {priority === 'urgent' || priority === 'high' ? (
        <Icon name="warning" size={10} />
      ) : (
        <span className="prio__dot" />
      )}
      {priority}
    </span>
  )
}

/* ---------------- ticket list ---------------- */

function TicketList({
  tickets,
  loading,
  activeId,
  filter,
  query,
  onFilter,
  onQuery,
  onPick,
}: {
  tickets: Ticket[]
  loading: boolean
  activeId: string | null
  filter: TicketStatus | 'all'
  query: string
  onFilter: (f: TicketStatus | 'all') => void
  onQuery: (q: string) => void
  onPick: (id: string) => void
}) {
  return (
    <div className="tl">
      <div className="tl__head">
        <div className="tl__filters" role="tablist" aria-label="Filter tickets by status">
          {(['all', ...statuses] as const).map((f) => (
            <button
              key={f}
              role="tab"
              className="tl__filter"
              aria-selected={f === filter}
              onClick={() => onFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="tl__search">
          <Icon name="search" size={13} />
          <input
            value={query}
            placeholder="Search tickets"
            aria-label="Search tickets"
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="tl__rows">
        {loading && !tickets.length ? (
          <p className="tl__empty">Loading&hellip;</p>
        ) : !tickets.length ? (
          <p className="tl__empty">No tickets match this filter.</p>
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              className="tl__row"
              aria-current={t.id === activeId ? 'true' : undefined}
              onClick={() => onPick(t.id)}
            >
              <span className={`tl__stripe tl__stripe--${t.priority}`} aria-hidden="true" />
              <span className="tl__body">
                <span className="tl__top">
                  <span className="tl__id mono">{t.id}</span>
                  <StatusPill status={t.status} />
                  {t.unread ? <span className="tl__unread">{t.unread}</span> : null}
                  <span className="tl__when mono">{relativeTime(t.updatedAt)}</span>
                </span>
                <span className="tl__subject">{t.subject}</span>
                <span className="tl__meta">
                  <PriorityMark priority={t.priority} />
                  <span className="tl__assignee">
                    <Icon name="user" size={10} />
                    {t.assignee ? t.assignee.name : 'Unassigned'}
                  </span>
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/* ---------------- message thread ---------------- */

function DeliveryTick({ state }: { state: Message['delivery'] }) {
  if (state === 'failed') return <Icon name="warning" size={11} />
  if (state === 'sending') return <Icon name="clock" size={11} />
  return (
    <span className={`tick${state === 'read' ? ' tick--read' : ''}`}>
      <Icon name="check" size={11} />
      {state === 'delivered' || state === 'read' ? <Icon name="check" size={11} /> : null}
    </span>
  )
}

function MessageBubble({ message, onRetry }: { message: Message; onRetry: (m: Message) => void }) {
  if (message.author.role === 'system') {
    return (
      <div className="ev">
        <span className="ev__line" />
        <span className="ev__text">
          {message.body}
          <span className="mono"> &middot; {clockTime(message.createdAt)}</span>
        </span>
        <span className="ev__line" />
      </div>
    )
  }

  const mine = message.author.role === 'requester'
  return (
    <div className={`bub${mine ? ' bub--mine' : ''}`}>
      {!mine ? <span className="bub__who">{message.author.name}</span> : null}
      <div className={`bub__body${message.delivery === 'failed' ? ' bub__body--failed' : ''}`}>
        <p>{message.body}</p>

        {message.attachments.length ? (
          <div className="bub__atts">
            {message.attachments.map((a) => (
              <span className="att" key={a.id}>
                <Icon name={a.mime.startsWith('image/') ? 'image' : 'file'} size={12} />
                <span className="att__name">{a.name}</span>
                <span className="att__size mono">{formatBytes(a.bytes)}</span>
              </span>
            ))}
          </div>
        ) : null}

        <span className="bub__foot mono">
          {clockTime(message.createdAt)}
          {mine ? <DeliveryTick state={message.delivery} /> : null}
        </span>
      </div>
      {message.delivery === 'failed' ? (
        <button className="bub__retry" onClick={() => onRetry(message)}>
          <Icon name="refresh" size={11} /> Retry
        </button>
      ) : null}
    </div>
  )
}

function Composer({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (body: string, attachments: Attachment[]) => void
  onTyping: () => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const box = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const body = value.trim()
    if (!body || disabled) return
    onSend(body, attachments)
    setValue('')
    setAttachments([])
    box.current?.focus()
  }

  // stands in for a file picker - POST /uploads returns the id we attach
  const attach = async () => {
    const stub = { name: `capture-${attachments.length + 1}.png`, bytes: 148_000, mime: 'image/png' }
    const att = await api.upload(stub)
    setAttachments((a) => [...a, att])
  }

  return (
    <div className="cmp">
      {attachments.length ? (
        <div className="cmp__atts">
          {attachments.map((a) => (
            <span className="att att--draft" key={a.id}>
              <Icon name="image" size={12} />
              <span className="att__name">{a.name}</span>
              <button
                aria-label={`Remove ${a.name}`}
                onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))}
              >
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="cmp__row">
        <textarea
          ref={box}
          className="cmp__box"
          rows={2}
          value={value}
          placeholder={disabled ? 'This ticket is closed.' : 'Write a reply…'}
          disabled={disabled}
          aria-label="Reply"
          onChange={(e) => {
            setValue(e.target.value)
            onTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="cmp__side">
          <button className="icon-btn" onClick={attach} disabled={disabled} aria-label="Attach a file">
            <Icon name="upload" size={15} />
          </button>
          <button className="btn btn--primary btn--sm" onClick={submit} disabled={disabled || !value.trim()}>
            <Icon name="arrowRight" size={13} /> Send
          </button>
        </div>
      </div>

      <div className="cmp__foot">
        <span className="cmp__hint mono">Enter sends &middot; Shift+Enter newline</span>
      </div>
    </div>
  )
}

function Thread({
  ticket,
  messages,
  typing,
  onSend,
  onRetry,
  onPatch,
}: {
  ticket: Ticket
  messages: Message[]
  typing: string | null
  onSend: (body: string, attachments: Attachment[]) => void
  onRetry: (m: Message) => void
  onPatch: (patch: { status?: TicketStatus; priority?: TicketPriority }) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, typing])

  const typingRef = useRef<() => void>(() => {})
  typingRef.current = () => {
    void api.sendTyping(ticket.id)
  }

  return (
    <div className="th">
      <header className="th__head">
        <div className="th__title">
          <span className="mono th__id">{ticket.id}</span>
          <h2 className="th__subject">{ticket.subject}</h2>
          <div className="th__tags">
            {ticket.tags.map((tag) => (
              <span className="tag" key={tag}>
                #{tag}
              </span>
            ))}
            {ticket.slaMinutes !== null ? (
              <span className="tag tag--sla">
                <Icon name="clock" size={10} /> first response in {ticket.slaMinutes}m
              </span>
            ) : null}
          </div>
        </div>

        <div className="th__controls">
          <label className="ctl">
            <span className="ctl__k">Status</span>
            <select
              value={ticket.status}
              onChange={(e) => onPatch({ status: e.target.value as TicketStatus })}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="ctl">
            <span className="ctl__k">Priority</span>
            <select
              value={ticket.priority}
              onChange={(e) => onPatch({ priority: e.target.value as TicketPriority })}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="th__scroll" ref={scroller}>

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onRetry={onRetry} />
        ))}

        {typing ? (
          <div className="bub">
            <span className="bub__who">{typing}</span>
            <div className="bub__body bub__body--typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        ) : null}
      </div>

      <Composer
        onSend={onSend}
        onTyping={() => typingRef.current()}
        disabled={ticket.status === 'closed'}
      />
    </div>
  )
}

/* ---------------- new ticket ---------------- */

function NewTicket({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Ticket) => void }) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('editor')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const valid = subject.trim().length >= 3 && description.trim().length > 0

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      const ticket = await api.createTicket({ subject, category, priority, description })
      onCreate(ticket)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dlg" role="dialog" aria-modal="true" aria-label="Open a ticket">
      <div className="dlg__scrim" onClick={onClose} />
      <div className="dlg__panel">
        <header className="dlg__head">
          <div>
            <div className="eyebrow">Support</div>
            <h2 className="card__title">Open a ticket</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dlg__body">
          <div className="field-grid">
            <label className="field field--wide">
              <span className="field__label">Subject</span>
              <input
                ref={first}
                className="field__input"
                value={subject}
                maxLength={140}
                placeholder="One line on what went wrong"
                onChange={(e) => setSubject(e.target.value)}
              />
              <span className="field__hint">{subject.length}/140 &middot; 3 characters minimum</span>
            </label>

            <label className="field">
              <span className="field__label">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                {priorities.map((p) => (
                  <option key={p} value={p} disabled={p === 'urgent'}>
                    {p}
                    {p === 'urgent' ? ' — paid tiers' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field--wide">
              <span className="field__label">What happened</span>
              <textarea
                value={description}
                placeholder="Steps, what you expected, what you got instead."
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="field__hint">Becomes the first message on the thread.</span>
            </label>
          </div>
        </div>

        <footer className="dlg__foot">
          <span className="cmp__hint mono">Free tier &middot; first response target 8h</span>
          <div className="row-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={!valid || busy}>
              {busy ? 'Opening…' : 'Open ticket'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ---------------- section root ---------------- */

export function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [typing, setTyping] = useState<string | null>(null)
  const [dialog, setDialog] = useState(false)

  // GET /tickets
  const load = useCallback(async () => {
    setLoading(true)
    const page = await api.listTickets({
      status: filter === 'all' ? undefined : [filter],
      q: query || undefined,
    })
    setTickets(page.data)
    setLoading(false)
    setActiveId((cur) => (cur && page.data.some((t) => t.id === cur) ? cur : page.data[0]?.id ?? null))
  }, [filter, query])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const page = await api.listTickets({
        status: filter === 'all' ? undefined : [filter],
        q: query || undefined,
      })
      if (cancelled) return
      setTickets(page.data)
      setLoading(false)
      setActiveId((cur) =>
        cur && page.data.some((t) => t.id === cur) ? cur : page.data[0]?.id ?? null,
      )
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [filter, query])

  // GET /tickets/{id}/messages + POST /tickets/{id}/read
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    void (async () => {
      const page = await api.listMessages(activeId)
      if (cancelled) return
      setMessages(page.data)
      await api.markRead(activeId)
    })()
    return () => {
      cancelled = true
    }
  }, [activeId])

  // GET /tickets/{id}/events - the messaging engine
  useEffect(() => {
    return api.streamAll((e) => {
      if (e.type === 'ticket.updated') {
        setTickets((rows) => rows.map((t) => (t.id === e.ticket.id ? e.ticket : t)))
        return
      }
      if (e.type === 'agent.typing') {
        if (e.ticketId !== activeId) return
        setTyping(e.actor.name)
        window.setTimeout(() => setTyping(null), Math.max(0, e.until - Date.now()))
        return
      }
      if (e.message.ticketId !== activeId) return
      setTyping(null)
      setMessages((rows) => {
        const i = rows.findIndex((m) => m.id === e.message.id)
        if (i === -1) return [...rows, e.message]
        const next = [...rows]
        next[i] = e.message
        return next
      })
      if (e.type === 'message.created' && e.message.author.role === 'agent') {
        void api.markRead(e.message.ticketId)
      }
    })
  }, [activeId])

  const active = tickets.find((t) => t.id === activeId) ?? null

  // POST /tickets/{id}/messages, rendered optimistically
  const send = async (body: string, attachments: Attachment[]) => {
    if (!active) return
    const clientId = `msg_${Date.now().toString(36)}`
    const optimistic: Message = {
      id: clientId,
      ticketId: active.id,
      author: { id: 'usr_galex', name: 'g.alex', role: 'requester' },
      body,
      createdAt: new Date().toISOString(),
      attachments,
      delivery: 'sending',
    }
    setMessages((rows) => [...rows, optimistic])
    try {
      await api.sendMessage(active.id, { body, clientId, attachments })
    } catch {
      setMessages((rows) =>
        rows.map((m) => (m.id === clientId ? { ...m, delivery: 'failed' as const } : m)),
      )
    }
  }

  const retry = (m: Message) => {
    setMessages((rows) => rows.filter((x) => x.id !== m.id))
    void send(m.body, m.attachments)
  }

  const patch = async (p: { status?: TicketStatus; priority?: TicketPriority }) => {
    if (!active) return
    const updated = await api.updateTicket(active.id, p)
    setTickets((rows) => rows.map((t) => (t.id === updated.id ? updated : t)))
    const page = await api.listMessages(updated.id)
    setMessages(page.data)
  }

  const open = tickets.filter((t) => t.status === 'open').length
  const unread = tickets.reduce((n, t) => n + t.unread, 0)

  return (
    <>
      <p className="sup__note">
        <Icon name="info" size={13} />
        The ticketing and messaging here are live against an in-browser mock transport - open a
        ticket, reply, and the thread answers back.
      </p>

      <div className="sup__bar">
        <div className="sup__stats">
          <span className="sup__stat">
            <strong className="mono">{tickets.length}</strong> tickets
          </span>
          <span className="sup__stat">
            <strong className="mono">{open}</strong> open
          </span>
          <span className="sup__stat">
            <strong className="mono">{unread}</strong> unread
          </span>
          <span className="sup__stat sup__stat--tier">
            <Icon name="lock" size={11} /> Free tier &middot; 8h first response &middot; queue 12
          </span>
        </div>
        <button className="btn btn--primary" onClick={() => setDialog(true)}>
          <Icon name="plus" size={14} /> New ticket
        </button>
      </div>

      <Card variant="flush" className="sup__wrap">
        <div className="sup">
          <TicketList
            tickets={tickets}
            loading={loading}
            activeId={activeId}
            filter={filter}
            query={query}
            onFilter={setFilter}
            onQuery={setQuery}
            onPick={setActiveId}
          />
          {active ? (
            <Thread
              ticket={active}
              messages={messages}
              typing={typing}
              onSend={send}
              onRetry={retry}
              onPatch={patch}
            />
          ) : (
            <div className="th th--empty">
              <Icon name="support" size={22} />
              <p>Pick a ticket, or open a new one.</p>
            </div>
          )}
        </div>
      </Card>

      {dialog ? (
        <NewTicket
          onClose={() => setDialog(false)}
          onCreate={(t) => {
            setDialog(false)
            setFilter('all')
            setQuery('')
            void load()
            setActiveId(t.id)
          }}
        />
      ) : null}
    </>
  )
}
