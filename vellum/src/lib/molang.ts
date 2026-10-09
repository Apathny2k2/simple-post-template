/* Molang, Bedrock's expression language, as it appears in keyframe values:
   `math.sin(q.anim_time * 360) * 10`. Enough of it to play keys back.

   Numbers, + - * /, comparisons, && || !, `?:` and `??`, brackets, and
   several statements joined by `;` with `return` and `v.name = ...`.
   `math.` has Bedrock's functions, trig in degrees as Molang has it.
   `query.` (or `q.`) reads from the context; `anim_time` and `life_time`
   are the playhead, and a few others have preview values a mob might
   have while walking. A query Vellum knows nothing of reads 0, as an
   unset one does in game. Names are not case sensitive. */

export type MolangContext = {
  /** query values, by name without the `query.` part */
  query?: Record<string, number>
  /** variables, shared by the statements of one expression */
  variable?: Record<string, number>
}

/** What a walking mob in the preview reports; anim_time and life_time come from the playhead. */
export const PREVIEW_QUERIES: Readonly<Record<string, number>> = {
  delta_time: 1 / 20,
  ground_speed: 4,
  modified_distance_moved: 0,
  modified_move_speed: 1,
  is_on_ground: 1,
  is_moving: 1,
  is_alive: 1,
  health: 20,
  max_health: 20,
  scale: 1,
}

type Node =
  | { k: 'num'; v: number }
  | { k: 'name'; path: string[] }
  | { k: 'call'; path: string[]; args: Node[] }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'if'; c: Node; a: Node; b: Node }

type Statement = { k: 'return'; e: Node } | { k: 'set'; path: string[]; e: Node } | { k: 'expr'; e: Node }

const ALIAS: Record<string, string> = { q: 'query', v: 'variable', t: 'temp', c: 'context' }

function tokenize(src: string): string[] {
  const out: string[] = []
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*)|('[^']*')|(\?\?|&&|\|\||==|!=|<=|>=|[-+*/%()<>!?:;,=]))/giy
  let m: RegExpExecArray | null
  let at = 0
  while (at < src.length) {
    re.lastIndex = at
    m = re.exec(src)
    if (!m || m.index !== at) {
      if (/^\s*$/.test(src.slice(at))) break
      throw new Error(`can't read "${src.slice(at).trim().slice(0, 12)}"`)
    }
    out.push(m[1] ?? m[2] ?? m[3] ?? m[4])
    at = re.lastIndex
  }
  return out
}

function parse(src: string): Statement[] {
  const toks = tokenize(src)
  let i = 0
  const peek = () => toks[i]
  const take = (want?: string) => {
    const t = toks[i]
    if (want !== undefined && t !== want) throw new Error(`expected "${want}"${t ? ` before "${t}"` : ' at the end'}`)
    i++
    return t
  }
  const path = (t: string) => {
    const parts = t.toLowerCase().split('.')
    parts[0] = ALIAS[parts[0]] ?? parts[0]
    return parts
  }
  const primary = (): Node => {
    const t = take()
    if (t === undefined) throw new Error('it ends too soon')
    if (t === '(') {
      const e = ternary()
      take(')')
      return e
    }
    if (t === '-' || t === '!' || t === '+') return { k: 'un', op: t, a: unary() }
    if (/^(\d|\.\d)/.test(t)) return { k: 'num', v: Number(t) }
    // a string has no number value; it compares as 0
    if (t.startsWith("'")) return { k: 'num', v: 0 }
    if (/^[a-z_]/i.test(t)) {
      const p = path(t)
      if (peek() === '(') {
        take('(')
        const args: Node[] = []
        if (peek() !== ')') {
          args.push(ternary())
          while (peek() === ',') {
            take(',')
            args.push(ternary())
          }
        }
        take(')')
        return { k: 'call', path: p, args }
      }
      return { k: 'name', path: p }
    }
    throw new Error(`unexpected "${t}"`)
  }
  const unary = (): Node => primary()
  const level = (ops: string[], next: () => Node) => (): Node => {
    let a = next()
    while (ops.includes(peek())) {
      const op = take()
      a = { k: 'bin', op, a, b: next() }
    }
    return a
  }
  const mul = level(['*', '/', '%'], unary)
  const add = level(['+', '-'], mul)
  const cmp = level(['<', '<=', '>', '>='], add)
  const eq = level(['==', '!='], cmp)
  const and = level(['&&'], eq)
  const or = level(['||'], and)
  const coalesce = level(['??'], or)
  const ternary = (): Node => {
    const c = coalesce()
    if (peek() !== '?') return c
    take('?')
    const a = ternary()
    // `c ? a` with no `:` gives 0 when c is false, as Molang does
    if (peek() !== ':') return { k: 'if', c, a, b: { k: 'num', v: 0 } }
    take(':')
    return { k: 'if', c, a, b: ternary() }
  }
  const statements: Statement[] = []
  while (i < toks.length) {
    if (peek() === ';') {
      take()
      continue
    }
    if (peek()?.toLowerCase() === 'return') {
      take()
      statements.push({ k: 'return', e: ternary() })
    } else if (/^[a-z_]/i.test(peek() ?? '') && toks[i + 1] === '=') {
      const p = path(take())
      take('=')
      statements.push({ k: 'set', path: p, e: ternary() })
    } else statements.push({ k: 'expr', e: ternary() })
    if (i < toks.length) take(';')
  }
  if (!statements.length) throw new Error('it is empty')
  return statements
}

