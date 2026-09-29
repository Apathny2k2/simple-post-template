import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Pip } from '../components/Pip'
import type { PipMood } from '../components/Pip'
import { TicketForm } from '../components/TicketForm'
import { Icon } from '../lib/icons'
import { api } from '../lib/api'
import { blankDraft, clockTime, formatBytes, me, relativeTime, subjectOf } from '../lib/support'
import type { Attachment, Message, Ticket, TicketDraft, TicketStatus } from '../lib/support'
import './Support.css'

/* Pip mines while a new ticket sends and fishes while an agent types a reply.
   What he waited for appears once his ending has played. */

type View = 'open' | 'closed'

const viewOf = (status: TicketStatus): View => (status === 'open' || status === 'pending' ? 'open' : 'closed')

const statusWord: Record<TicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
}

/** Someone on the team typing into the open thread. `done` once their reply is in. */
type Writing = { ticketId: string; name: string; mood: 'working' | 'done' }

function upsert(rows: Message[], m: Message) {
  const i = rows.findIndex((x) => x.id === m.id)
  if (i === -1) return [...rows, m]
  const next = [...rows]
  next[i] = m
  return next
}

/* ---------------- the list ---------------- */

function TicketList({
  tickets,
  loaded,
  view,
  query,
  activeId,
  composing,
  draft,
  fresh,
  onView,
  onQuery,
  onPick,
  onNew,
}: {
  tickets: Ticket[]
  loaded: boolean
  view: View
  query: string
  activeId: string | null
  composing: boolean
  draft: TicketDraft
  fresh: string | null
  onView: (v: View) => void
  onQuery: (q: string) => void
  onPick: (id: string) => void
  onNew: () => void
}) {
  const count = (v: View) => tickets.filter((t) => viewOf(t.status) === v).length
  const rows = tickets
    .filter((t) => viewOf(t.status) === view)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const drafted = view === 'open' && (composing || draft.text.trim() !== '')

  return (
    <div className="tickets">
      <div className="tickets__head">
        <div className="tickets__tabs" role="tablist" aria-label="Tickets">
          {(['open', 'closed'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              className="tickets__tab"
              aria-selected={v === view}
              aria-controls="support-rows"
              onClick={() => onView(v)}
            >
              {v === 'open' ? 'Open' : 'Closed'}
              <span className="tickets__count">{count(v)}</span>
            </button>
          ))}
        </div>
        <button className="btn btn--primary btn--sm tickets__new" onClick={onNew} aria-label="New ticket">
          <Icon name="plus" size={13} /> New
        </button>
      </div>

      <label className="tickets__search">
        <Icon name="search" size={13} />
        <input
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search tickets"
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>

      <div className="tickets__rows" id="support-rows" role="tabpanel">
        {drafted ? (
          <button className="tickets__row tickets__row--draft" aria-current={composing ? 'true' : undefined} onClick={onNew}>
            <span className="tickets__line">
              <Icon name="pencil" size={12} />
              <span className="tickets__subject">{subjectOf(draft.text) || 'New ticket'}</span>
            </span>
            <span className="tickets__meta">Draft</span>
          </button>
        ) : null}

        {rows.map((t) => (
          <button
            key={t.id}
            className="tickets__row"
            aria-current={!composing && t.id === activeId ? 'true' : undefined}
            data-unread={t.unread > 0 || undefined}
            data-fresh={t.id === fresh || undefined}
            onClick={() => onPick(t.id)}
          >
            <span className="tickets__line">
              <span className="tickets__subject">{t.subject}</span>
              {t.unread ? (
                <span className="tickets__unread">
                  {t.unread}
                  <span className="visually-hidden"> unread</span>
                </span>
              ) : null}
            </span>
            <span className="tickets__meta">
              <span className="tickets__status" data-status={t.status}>
                {statusWord[t.status]}
              </span>
              {t.priority === 'high' || t.priority === 'urgent' ? (
                <span className="tickets__priority" data-priority={t.priority}>
                  {t.priority}
                </span>
              ) : null}
              <span className="tickets__who">{t.assignee ? t.assignee.name : 'Unassigned'}</span>
              <span className="tickets__when">{relativeTime(t.updatedAt)}</span>
            </span>
          </button>
        ))}

        {loaded && !rows.length && !drafted ? (
          <p className="tickets__empty">
            {query.trim() ? 'Nothing matches that search.' : view === 'open' ? 'Nothing open.' : 'Nothing closed yet.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ---------------- a thread ---------------- */

function Delivery({ state }: { state: Message['delivery'] }) {
  if (state === 'failed') return null
  if (state === 'sending') return <Icon name="clock" size={11} />
  return (
    <span className="tick" data-read={state === 'read' || undefined}>
      <Icon name="check" size={11} />
      {state === 'delivered' || state === 'read' ? <Icon name="check" size={11} /> : null}
      <span className="visually-hidden">{state}</span>
    </span>
  )
}

function Bubble({
  message,
  lead,
  tail,
  onRetry,
}: {
  message: Message
  lead: boolean
  tail: boolean
  onRetry: (m: Message) => void
}) {
  if (message.author.role === 'system') {
    return (
      <p className="system-line">
        {message.body} <span className="mono">{clockTime(message.createdAt)}</span>
      </p>
    )
  }

  const mine = message.author.role === 'requester'
  const failed = message.delivery === 'failed'
  return (
    <div className={`message${mine ? ' message--mine' : ''}`} data-lead={lead || undefined}>
      {lead && !mine ? <span className="message__who">{message.author.name}</span> : null}
      <div className="message__body" data-failed={failed || undefined}>
        <p>{message.body}</p>
        {message.attachments.length ? (
          <div className="message__attachments">
            {message.attachments.map((a) => (
              <span className="attachment" key={a.id}>
                <Icon name={a.mime.startsWith('image/') ? 'image' : 'file'} size={12} />
                <span className="attachment__name">{a.name}</span>
                <span className="attachment__size mono">{formatBytes(a.bytes)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {failed ? (
        <button className="message__retry" onClick={() => onRetry(message)}>
          <Icon name="refresh" size={11} /> Not sent. Try again
        </button>
      ) : tail ? (
        <span className="message__foot mono">
          {clockTime(message.createdAt)}
          {mine ? <Delivery state={message.delivery} /> : null}
        </span>
      ) : null}
    </div>
  )
}

function Composer({
  ticketId,
  to,
  onSend,
}: {
  ticketId: string
  to: string | null
  onSend: (body: string, attachments: Attachment[]) => void
}) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  /* Grows with the text, up to a few lines. Empty, it keeps its CSS height,
     so a narrow screen hiding it does not collapse it. */
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = ''
    if (value) el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [value])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const body = value.trim()
    if (!body) return
    onSend(body, attachments)
    setValue('')
    setAttachments([])
    box.current?.focus()
  }

  // POST /uploads with what the picker chose; the mock keeps the name and size
  const attach = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const att = await api.upload({ name: f.name, bytes: f.size, mime: f.type || 'application/octet-stream' })
      setAttachments((a) => [...a, att])
    }
    if (picker.current) picker.current.value = ''
  }

  return (
    <form className="composer" onSubmit={submit}>
      {attachments.length ? (
        <div className="composer__attachments">
          {attachments.map((a) => (
            <span className="attachment attachment--draft" key={a.id}>
              <Icon name={a.mime.startsWith('image/') ? 'image' : 'file'} size={12} />
              <span className="attachment__name">{a.name}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))}
              >
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="composer__field">
        <textarea
          ref={box}
          className="composer__box"
          rows={1}
          value={value}
          placeholder={to ? `Reply to ${to}` : 'Write a reply'}
          aria-label="Reply"
          onChange={(e) => {
            setValue(e.target.value)
            void api.sendTyping(ticketId)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <input ref={picker} type="file" multiple hidden onChange={(e) => void attach(e.target.files)} />
        <button
          type="button"
          className="composer__tool"
          aria-label="Attach files"
          title="Attach files"
          onClick={() => picker.current?.click()}
        >
          <Icon name="clip" size={16} />
        </button>
        <button type="submit" className="composer__send" aria-label="Send" title="Send (Enter)" disabled={!value.trim()}>
          <Icon name="arrowUp" size={16} strokeWidth={2} />
        </button>
      </div>
    </form>
  )
}

function Thread({
  ticket,
  messages,
  writing,
  onWritten,
  onSend,
  onRetry,
  onStatus,
  onBack,
}: {
  ticket: Ticket
  messages: Message[]
  writing: Writing | null
  onWritten: () => void
  onSend: (body: string, attachments: Attachment[]) => void
  onRetry: (m: Message) => void
  onStatus: (status: TicketStatus) => void
  onBack: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const last = messages[messages.length - 1]?.id

  // new messages, and Pip, arrive at the bottom
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [ticket.id, last, writing])

  // a narrow screen mounts the thread hidden, so scroll to the end once it shows
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let height = el.clientHeight
    const ro = new ResizeObserver(() => {
      if (height === 0 && el.clientHeight > 0) el.scrollTop = el.scrollHeight
      height = el.clientHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const open = viewOf(ticket.status) === 'open'
  const said = (m: Message | undefined) => (m && m.author.role !== 'system' ? m.author.id : null)

  return (
    <section className="thread" aria-labelledby="support-subject">
      <header className="thread__head">
        <button className="icon-btn thread__back" onClick={onBack} aria-label="Back to your tickets">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="thread__title">
          <h2 className="thread__subject" id="support-subject">
            {ticket.subject}
          </h2>
          <p className="thread__meta">
            <span className="tickets__status" data-status={ticket.status}>
              {statusWord[ticket.status]}
            </span>
            <span className="mono">{ticket.id}</span>
            <span>{ticket.assignee ? ticket.assignee.name : 'Not picked up yet'}</span>
          </p>
        </div>
        <button className="btn btn--sm thread__action" onClick={() => onStatus(open ? 'resolved' : 'open')}>
          <Icon name={open ? 'check' : 'undo'} size={13} />
          <span className="thread__action-label">{open ? 'Mark resolved' : 'Reopen'}</span>
        </button>
      </header>

      <div className="thread__scroll" ref={scroller}>
        <div className="thread__stream">
          {messages.map((m, i) => (
            <Bubble
              key={m.id}
              message={m}
              lead={said(messages[i - 1]) !== said(m)}
              tail={said(messages[i + 1]) !== said(m)}
              onRetry={onRetry}
            />
          ))}

          {writing ? (
            <div className="thread__writer">
              <span className="message__who" role="status">
                {writing.name} is writing
              </span>
              <Pip scene="fish" mood={writing.mood} maxScale={2} onFinish={onWritten} className="thread__pip" />
            </div>
          ) : null}
        </div>
      </div>

      {ticket.status === 'closed' ? (
        <p className="thread__closed">This ticket is closed. Reopen it to reply.</p>
      ) : (
        <Composer key={ticket.id} ticketId={ticket.id} to={ticket.assignee?.name ?? null} onSend={onSend} />
      )}
    </section>
  )
}

/* ---------------- a new ticket ---------------- */

function Compose({
  draft,
  sending,
  failed,
  replyHours,
  onDraft,
  onSend,
  onSent,
  onClose,
}: {
  draft: TicketDraft
  sending: PipMood | null
  failed: boolean
  replyHours: number | null
  onDraft: (d: TicketDraft) => void
  onSend: () => void
  onSent: () => void
  onClose: () => void
}) {
  const subject = subjectOf(draft.text)

  return (
    <section className="thread new-ticket" aria-labelledby="support-subject">
      <header className="thread__head">
        <button className="icon-btn thread__back" onClick={onClose} aria-label="Back to your tickets">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="thread__title">
          <h2 className="thread__subject" id="support-subject" data-empty={!subject || undefined}>
            {subject || 'New ticket'}
          </h2>
          <p className="thread__meta">
            {sending
              ? 'On its way to the Vellum team'
              : replyHours
                ? `The Vellum team replies within ${replyHours} hours on the free tier.`
                : 'Goes to the Vellum team.'}
          </p>
        </div>
        {sending ? null : (
          <button className="icon-btn" onClick={onClose} aria-label="Close and keep the draft" title="Close and keep the draft">
            <Icon name="close" size={15} />
          </button>
        )}
      </header>

      {sending ? (
        <div className="new-ticket__run">
          <Pip mood={sending} onFinish={onSent} className="new-ticket__pip" label="Sending your ticket" />
        </div>
      ) : (
        <TicketForm draft={draft} onDraft={onDraft} onSend={onSend} failed={failed} autoFocus className="new-ticket__form" />
      )}
    </section>
  )
}

/* ---------------- the section ---------------- */

export function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>('open')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ q: string; ids: Set<string> } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  // on a narrow screen the list and the thread take turns
  const [pane, setPane] = useState<'list' | 'detail'>('list')
  const [messages, setMessages] = useState<Message[]>([])
  const [writing, setWritingState] = useState<Writing | null>(null)
  const [draft, setDraft] = useState<TicketDraft>(blankDraft)
  const [sending, setSending] = useState<PipMood | null>(null)
  const [sendFailed, setSendFailed] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [replyHours, setReplyHours] = useState<number | null>(null)

  /* State the event handler reads. It is a ref so the subscription, made
     once, still sees the current thread. */
  const live = useRef<{ activeId: string | null; composing: boolean; writing: Writing | null }>({
    activeId: null,
    composing: false,
    writing: null,
  })
  /** replies that came in while Pip was still fishing for them */
  const held = useRef<Message[]>([])
  /** who is typing where, and until when */
  const typing = useRef(new Map<string, { name: string; until: number }>())
  const quiet = useRef(0)
  const created = useRef<Ticket | null>(null)

  const setWriting = (w: Writing | null) => {
    live.current.writing = w
    setWritingState(w)
  }

  /** What came in while Pip was fishing goes into the thread. */
  const release = () => {
    const replies = held.current
    held.current = []
    if (replies.length) setMessages((rows) => replies.reduce(upsert, rows))
  }

  useEffect(() => {
    live.current.activeId = activeId
  }, [activeId])

  useEffect(() => () => window.clearTimeout(quiet.current), [])

  // GET /tickets, once; the stream keeps it current after that
  useEffect(() => {
    let stop = false
    void api.listTickets({ limit: 100 }).then((page) => {
      if (stop) return
      setTickets(page.data)
      setLoaded(true)
      setActiveId((cur) => cur ?? page.data.find((t) => viewOf(t.status) === 'open')?.id ?? page.data[0]?.id ?? null)
    })
    void api.getSla().then((sla) => {
      if (!stop) setReplyHours(Math.round(sla.firstResponseMinutes / 60))
    })
    return () => {
      stop = true
    }
  }, [])

  // GET /tickets?q=. The server also searches message text, so it answers with ids.
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let stop = false
    void api.listTickets({ q, limit: 100 }).then((page) => {
      if (!stop) setFound({ q, ids: new Set(page.data.map((t) => t.id)) })
    })
    return () => {
      stop = true
    }
  }, [query])

  // GET /tickets/{id}/messages + POST /tickets/{id}/read
  useEffect(() => {
    if (!activeId) return
    let stop = false
    void api.listMessages(activeId).then((page) => {
      if (stop) return
      const waiting = new Set(held.current.map((m) => m.id))
      setMessages(page.data.filter((m) => !waiting.has(m.id)))
      void api.markRead(activeId)
    })
    return () => {
      stop = true
    }
  }, [activeId])

  /** Pip fishes while someone types into the open thread, and goes if they stop without sending. */
  const watchWriter = (ticketId: string) => {
    const t = typing.current.get(ticketId)
    if (!t) return
    if (live.current.writing?.ticketId !== ticketId) setWriting({ ticketId, name: t.name, mood: 'working' })
    window.clearTimeout(quiet.current)
    quiet.current = window.setTimeout(
      () => {
        const w = live.current.writing
        const still = typing.current.get(ticketId)
        if (w?.ticketId !== ticketId || w.mood !== 'working') return
        if (still && still.until > Date.now()) return
        typing.current.delete(ticketId)
        release()
        setWriting(null)
      },
      Math.max(0, t.until - Date.now()) + 1500,
    )
  }

  // events for every ticket: one subscription for the list's badges and the open thread
  useEffect(
    () =>
      api.streamAll((e) => {
        if (e.type === 'ticket.updated') {
          // a ticket being read has nothing unread
          const reading = e.ticket.id === live.current.activeId && !live.current.composing
          const ticket = reading && e.ticket.unread ? { ...e.ticket, unread: 0 } : e.ticket
          setTickets((rows) => rows.map((t) => (t.id === ticket.id ? ticket : t)))
          if (ticket !== e.ticket) void api.markRead(ticket.id)
          return
        }
        if (e.type === 'agent.typing') {
          typing.current.set(e.ticketId, { name: e.actor.name, until: e.until })
          if (e.ticketId === live.current.activeId && !live.current.composing) watchWriter(e.ticketId)
          return
        }
        const m = e.message
        const reply = e.type === 'message.created' && m.author.role === 'agent'
        if (reply) typing.current.delete(m.ticketId)
        if (m.ticketId !== live.current.activeId) return
        const w = live.current.writing
        if (e.type === 'message.created' && m.author.role !== 'requester' && w?.ticketId === m.ticketId) {
          // he finishes first, and what came in shows when he is done
          held.current.push(m)
          if (reply) setWriting({ ...w, mood: 'done' })
          return
        }
        setMessages((rows) => upsert(rows, m))
      }),
    // the handler reads everything that changes through refs
    [],
  )

  const written = () => {
    release()
    setWriting(null)
  }

  /** Puts a newly created ticket at the top of the list. */
  const file = (ticket: Ticket) => {
    setDraft(blankDraft)
    setTickets((rows) => [ticket, ...rows.filter((r) => r.id !== ticket.id)])
    setFresh(ticket.id)
    window.setTimeout(() => setFresh((f) => (f === ticket.id ? null : f)), 2400)
  }

  /** Leaving the form while a ticket is still on its way files it without the ending. */
  const leaveForm = () => {
    live.current.composing = false
    setComposing(false)
    if (sending && created.current) {
      file(created.current)
      created.current = null
      setSending(null)
    }
  }

  const select = (id: string) => {
    const same = id === live.current.activeId
    if (same && !live.current.composing) {
      setPane('detail')
      return
    }
    leaveForm()
    release()
    live.current.activeId = id
    setActiveId(id)
    setPane('detail')
    // back from the form to the same thread, nothing reloads it, so it is marked read here
    if (same) void api.markRead(id)
    const t = typing.current.get(id)
    if (t && t.until > Date.now()) watchWriter(id)
    else setWriting(null)
  }

  const startNew = () => {
    live.current.composing = true
    setComposing(true)
    setView('open')
    setPane('detail')
    release()
    setWriting(null)
  }

  const closeNew = () => {
    leaveForm()
    setPane('list')
    const id = live.current.activeId
    if (id) void api.markRead(id)
    const t = id ? typing.current.get(id) : undefined
    if (id && t && t.until > Date.now()) watchWriter(id)
  }

  // POST /tickets
  const sendNew = async () => {
    const subject = subjectOf(draft.text)
    if (subject.length < 3 || sending) return
    setSendFailed(false)
    setSending('working')
    created.current = null
    try {
      const ticket = await api.createTicket({
        subject,
        category: draft.category ?? 'other',
        priority: draft.blocking ? 'high' : 'normal',
        description: draft.text.trim(),
      })
      if (live.current.composing) {
        created.current = ticket
        setSending('done')
      } else {
        // they moved on while it was sending
        file(ticket)
        setSending(null)
      }
    } catch {
      if (live.current.composing) setSending('failed')
      else {
        setSending(null)
        setSendFailed(true)
      }
    }
  }

  /** Runs after Pip's ending: files the new ticket, or shows the failure. */
  const sent = () => {
    const ticket = created.current
    created.current = null
    setSending(null)
    if (!ticket) {
      setSendFailed(true)
      return
    }
    file(ticket)
    setQuery('')
    select(ticket.id)
  }

  // POST /tickets/{id}/messages, shown before the server has it
  const send = async (body: string, attachments: Attachment[]) => {
    const ticketId = live.current.activeId
    if (!ticketId) return
    const clientId = `msg_${Date.now().toString(36)}`
    const optimistic: Message = {
      id: clientId,
      ticketId,
      author: me,
      body,
      createdAt: new Date().toISOString(),
      attachments,
      delivery: 'sending',
    }
    setMessages((rows) => [...rows, optimistic])
    try {
      await api.sendMessage(ticketId, { body, clientId, attachments })
    } catch {
      setMessages((rows) => rows.map((m) => (m.id === clientId ? { ...m, delivery: 'failed' as const } : m)))
    }
  }

  const retry = (m: Message) => {
    setMessages((rows) => rows.filter((x) => x.id !== m.id))
    void send(m.body, m.attachments)
  }

  // PATCH /tickets/{id}
  const setStatus = async (status: TicketStatus) => {
    const id = live.current.activeId
    if (!id) return
    const updated = await api.updateTicket(id, { status })
    setTickets((rows) => rows.map((t) => (t.id === updated.id ? updated : t)))
    const page = await api.listMessages(updated.id)
    const waiting = new Set(held.current.map((m) => m.id))
    if (live.current.activeId === updated.id) setMessages(page.data.filter((m) => !waiting.has(m.id)))
  }

  const q = query.trim()
  const shown = q && found?.q === q ? tickets.filter((t) => found.ids.has(t.id)) : tickets
  const active = tickets.find((t) => t.id === activeId) ?? null
  const thread = messages.filter((m) => m.ticketId === activeId)

  return (
    <div className="support" data-pane={pane}>
      <TicketList
        tickets={shown}
        loaded={loaded}
        view={view}
        query={query}
        activeId={activeId}
        composing={composing}
        draft={draft}
        fresh={fresh}
        onView={setView}
        onQuery={setQuery}
        onPick={select}
        onNew={startNew}
      />

      {composing ? (
        <Compose
          draft={draft}
          sending={sending}
          failed={sendFailed}
          replyHours={replyHours}
          onDraft={(d) => {
            setDraft(d)
            setSendFailed(false)
          }}
          onSend={() => void sendNew()}
          onSent={sent}
          onClose={closeNew}
        />
      ) : active ? (
        <Thread
          ticket={active}
          messages={thread}
          writing={writing?.ticketId === active.id ? writing : null}
          onWritten={written}
          onSend={(body, atts) => void send(body, atts)}
          onRetry={retry}
          onStatus={(s) => void setStatus(s)}
          onBack={() => setPane('list')}
        />
      ) : (
        <div className="thread thread--empty">
          {loaded ? (
            <>
              <p>No tickets yet.</p>
              <button className="btn btn--primary btn--sm" onClick={startNew}>
                <Icon name="plus" size={13} /> New ticket
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
