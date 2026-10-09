/* The inspector's part for a texture mesh: the texture it is made from and
   its scale, and a way to make it an ordinary mesh to edit its faces. */

import type { Mesh, Model, Vec3 } from '../../lib/model'

export function TextureMeshPanel({
  mesh,
  model,
  onTexture,
  onScale,
  onConvert,
}: {
  mesh: Mesh
  model: Model
  onTexture: (id: string) => void
  onScale: (scale: Vec3) => void
  onConvert: () => void
}) {
  const from = mesh.fromTexture
  if (!from) return null
  return (
    <div className="tmesh">
      <p className="editor-hint">
        A texture mesh: its faces are built from the texture&rsquo;s pixels, one deep, and follow it as you paint. Convert it to edit its faces.
      </p>
      <label className="tmesh__row">
        <span>Texture</span>
        <select className="editor-select" aria-label="Texture mesh texture" value={from.texture} onChange={(e) => onTexture(e.target.value)}>
          {model.textures.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="tmesh__row" role="group" aria-label="Texture mesh scale">
        <span>Scale</span>
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <input
            key={axis}
            type="number"
            step={0.25}
            aria-label={`Scale ${axis.toUpperCase()}`}
            className="tmesh__num"
            value={from.scale[i]}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v) || v === 0) return
              const next = [...from.scale] as Vec3
              next[i] = v
              onScale(next)
            }}
          />
        ))}
      </div>
      <button className="chip" onClick={onConvert} title="Keep the faces as they are and edit them like any mesh. It stops following the texture.">
        Convert to mesh
      </button>
    </div>
  )
}