/* a fixed seed, so math.random gives the same frames every time the clip plays */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const RAD = Math.PI / 180
const MATH: Record<string, (args: number[], rand: () => number) => number> = {
  abs: ([a]) => Math.abs(a),
  acos: ([a]) => Math.acos(a) / RAD,
  asin: ([a]) => Math.asin(a) / RAD,
  atan: ([a]) => Math.atan(a) / RAD,
  atan2: ([y, x]) => Math.atan2(y, x) / RAD,
  ceil: ([a]) => Math.ceil(a),
  clamp: ([v, lo, hi]) => Math.min(Math.max(v, lo), hi),
  cos: ([a]) => Math.cos(a * RAD),
  die_roll: ([n, lo, hi], r) => Array.from({ length: Math.max(0, Math.floor(n)) }, () => lo + r() * (hi - lo)).reduce((x, y) => x + y, 0),
  die_roll_integer: ([n, lo, hi], r) => Array.from({ length: Math.max(0, Math.floor(n)) }, () => Math.floor(lo + r() * (hi - lo + 1))).reduce((x, y) => x + y, 0),
  exp: ([a]) => Math.exp(a),
  floor: ([a]) => Math.floor(a),
  hermite_blend: ([t]) => 3 * t * t - 2 * t * t * t,
  lerp: ([a, b, t]) => a + (b - a) * t,
  lerprotate: ([a, b, t]) => {
    const d = ((((b - a) % 360) + 540) % 360) - 180
    return a + d * t
  },
  ln: ([a]) => Math.log(a),
  max: ([a, b]) => Math.max(a, b),
  min: ([a, b]) => Math.min(a, b),
  min_angle: ([a]) => ((((a + 180) % 360) + 360) % 360) - 180,
  mod: ([a, b]) => a % b,
  pow: ([a, b]) => Math.pow(a, b),
  random: ([lo, hi], r) => lo + r() * (hi - lo),
  random_integer: ([lo, hi], r) => Math.floor(lo + r() * (hi - lo + 1)),
  round: ([a]) => Math.round(a),
  sin: ([a]) => Math.sin(a * RAD),
  sqrt: ([a]) => Math.sqrt(a),
  trunc: ([a]) => Math.trunc(a),
}

