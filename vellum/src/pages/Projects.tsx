import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Menu } from '../components/Menu'
import { Model3D, blockModel, lanternModel } from '../components/Model3D'
import { ModelView } from '../components/ModelView'
import { sampleById } from '../lib/samples'
import { Icon } from '../lib/icons'
import { assetsFor, groupLabel, groupOf, scenes, shelfOf } from '../lib/data'
import type { Asset, Shelf } from '../lib/data'
import { NewModelDialog } from './editor/NewModelDialog'
import { ExportPackDialog } from './editor/ExportPackDialog'
import { DEFAULT_DISPLAY } from './editor/DisplayPanel'
import type { Model, ProjectKind, Subtype } from '../lib/model'
import { navigate, useTitle } from '../lib/router'
import { trackPointer } from '../lib/motion'
import { Kinetic } from '../components/Kinetic'
import { saveDataUrl, saveFile } from '../lib/download'
import { writeVellum } from '../lib/vellum'
import './Projects.css'

/** Download and texture-export actions for the card menu. */
function useAssetActions() {
  const [note, setNote] = useState<string | null>(null)
  const say = (text: string) => {
    setNote(text)
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 5000)
  }

  const onDownload = (asset: Asset) => {
    if (!asset.sampleId) return
    const s = sampleById(asset.sampleId)
    void saveFile(s.file, writeVellum(s.model)).then(say)
  }

  const onTexture = (asset: Asset) => {
    if (!asset.sampleId) return
    const texture = sampleById(asset.sampleId).model.textures[0]
    if (!texture) {
      say('That model has no texture.')
      return
    }
    void saveDataUrl(texture.name.replace(/\.png$/i, '') + '.png', texture.source).then(say)
  }

  return { note, onDownload, onTexture }
}

const PER_PAGE = 12

const shelfLabel: Record<Shelf, string> = { items: 'Items', mobs: 'Mobs' }

/** Room a spinning model needs: the larger of its height and its horizontal diagonal. */
function extentOf(model: Model) {
  if (!model.cubes.length) return 24
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const el of model.cubes) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], el.from[i])
      hi[i] = Math.max(hi[i], el.to[i])
    }
  }
  return Math.max(hi[1] - lo[1], Math.hypot(hi[0] - lo[0], hi[2] - lo[2]), 1)
}

