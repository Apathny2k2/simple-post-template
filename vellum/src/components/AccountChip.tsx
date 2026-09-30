import { Menu } from './Menu'
import type { TriggerProps } from './Menu'
import { Icon } from '../lib/icons'
import { navigate } from '../lib/router'
import { signOut, useSession } from '../lib/session'

/** Who is signed in, with a menu to switch server or sign out. Signed out, it's a Sign in button. */
export function AccountChip({ servers = true }: { servers?: boolean }) {
  const session = useSession()
  if (!session) {
    return (
      <button className="btn btn--primary btn--sm" onClick={() => navigate('/login')}>
        Sign in
      </button>
    )
  }
  return (
    <Menu
      align="end"
      entries={[
        { kind: 'label', label: `Signed in as ${session.email}` },
        ...(servers ? [{ label: 'Choose a server', icon: 'server' as const, onSelect: () => navigate('/servers') }] : []),
        { kind: 'separator' },
        {
          label: 'Sign out',
          icon: 'power',
          onSelect: () => {
            signOut()
            navigate('/')
          },
        },
      ]}
      trigger={({ props }: { props: TriggerProps }) => (
        <button className="topbar__who glass account-chip" {...props} aria-label={`${session.name}, account menu`}>
          <span className="topbar__dot" />
          {session.name}
          <Icon name="chevronDown" size={11} />
        </button>
      )}
    />
  )
}
