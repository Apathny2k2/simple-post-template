import { useMemo, useState } from 'react'
import { Menu } from '../components/Menu'
import { Model3D, blockModel, lanternModel } from '../components/Model3D'
import { Icon } from '../lib/icons'
import { assetsFor, scenes } from '../lib/data'
import type { Asset, AssetKind } from '../lib/data'
import { navigate } from '../lib/router'
import './Projects.css'

const PER_PAGE = 12

const kindLabel: Record<AssetKind, string> = {
  items: 'Items',
  mobs: 'Mobs & Anim.',
}

/** The flat "2D Render" that sits in the card until you hover it. */
function FlatRender({ palette }: { palette: [string, string, string] }) {
  const [top, side, front] = palette
  return (
    <svg viewBox="0 0 120 100" width="62%" height="62%" aria-hidden="true">
      <g>
        <path d="M60 14 104 38 60 62 16 38z" fill={top} />
        <path d="M16 38 60 62v30L16 68z" fill={side} />
        <path d="M104 38 60 62v30l44-24z" fill={front} />
        <path
          d="M60 14 104 38 60 62 16 38zM16 38v30l44 24 44-24V38M60 62v30"
          fill="none"
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

function AssetCard({ asset }: { asset: Asset }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const model = asset.kind === 'mobs' ? lanternModel(asset.hue) : blockModel(asset.hue)

  return (
    <article className="asset" data-open={menuOpen || undefined}>
      <header className="asset__head">
        <Icon name={asset.kind === 'mobs' ? 'anim' : 'cube'} size={14} className="asset__badge" />
        <h3 className="asset__name" title={asset.name}>
          {asset.name}
        </h3>
        <Menu
          align="end"
          onOpenChange={setMenuOpen}
          entries={[
            { label: 'Open in Editor', icon: 'cube', onSelect: () => navigate(`/editor/${asset.id}`) },
            { label: 'Showcase', icon: 'camera' },
            { label: 'Duplicate', icon: 'copy' },
            { label: 'View texture', icon: 'image' },
            { label: 'Download', icon: 'download' },
            { kind: 'separator' },
            { label: 'Delete', icon: 'trash', danger: true },
          ]}
          trigger={({ toggle, id }) => (
            <button className="icon-btn" id={id} onClick={toggle} aria-label={`Actions for ${asset.name}`}>
              <Icon name="dots" size={15} />
            </button>
          )}
        />
      </header>

      <div className="asset__stage">
        <div className="asset__flat">
          <FlatRender palette={asset.hue} />
        </div>
        <div className="asset__live">
          <Model3D boxes={model} spin initialPitch={-22} zoom={-210} />
        </div>
        <span className="asset__renderlabel">2D render</span>
      </div>

      <div className="asset__meta">
        <span>{asset.format}</span>
        <span>{asset.texture}</span>
        <span>{asset.elements} elements</span>
        <span>{asset.updated}</span>
      </div>
    </article>
  )
}

function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  if (pages <= 1) return null
  return (
    <nav className="pager" aria-label="Library pages">
      <button className="pager__btn" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
        <Icon name="chevronLeft" size={15} />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          className="pager__btn"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      <button className="pager__btn" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
        <Icon name="chevronRight" size={15} />
      </button>
    </nav>
  )
}

/** The shared library panel - identical for Items and for Mobs & Anim. */
function Library({ sceneId, kind }: { sceneId: string; kind: AssetKind }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0]

  const rows = useMemo(() => {
    const all = assetsFor(scene.id, kind)
    const q = query.trim().toLowerCase()
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all
  }, [scene.id, kind, query])

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = Math.min(page, pages)
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const switchKind = (next: AssetKind) => {
    setPage(1)
    navigate(`/projects/${scene.id}/${next}`)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{scene.name}</div>
          {/* title follows whichever tile opened the library */}
          <h1 className="page-title">{kindLabel[kind]}</h1>
          <p className="page-sub">{scene.blurb}</p>
        </div>
      </div>

      <section className="library">
        <div className="library__bar">
          <button className="library__back" onClick={() => navigate('/projects')}>
            <Icon name="chevronLeft" size={15} /> Back
          </button>

          <div className="library__tabs" role="tablist" aria-label="Library category">
            {(['items', 'mobs'] as AssetKind[]).map((k) => (
              <button
                key={k}
                role="tab"
                className="library__tab"
                aria-selected={k === kind}
                onClick={() => switchKind(k)}
              >
                {kindLabel[k]}
              </button>
            ))}
          </div>

          <div className="library__search">
            <Icon name="search" size={14} />
            <input
              value={query}
              placeholder="Filter this shelf"
              aria-label="Filter assets"
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <span className="library__count">
            {rows.length} file{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        {slice.length ? (
          <div className="library__grid">
            {slice.map((a) => (
              <AssetCard key={a.id} asset={a} />
            ))}
          </div>
        ) : (
          <div className="library__empty">Nothing on this shelf matches &ldquo;{query}&rdquo;.</div>
        )}

        <Pager page={current} pages={pages} onPage={setPage} />
      </section>
    </main>
  )
}

/** The first scene: pick a project, then a shelf. */
function Gateway({ sceneId, onScene }: { sceneId: string; onScene: (id: string) => void }) {
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0]

  const tiles: Array<{ kind: AssetKind; icon: 'cube' | 'anim'; desc: string; count: number; palette: [string, string, string] }> = [
    {
      kind: 'items',
      icon: 'cube',
      desc: 'Hand-held and placed models. Block/item formats, static geometry.',
      count: scene.counts.items,
      palette: ['#c8a96a', '#a8854a', '#7d6234'],
    },
    {
      kind: 'mobs',
      icon: 'anim',
      desc: 'Rigged entities with their animation controllers and keyframes.',
      count: scene.counts.mobs,
      palette: ['#5c7d9c', '#43607a', '#2f455a'],
    },
  ]

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Projects</div>
          <h1 className="page-title">First scene</h1>
          <p className="page-sub">
            Choose a scene, then a shelf. Both shelves open the same shared library panel - only the
            heading changes.
          </p>
        </div>
      </div>

      <div className="scene-row">
        {scenes.map((s) => (
          <button
            key={s.id}
            className="scene-chip"
            aria-pressed={s.id === scene.id}
            onClick={() => onScene(s.id)}
          >
            <Icon name="scene" size={14} />
            {s.name}
            <span className="scene-chip__n">{s.counts.items + s.counts.mobs}</span>
          </button>
        ))}
      </div>

      <div className="gateway">
        {tiles.map((t) => (
          <button
            key={t.kind}
            className="gateway__tile"
            onClick={() => navigate(`/projects/${scene.id}/${t.kind}`)}
          >
            <div className="gateway__art">
              <Model3D
                boxes={t.kind === 'mobs' ? lanternModel(t.palette) : blockModel(t.palette)}
                spin
                initialPitch={-18}
                zoom={-260}
              />
            </div>
            <div className="gateway__top">
              <span className="gateway__icon">
                <Icon name={t.icon} size={18} />
              </span>
              <span className="scene-chip__n mono">x{t.count}</span>
            </div>
            <div className="gateway__bottom">
              <div className="gateway__name">{kindLabel[t.kind]}</div>
              <p className="gateway__desc">{t.desc}</p>
              <span className="gateway__go">
                Open library <Icon name="arrowRight" size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </main>
  )
}

export function Projects({ segments }: { segments: string[] }) {
  // #/projects | #/projects/:sceneId/:kind
  const [pickedScene, setPickedScene] = useState(scenes[0].id)
  const routeScene = segments[1]
  const routeKind = segments[2]

  if (routeScene && (routeKind === 'items' || routeKind === 'mobs')) {
    const known = scenes.some((s) => s.id === routeScene) ? routeScene : scenes[0].id
    return <Library key={`${known}-${routeKind}`} sceneId={known} kind={routeKind} />
  }

  return <Gateway sceneId={pickedScene} onScene={setPickedScene} />
}