/** One model sized to its tile. Centred, because the floor anchor puts its base mid-tile and crops the top. */
function CardRender({ model, spin }: { model: Model; spin?: boolean }) {
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState(150)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      if (r.width > 0 && r.height > 0) setBox(Math.min(r.width, r.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = Math.max(0.8, Math.min(12, (box * 0.74) / extentOf(model)))

  return (
    <div ref={frame} style={{ position: 'absolute', inset: 0 }}>
      <ModelView
        model={model}
        scale={scale}
        grid={false}
        orbit={false}
        zoomable={false}
        spin={spin}
        initialYaw={-30}
        initialPitch={-16}
        anchorAt="centre"
      />
    </div>
  )
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

function AssetCard({
  asset,
  index,
  onDownload,
  onTexture,
}: {
  asset: Asset
  /** its place on the page, for the order the cards arrive in */
  index: number
  onDownload: (a: Asset) => void
  onTexture: (a: Asset) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const model = asset.kind === 'mobs' ? lanternModel(asset.hue) : blockModel(asset.hue)
  // cards backed by a sample file render that file
  const real = asset.sampleId ? sampleById(asset.sampleId).model : null

  return (
    <article
      className="asset lit"
      data-open={menuOpen || undefined}
      style={{ '--k': index } as CSSProperties}
      onPointerMove={trackPointer}
    >
      <header className="asset__head">
        <Icon name={asset.kind === 'mobs' ? 'anim' : 'cube'} size={14} className="asset__badge" />
        <h2 className="asset__name" title={asset.name}>
          {asset.name}
        </h2>
        <Menu
          align="end"
          onOpenChange={setMenuOpen}
          entries={
            real
              ? [
                  { label: 'Open in the editor', icon: 'cube', onSelect: () => navigate(`/editor/${asset.sampleId}`) },
                  { label: 'Download .vellum', icon: 'download', onSelect: () => onDownload(asset) },
                  { label: 'Export texture PNG', icon: 'image', onSelect: () => onTexture(asset) },
                ]
              : [{ kind: 'label', label: 'Placeholder card. Nothing to open.' }]
          }
          trigger={({ props }) => (
            <button className="icon-btn" {...props} aria-label={`Actions for ${asset.name}`}>
              <Icon name="dots" size={15} />
            </button>
          )}
        />
      </header>

      <div className="asset__stage">
        {real ? (
          <>
            <div className="asset__flat">
              <CardRender model={real} />
            </div>
            <div className="asset__live">
              <CardRender model={real} spin />
            </div>
            <span className="asset__renderlabel">.vellum</span>
          </>
        ) : (
          <>
            <div className="asset__flat">
              <FlatRender palette={asset.hue} />
            </div>
            <div className="asset__live">
              <Model3D boxes={model} spin initialPitch={-22} zoom={-210} />
            </div>
            <span className="asset__renderlabel">2D render</span>
          </>
        )}
      </div>

      <div className="asset__meta">
        <span>{asset.format}</span>
        <span>{asset.texture}</span>
        <span>{asset.cubes} cubes</span>
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

/** The library panel, the same for both shelves. */
function Library({ sceneId, shelf, openNew }: { sceneId: string; shelf: Shelf; openNew?: boolean }) {
  useTitle(shelfLabel[shelf])
  const actions = useAssetActions()
  const [page, setPage] = useState(1)
  /* `/projects/:scene/:shelf/new` opens straight into the dialog, which
     is where the editor's File > New sends you. */
  const [newOpen, setNewOpen] = useState(openNew)
  const newBtn = useRef<HTMLButtonElement>(null)
  const [packOpen, setPackOpen] = useState(false)
  const packBtn = useRef<HTMLButtonElement>(null)

  /* Going to `/new` on the same shelf does not remount, so the initial
     state above misses it. */
  useEffect(() => {
    if (openNew) setNewOpen(true)
  }, [openNew])
  const [query, setQuery] = useState('')
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0]

  const rows = useMemo(() => {
    const all = assetsFor(scene.id, shelf)
    const q = query.trim().toLowerCase()
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all
  }, [scene.id, shelf, query])

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = Math.min(page, pages)
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const switchShelf = (next: Shelf) => {
    setPage(1)
    navigate(`/projects/${scene.id}/${next}`)
  }

  // the editor builds the new model from the URL, so a reload keeps it
  const create = (kind: ProjectKind, subtype: Subtype | undefined, name: string) => {
    setNewOpen(false)
    navigate(`/editor/new/${kind}/${subtype ?? '-'}/${encodeURIComponent(name)}`)
  }

  // grouped by subtype (Weapons, Tools, ...), falling back to kind
  const groups = [...new Set(slice.map(groupOf))]

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{scene.name}</div>
          <h1 className="page-title">
            <Kinetic key={shelf} text={shelfLabel[shelf]} />
          </h1>
          <p className="page-sub">{scene.blurb}</p>
        </div>
      </div>

      <section className="library">
        <div className="library__bar">
          <button className="library__back" onClick={() => navigate('/projects')}>
            <Icon name="chevronLeft" size={15} /> Back
          </button>

          <div className="library__tabs" role="tablist" aria-label="Library category">
            {(['items', 'mobs'] as Shelf[]).map((k) => (
              <button
                key={k}
                role="tab"
                className="library__tab"
                aria-selected={k === shelf}
                onClick={() => switchShelf(k)}
              >
                {shelfLabel[k]}
              </button>
            ))}
          </div>

          {/* kept out of the tab pill so it does not read as a third shelf */}
          <button
            ref={newBtn}
            className="btn btn--sm btn--primary library__new"
            onClick={() => setNewOpen(true)}
          >
            <Icon name="plus" size={13} /> New model
          </button>

          {/* a pack is a collection, so it is exported from a shelf */}
          <button
            ref={packBtn}
            className="btn btn--sm library__pack"
            onClick={() => setPackOpen(true)}
            disabled={!rows.length}
          >
            <Icon name="download" size={13} /> Export pack
          </button>

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
            {actions.note ?? `${rows.length} file${rows.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {slice.length ? (
          groups.map((g) => (
            <section className="library__group" key={g}>
              {groups.length > 1 ? (
                <h2 className="library__groupname">
                  {groupLabel(g)}
                  <span className="library__groupn mono">
                    {slice.filter((a) => groupOf(a) === g).length}
                  </span>
                </h2>
              ) : null}
              <div className="library__grid">
                {slice
                  .filter((a) => groupOf(a) === g)
                  .map((a, i) => (
                    <AssetCard
                      key={a.id}
                      asset={a}
                      index={i}
                      onDownload={actions.onDownload}
                      onTexture={actions.onTexture}
                    />
                  ))}
              </div>
            </section>
          ))
        ) : (
          <div className="library__empty">Nothing on this shelf matches &ldquo;{query}&rdquo;.</div>
        )}

        <Pager page={current} pages={pages} onPage={setPage} />
      </section>

      {newOpen ? (
        <NewModelDialog onClose={() => setNewOpen(false)} onCreate={create} focusOnClose={newBtn} />
      ) : null}

      {packOpen ? (
        <ExportPackDialog
          /* `.vellum` has no display transforms, and a model file with no display
             block and no `parent` renders untransformed in hand and inventory.
             Minecraft's defaults fill the gap. */
          items={rows.flatMap((a) => {
            const sample = a.sampleId ? sampleById(a.sampleId) : null
            return sample
              ? [{ id: sample.id, model: sample.model, kind: sample.kind, display: DEFAULT_DISPLAY }]
              : []
          })}
          suggestedName={`${scene.id}-${shelf}`}
          onClose={() => setPackOpen(false)}
          focusOnClose={packBtn}
        />
      ) : null}
    </main>
  )
}

/** The projects landing page: pick a shelf. */
function Gateway() {
  useTitle('Projects')
  const scene = scenes[0]

  const tiles: Array<{ kind: Shelf; icon: 'cube' | 'anim'; desc: string; count: number; palette: [string, string, string] }> = [
    {
      kind: 'items',
      icon: 'cube',
      desc: 'Blocks and items. Static geometry.',
      count: assetsFor(scene.id, 'items').length,
      palette: ['#c8a96a', '#a8854a', '#7d6234'],
    },
    {
      kind: 'mobs',
      icon: 'anim',
      desc: 'Rigged entities with animations.',
      count: assetsFor(scene.id, 'mobs').length,
      palette: ['#5c7d9c', '#43607a', '#2f455a'],
    },
  ]

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Projects</div>
          <h1 className="page-title">
            <Kinetic key="first-scene" text="First scene" />
          </h1>
          <p className="page-sub">
            Choose a shelf to open.
          </p>
        </div>
      </div>

      <div className="gateway">
        {tiles.map((t) => (
          <button
            key={t.kind}
            className="gateway__tile lit"
            onPointerMove={trackPointer}
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
              <div className="gateway__name">{shelfLabel[t.kind]}</div>
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
  // #/projects | #/projects/:sceneId/:kind[/new]
  const routeScene = segments[1]
  const routeKind = segments[2]

  if (routeKind === 'items' || routeKind === 'mobs' || routeKind === 'consumables') {
    const known = scenes.some((s) => s.id === routeScene) ? routeScene : scenes[0].id
    // old links to a consumables shelf open items
    const shelf = shelfOf(routeKind === 'consumables' ? 'items' : routeKind)
    return (
      <Library
        key={`${known}-${shelf}`}
        sceneId={known}
        shelf={shelf}
        openNew={segments[3] === 'new'}
      />
    )
  }

  return <Gateway />
}
