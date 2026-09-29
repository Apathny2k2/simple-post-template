import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Kinetic } from '../components/Kinetic'
import { Icon, VellumMark } from '../lib/icons'
import type { IconName } from '../lib/icons'
import { navigate, useTitle } from '../lib/router'
import { trackPointer, useReducedMotion } from '../lib/motion'
import { Showcase } from './dash/showcase'
import './Home.css'

/* vellumdev.com: what Vellum is, for someone who has not used it yet,
   and the way into the Studio for someone who has. */

const features: { icon: IconName; title: string; body: string; colour: string }[] = [
  {
    icon: 'cube',
    title: 'Shape',
    body: 'Cubes and bones, pivots and rotations. Start from an item, a block, a rigged mob or a consumable.',
    colour: 'var(--bb-blue-hi)',
  },
  {
    icon: 'brush',
    title: 'Paint',
    body: 'Paint on the model itself or on its sheet, one texel per unit, the way the game draws its own.',
    colour: 'var(--bb-violet)',
  },
  {
    icon: 'anim',
    title: 'Animate',
    body: 'Key clips on a timeline, or let Vellum read the rig and build its idle, walk and attack.',
    colour: 'var(--bb-amber)',
  },
  {
    icon: 'server',
    title: 'Ship',
    body: 'Push a pack, see which players have it, and apply new files to the running server.',
    colour: 'var(--bb-green)',
  },
]

const steps = [
  { title: 'Install the plugin', body: 'Put it in your server’s plugins folder and start the server.' },
  { title: 'Link the server', body: 'Tie it to your Vellum account. Your team joins it with seats of their own.' },
  { title: 'Open the Studio', body: 'Pick the server and build. Saving writes to the server.' },
]

type Plan = { id: string; name: string; blurb: string; seats: string; points: string[]; open: boolean }

/* Seats are the plans as they stand. Paid prices are not settled yet, so
   the paid plans say they open soon rather than show a number. */
const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    blurb: 'For you and the servers you run.',
    seats: '1 seat',
    points: ['The Studio and the plugin', 'Your own servers', 'Push packs and apply files'],
    open: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: 'For a small team.',
    seats: '3 seats included',
    points: ['Everything in Free', 'Shared projects and hosted sync', 'A role for each member', 'Extra seats when you need them'],
    open: false,
  },
  {
    id: 'studio_engineer',
    name: 'Studio Engineer',
    blurb: 'For a studio with more hands.',
    seats: '5 seats included',
    points: ['Everything in Free', 'Shared projects and hosted sync', 'A role for each member', 'Extra seats when you need them'],
    open: false,
  },
]

/** Shows its children once they first scroll into view, and leaves them there. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(() => typeof IntersectionObserver !== 'function')

  useEffect(() => {
    const el = box.current
    if (!el || shown) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        io.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return (
    <div
      ref={box}
      className={`reveal ${className}`}
      data-shown={shown || undefined}
      style={{ '--delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function Home() {
  useTitle(null)
  const reduced = useReducedMotion()
  const studio = () => navigate('/servers')
  const toSection = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="site">
      <header className="site-head">
        <a
          className="site-head__brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
          }}
        >
          <VellumMark />
          Vellum
        </a>
        <nav className="site-head__nav" aria-label="On this page">
          <button onClick={() => toSection('features')}>Features</button>
          <button onClick={() => toSection('how')}>How it works</button>
          <button onClick={() => toSection('plans')}>Plans</button>
        </nav>
        <div className="site-head__right">
          <button className="btn btn--primary btn--sm" onClick={studio}>
            Open the Studio
          </button>
        </div>
      </header>

      <main className="home">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero__aurora" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="home-hero__text">
            <p className="eyebrow">For Minecraft servers</p>
            <h1 className="home-hero__title" id="home-title">
              <Kinetic text="Build the mobs your server runs" />
            </h1>
            <p className="home-hero__sub">
              Vellum is a model studio in your browser and a plugin on your server. Shape a mob, an item or a
              block, paint it, animate it, and put it in front of your players without a restart.
            </p>
            <div className="home-hero__actions">
              <button className="btn btn--primary home-btn" onClick={studio}>
                Open the Studio <Icon name="arrowRight" size={14} />
              </button>
              <button className="btn home-btn" onClick={() => toSection('plans')}>
                Get the plugin
              </button>
            </div>
          </div>
          <Showcase linked={false} />
        </section>

        <section className="home-section" id="features" aria-labelledby="features-title">
          <Reveal>
            <p className="eyebrow">What it does</p>
            <h2 className="home-h2" id="features-title">
              From the first cube to the live server
            </h2>
          </Reveal>
          <div className="home-features">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 90}>
                <article
                  className="home-feature lit"
                  style={{ '--c': f.colour } as CSSProperties}
                  onPointerMove={trackPointer}
                >
                  <span className="home-feature__icon" aria-hidden="true">
                    <Icon name={f.icon} size={18} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="home-section" id="how" aria-labelledby="how-title">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="home-h2" id="how-title">
              Three steps to your first model in game
            </h2>
          </Reveal>
          <ol className="home-steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 110}>
                  <div className="home-step">
                    <span className="home-step__n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section" id="plans" aria-labelledby="plans-title">
          <Reveal>
            <p className="eyebrow">Plans</p>
            <h2 className="home-h2" id="plans-title">
              Start free, and bring your team when you need to
            </h2>
          </Reveal>
          <div className="home-plans">
            {plans.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <article className="home-plan" data-plan={p.id} data-featured={p.id === 'pro' || undefined}>
                  <header>
                    <h3 className="home-plan__name">{p.name}</h3>
                    <p className="home-plan__blurb">{p.blurb}</p>
                  </header>
                  <p className="home-plan__price">{p.open ? 'No card needed' : 'Price at launch'}</p>
                  <p className="home-plan__seats">
                    <Icon name="users" size={14} /> {p.seats}
                  </p>
                  <ul>
                    {p.points.map((point) => (
                      <li key={point}>
                        <Icon name="check" size={13} />
                        {point}
                      </li>
                    ))}
                  </ul>
                  {p.open ? (
                    <button className="btn btn--primary home-plan__go" onClick={studio}>
                      Start free
                    </button>
                  ) : (
                    <button className="btn home-plan__go" disabled>
                      Opens soon
                    </button>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
          <p className="home-plans__note">Paid plans open soon. Their prices will be listed here at launch.</p>
        </section>

        <Reveal className="home-cta">
          <h2 className="home-h2">Pick a server and start building</h2>
          <button className="btn btn--primary home-btn" onClick={studio}>
            Open the Studio <Icon name="arrowRight" size={14} />
          </button>
        </Reveal>
      </main>

      <footer className="site-foot">
        <span className="site-foot__brand">
          <VellumMark size={16} />
          Vellum
        </span>
        <p>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
      </footer>
    </div>
  )
}
