import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon, VellumMark } from '../lib/icons'
import { navigate, useTitle } from '../lib/router'
import { DEMO_ACCOUNT, signIn, useSession } from '../lib/session'
import './SignIn.css'

/* The sample sign-in: any email and password work, and nothing leaves the page. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SignIn() {
  useTitle('Sign in')
  const session = useSession()
  const [email, setEmail] = useState(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState(DEMO_ACCOUNT.password)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)
  const emailBox = useRef<HTMLInputElement>(null)
  const passwordBox = useRef<HTMLInputElement>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const next: typeof errors = {}
    if (!EMAIL.test(email.trim())) next.email = 'Enter an email address, like name@example.com.'
    if (!password) next.password = 'Enter a password. Any password works here.'
    setErrors(next)
    if (next.email) return emailBox.current?.focus()
    if (next.password) return passwordBox.current?.focus()
    setBusy(true)
    // a short pause, as a real sign-in has; Back from the list then skips the form
    window.setTimeout(() => {
      signIn(email)
      navigate('/servers', { replace: true })
    }, 450)
  }

  return (
    <div className="sign-in">
      <header className="server-picker-head">
        <a
          className="server-picker-head__brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <VellumMark />
          Vellum
        </a>
      </header>

      <main className="sign-in__main">
        {session ? (
          <p className="sign-in__already">
            You&rsquo;re signed in as <strong>{session.name}</strong>.{' '}
            <button className="sign-in__link" onClick={() => navigate('/servers')}>
              Go to your servers
            </button>
          </p>
        ) : null}

        <form className="sign-in__card" onSubmit={submit} noValidate aria-labelledby="sign-in-title">
          <span className="sign-in__mark" aria-hidden="true">
            <VellumMark />
          </span>
          <h1 className="sign-in__title" id="sign-in-title">
            Sign in to Vellum
          </h1>
          <p className="sign-in__sub">Use the account your servers are linked to.</p>

          <label className="field">
            <span className="field__label">Email</span>
            <input
              ref={emailBox}
              className="field__input"
              type="email"
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'sign-in-email-error' : undefined}
            />
            {errors.email ? (
              <span className="sign-in__error" id="sign-in-email-error">
                {errors.email}
              </span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              ref={passwordBox}
              className="field__input"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'sign-in-password-error' : undefined}
            />
            {errors.password ? (
              <span className="sign-in__error" id="sign-in-password-error">
                {errors.password}
              </span>
            ) : null}
          </label>

          <button className="btn btn--primary btn--block sign-in__go" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="sign-in__note">
            <Icon name="info" size={13} />
            <span>
              A sample sign-in. The demo account is filled in, any email and password work, and nothing you type
              leaves this page. Don&rsquo;t use a real password.
            </span>
          </p>
        </form>

        <p className="sign-in__alt">
          New to Vellum?{' '}
          <button className="sign-in__link" onClick={() => navigate('/')}>
            See what it does
          </button>
        </p>
      </main>
    </div>
  )
}