function run(statements: Statement[], ctx: MolangContext): number {
  const query = ctx.query ?? {}
  // variables live on the context when it has some, so scripts that set them are seen by later ones
  const vars: Record<string, number> = ctx.variable ?? {}
  const temp: Record<string, number> = {}
  const rand = seeded(Math.round((query.anim_time ?? 0) * 1000) + 1)
  const read = (p: string[]): number => {
    const [scope, name = ''] = p
    if (scope === 'math' && name === 'pi') return Math.PI
    if (scope === 'query') return query[name] ?? PREVIEW_QUERIES[name] ?? 0
    if (scope === 'variable') return vars[name] ?? 0
    if (scope === 'temp') return temp[name] ?? 0
    return 0
  }
  const ev = (n: Node): number => {
    switch (n.k) {
      case 'num':
        return n.v
      case 'name':
        return read(n.path)
      case 'call': {
        const [scope, name = ''] = n.path
        const args = n.args.map(ev)
        if (scope === 'math') {
          const f = MATH[name]
          if (!f) throw new Error(`math.${name} isn't a Molang function`)
          return f(args, rand)
        }
        // a query with arguments, such as q.position(1), reads as the query
        return read(n.path)
      }
      case 'un':
        return n.op === '-' ? -ev(n.a) : n.op === '!' ? (ev(n.a) ? 0 : 1) : ev(n.a)
      case 'if':
        return ev(n.c) ? ev(n.a) : ev(n.b)
      case 'bin': {
        if (n.op === '&&') return ev(n.a) && ev(n.b) ? 1 : 0
        if (n.op === '||') return ev(n.a) || ev(n.b) ? 1 : 0
        if (n.op === '??') {
          const a = ev(n.a)
          return Number.isFinite(a) ? a : ev(n.b)
        }
        const a = ev(n.a)
        const b = ev(n.b)
        switch (n.op) {
          case '+':
            return a + b
          case '-':
            return a - b
          case '*':
            return a * b
          case '/':
            return b === 0 ? 0 : a / b
          case '%':
            return b === 0 ? 0 : a % b
          case '<':
            return a < b ? 1 : 0
          case '<=':
            return a <= b ? 1 : 0
          case '>':
            return a > b ? 1 : 0
          case '>=':
            return a >= b ? 1 : 0
          case '==':
            return a === b ? 1 : 0
          default:
            return a !== b ? 1 : 0
        }
      }
    }
  }
  let last = 0
  for (const s of statements) {
    if (s.k === 'return') return ev(s.e)
    if (s.k === 'set') {
      const v = ev(s.e)
      if (s.path[0] === 'variable') vars[s.path[1] ?? ''] = v
      else if (s.path[0] === 'temp') temp[s.path[1] ?? ''] = v
      last = v
    } else last = ev(s.e)
  }
  // a single expression is its own value; statements without a return give 0, as in game
  return statements.length === 1 && statements[0].k === 'expr' ? last : 0
}

const cache = new Map<string, Statement[] | Error>()

function compiled(src: string): Statement[] | Error {
  let c = cache.get(src)
  if (!c) {
    try {
      c = parse(src)
    } catch (e) {
      c = e instanceof Error ? e : new Error(String(e))
    }
    cache.set(src, c)
  }
  return c
}

/** Why a Molang expression can't be read, or null when it can. */
export function molangError(src: string): string | null {
  const c = compiled(src)
  if (c instanceof Error) return c.message
  try {
    run(c, {})
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** The expression's value, or `fallback` when it can't be read or comes out as no number. */
export function evalMolang(src: string, ctx: MolangContext, fallback = 0): number {
  const c = compiled(src)
  if (c instanceof Error) return fallback
  try {
    const v = run(c, ctx)
    return Number.isFinite(v) ? v : fallback
  } catch {
    return fallback
  }
}

/** True when text is a plain number, so it needs no Molang. */
export const isPlainNumber = (text: string) => /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i.test(text)

/** An expression with its sign turned, without stacking brackets on a round trip. */
export function negated(src: string): string {
  const m = /^-\((.*)\)$/s.exec(src.trim())
  if (m) {
    // only when those brackets close each other
    let depth = 0
    let whole = true
    for (const ch of m[1]) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (depth < 0) whole = false
    }
    if (whole && depth === 0) return m[1]
  }
  return `-(${src.trim()})`
}
