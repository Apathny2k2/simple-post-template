#!/usr/bin/env node
// Finds wording that reads as machine-written: in code comments, in text the
// user sees, and in the docs. It reports candidates. A person decides which
// ones get rewritten.
//
//   node scripts/slop-scan.mjs              totals, then every hit
//   node scripts/slop-scan.mjs --md         tables to paste into AUDIT.md
//   node scripts/slop-scan.mjs --json       everything, for other scripts
//
// Filters for the hit list: --rule=<id>  --kind=comment|copy|doc  --file=<text>

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(app, '..')
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])
// The audit's own files quote the patterns they hunt for.
const SKIP_FILES = new Set(['AUDIT-BRIEF.md', 'AUDIT.md'])

const RULES = [
  {
    id: 'antithesis',
    label: '"X, not Y" and "rather than"',
    re: [/,\s+not\s+(?!only\b|just\b|yet\b|even\b|every\b|always\b|all\b|so\b|too\b|to\b)/gi, /\bnot an? [\w-]+ but\b/gi, /\brather than\b/gi],
  },
  { id: 'the-one', label: '"the one" and "the only"', re: [/\bthe (?:one|only)\b(?!\s+(?:of|to|in|at|on)\b)/gi] },
  {
    id: 'moral',
    label: 'one-line morals ("A is a B.")',
    re: [/(?:^|[.!?:]\s+)An? [a-z-]+(?: [a-z-]+){0,6} is (?:not |never |just |only )?an? [a-z-]+(?: [a-z-]+){0,3}\./g],
  },
  {
    id: 'history',
    label: 'history ("used to", "no longer")',
    re: [/\bused to\b/gi, /\bno longer\b/gi, /\bany ?more\b/gi, /(?:^|[.!?]\s+)It was\b/g, /(?:^|[.!?]\s+)Was\b/g],
  },
  { id: 'shouting', label: 'shouting (4+ capitalised words)', re: [/\b[A-Z][A-Z'’-]+(?:\s+[A-Z][A-Z'’-]*){3,}\b/g] },
  {
    id: 'stock',
    label: 'stock phrases',
    re: [/\b(?:load-bearing|footgun|deliberately|on purpose|by design|quietly|silently|simply|honest(?:ly)?)\b/gi],
  },
  { id: 'which-is', label: '"which is why" and "which is the point"', re: [/\bwhich is (?:why|the point|what|how)\b/gi] },
  {
    id: 'numbered',
    label: 'numbered framing ("Two notes")',
    re: [
      /\b(?:two|three|four|five|six) (?:things|details|notes|rules|traps|properties|reasons|cases|kinds|ways|parts|jobs|checks|facts|points|problems|questions|lessons|pieces)\b/gi,
    ],
  },
  {
    id: 'unmeasured',
    label: 'unmeasured counts',
    re: [/~\s?\d+\s+(?:call sites|callers|places|uses|sites|files|times)\b/gi, /\babout \d+ call sites\b/gi],
  },
  { id: 'dash', label: 'dash asides', re: [/[A-Za-z0-9][,’'")]?\s(?:-|--|–|—)\s[A-Za-z]/g, /[A-Za-z]—[A-Za-z]/g] },
  {
    id: 'marketing',
    label: 'marketing words',
    re: [
      /\b(?:seamless(?:ly)?|robust(?:ly)?|leverag(?:e|es|ed|ing)|delv(?:e|es|ed|ing)|elevat(?:e|es|ed|ing)|empower(?:s|ed|ing)?|effortless(?:ly)?|crucial(?:ly)?|comprehensive(?:ly)?|streamlin(?:e|es|ed|ing)|unlock(?:s|ed|ing)?|harness(?:es|ed|ing)?)\b/gi,
    ],
  },
  { id: 'emoji', label: 'emoji', re: [/(?![©®™])\p{Extended_Pictographic}/gu] },
  { id: 'semicolon', label: 'semicolons in UI text', kinds: ['copy'], re: [/[a-z]; [a-z]/gi] },
]
const KINDS = ['comment', 'copy', 'doc']

// ---------- walking ----------

function walk(dir, keep, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, keep, out)
    else if (keep(entry.name)) out.push(full)
  }
  return out
}

const lineStarts = (text) => {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

const lineAt = (starts, pos) => {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= pos) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

// ---------- rules ----------

/** Runs every rule over one run of text. `lines` maps offsets in `text` back to file lines. */
function match(text, lines, kind, file, hits) {
  for (const rule of RULES) {
    if (rule.kinds && !rule.kinds.includes(kind)) continue
    for (const re of rule.re) {
      re.lastIndex = 0
      for (const m of text.matchAll(re)) {
        const at = m.index + (m[0].length - m[0].trimStart().length)
        let line = lines[0].line
        for (const l of lines) if (l.offset <= at) line = l.line
        const from = Math.max(0, at - 50)
        const excerpt = (from > 0 ? '…' : '') + text.slice(from, at + 70).replace(/\s+/g, ' ').trim() + (at + 70 < text.length ? '…' : '')
        hits.push({ file, line, kind, rule: rule.id, excerpt })
      }
    }
  }
}

/** Joins lines into one run so phrases that wrap still match. */
function joinLines(parts) {
  let text = ''
  const lines = []
  for (const p of parts) {
    if (text) text += ' '
    lines.push({ offset: text.length, line: p.line })
    text += p.text
  }
  return { text, lines }
}

// ---------- comments, shared by TS and CSS ----------

const stripMarkers = (line) =>
  line
    .replace(/^\s*\/\/+/, '')
    .replace(/^\s*\/\*+/, '')
    .replace(/\*+\/\s*$/, '')
    .replace(/^\s*\*(?!\/)/, '')
    .trim()

function commentStats(file, text, ranges, hits) {
  const starts = lineStarts(text)
  ranges.sort((a, b) => a.pos - b.pos)

  // a line is code when it has anything outside a comment
  const inComment = new Uint8Array(text.length)
  for (const r of ranges) inComment.fill(1, r.pos, r.end)
  const commentLines = new Set()
  const codeLines = new Set()
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue
    ;(inComment[i] ? commentLines : codeLines).add(lineAt(starts, i))
  }

  // comments on consecutive lines form one block
  const blocks = []
  for (const r of ranges) {
    const last = blocks[blocks.length - 1]
    const gap = last ? text.slice(last.end, r.pos) : null
    if (last && /^\s*$/.test(gap) && (gap.match(/\n/g) ?? []).length <= 1) {
      last.end = r.end
      last.ranges.push(r)
    } else blocks.push({ pos: r.pos, end: r.end, ranges: [r] })
  }

  let banners = 0
  let long = 0
  let longest = { lines: 0, line: 0 }
  for (const b of blocks) {
    const first = lineAt(starts, b.pos)
    const size = lineAt(starts, b.end - 1) - first + 1
    if (size > longest.lines) longest = { lines: size, line: first }
    if (size >= 8) long++
    const raw = text.slice(b.pos, b.end)
    if (/[=─━~#_-]{6,}/.test(raw.replace(/^\s*\/\*+|\*+\/\s*$/g, '')) || /^\s*\/\*{6,}/.test(raw)) banners++
    const parts = []
    for (const r of b.ranges) {
      const base = lineAt(starts, r.pos)
      text
        .slice(r.pos, r.end)
        .split('\n')
        .forEach((l, i) => {
          const t = stripMarkers(l)
          if (t) parts.push({ line: base + i, text: t })
        })
    }
    if (parts.length) {
      const run = joinLines(parts)
      match(run.text, run.lines, 'comment', file, hits)
    }
  }
  return { commentLines: commentLines.size, codeLines: codeLines.size, blocks: blocks.length, banners, long, longest }
}

// ---------- TypeScript and TSX ----------

// attributes whose values are never read as prose
const SKIP_ATTRS = new Set([
  'className', 'class', 'style', 'id', 'key', 'href', 'src', 'type', 'role', 'name', 'htmlFor', 'viewBox', 'd', 'fill',
  'stroke', 'transform', 'points', 'accept', 'autoComplete', 'inputMode', 'pattern', 'rel', 'target', 'method', 'lang',
  'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-current', 'aria-live', 'aria-haspopup', 'dir',
])
const SKIP_CALLS = new Set([
  'querySelector', 'querySelectorAll', 'getElementById', 'closest', 'matches', 'require', 'setAttribute', 'getAttribute',
  'removeAttribute', 'hasAttribute', 'add', 'remove', 'toggle', 'contains', 'getPropertyValue', 'setProperty',
  'addEventListener', 'removeEventListener', 'createElement', 'getItem', 'setItem', 'removeItem', 'matchMedia', 'animate',
])

const ENTITIES = { mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', nbsp: ' ', amp: '&', times: '×' }
const decode = (s) => s.replace(/&([a-z]+);/g, (m, name) => ENTITIES[name] ?? m)

const isProse = (s) => {
  const t = s.trim()
  if (!/^[\p{L}\d]/u.test(t)) return false
  const words = t.split(/\s+/).filter((w) => /^[("“‘'{]?\p{L}[\p{L}'’-]*[)"”’'.,;:!?…}]*$/u.test(w))
  return words.length >= 3
}

function skipContext(node) {
  for (let n = node.parent, depth = 0; n && depth < 6; n = n.parent, depth++) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isExternalModuleReference(n) || ts.isLiteralTypeNode(n)) return true
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText()
      return SKIP_ATTRS.has(name) || name.startsWith('data-')
    }
    if (ts.isPropertyAssignment(n) && n.initializer !== node && depth === 0) return true // a key, not a value
    if (ts.isPropertyAssignment(n) && ['className', 'class', 'id', 'key', 'type'].includes(n.name.getText())) return true
    if (ts.isElementAccessExpression(n) && n.argumentExpression === node) return true
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : ''
      return SKIP_CALLS.has(name) || name === 'import'
    }
    if (ts.isBlock(n) || ts.isSourceFile(n)) return false
  }
  return false
}

function scanTs(file, text, hits) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const starts = lineStarts(text)
  const comments = new Map()
  const jsxText = []
  const copy = []

  const takeCopy = (node, s) => {
    const t = s.replace(/\s+/g, ' ').trim()
    if (isProse(t)) copy.push({ line: lineAt(starts, node.getStart(sf)), text: t })
  }

  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxText.push([node.pos, node.end])
      return
    }
    for (const r of ts.getLeadingCommentRanges(text, node.pos) ?? []) comments.set(r.pos, r)
    for (const r of ts.getTrailingCommentRanges(text, node.end) ?? []) comments.set(r.pos, r)

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!skipContext(node)) takeCopy(node, node.text)
    } else if (ts.isTemplateExpression(node)) {
      if (!skipContext(node)) takeCopy(node, node.head.text + node.templateSpans.map((s) => '{…}' + s.literal.text).join(''))
    } else if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      // text and {expressions} between tags read as one sentence
      let run = ''
      let runNode = null
      const flush = () => {
        if (runNode) takeCopy(runNode, run)
        run = ''
        runNode = null
      }
      for (const child of node.children) {
        if (child.kind === ts.SyntaxKind.JsxText) {
          if (!child.text.trim()) {
            if (/\n/.test(child.text)) run += ' '
            continue
          }
          runNode ??= child
          run += decode(child.text)
        } else if (ts.isJsxExpression(child)) {
          if (!child.expression) continue
          runNode ??= child
          run += ts.isStringLiteral(child.expression) ? child.expression.text : '{…}'
        } else flush()
      }
      flush()
    }
    if (ts.isTemplateExpression(node)) return
    for (const child of node.getChildren(sf)) visit(child)
  }
  visit(sf)

  const ranges = [...comments.values()].filter((r) => !jsxText.some(([a, b]) => r.pos >= a && r.pos < b))
  const stats = commentStats(file, text, ranges, hits)
  for (const c of copy) match(c.text, [{ offset: 0, line: c.line }], 'copy', file, hits)
  return { ...stats, copyStrings: copy.length }
}

// ---------- CSS ----------

function scanCss(file, text, hits) {
  const ranges = [...text.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => ({ pos: m.index, end: m.index + m[0].length }))
  return { ...commentStats(file, text, ranges, hits), copyStrings: 0 }
}

// ---------- Markdown ----------

function scanMd(file, text, hits) {
  let fence = null
  let para = []
  let docLines = 0
  const flush = () => {
    if (para.length) {
      const run = joinLines(para)
      match(run.text, run.lines, 'doc', file, hits)
    }
    para = []
  }
  text.split('\n').forEach((raw, i) => {
    const fenceMark = raw.match(/^\s*(```+|~~~+)/)
    if (fenceMark) {
      if (!fence) {
        flush()
        fence = fenceMark[1][0]
      } else if (fenceMark[1][0] === fence) fence = null
      return
    }
    if (fence) return
    const line = raw.replace(/`[^`]*`/g, '`…`').trim()
    if (!line) return flush()
    docLines++
    para.push({ line: i + 1, text: line })
  })
  flush()
  return { docLines }
}

// ---------- run ----------

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

const sources = walk(path.join(app, 'src'), (n) => /\.(tsx?|css)$/.test(n))
// archived docs are a record of their time and are left as written
const docs = walk(repo, (n) => n.endsWith('.md') && !SKIP_FILES.has(n)).filter((f) => !f.includes(`${path.sep}archive${path.sep}`))
const hits = []
const files = []

for (const full of [...sources, ...docs].sort()) {
  const rel = path.relative(repo, full)
  const text = fs.readFileSync(full, 'utf8')
  const before = hits.length
  const stats = full.endsWith('.md') ? scanMd(rel, text, hits) : full.endsWith('.css') ? scanCss(rel, text, hits) : scanTs(rel, text, hits)
  const byRule = {}
  for (const h of hits.slice(before)) byRule[h.rule] = (byRule[h.rule] ?? 0) + 1
  files.push({ file: rel, ...stats, hits: hits.length - before, byRule })
}

const code = files.filter((f) => !f.file.endsWith('.md'))
const sum = (list, key) => list.reduce((n, f) => n + (f[key] ?? 0), 0)
const totals = {
  files: code.length,
  docs: files.length - code.length,
  commentLines: sum(code, 'commentLines'),
  codeLines: sum(code, 'codeLines'),
  banners: sum(code, 'banners'),
  longBlocks: sum(code, 'long'),
  copyStrings: sum(code, 'copyStrings'),
  hits: hits.length,
  byRule: Object.fromEntries(
    RULES.map((r) => [r.id, Object.fromEntries(KINDS.map((k) => [k, hits.filter((h) => h.rule === r.id && h.kind === k).length]))]),
  ),
}
const longest = code.reduce((a, f) => (f.longest.lines > a.lines ? { ...f.longest, file: f.file } : a), { lines: 0 })
let commit = ''
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim()
} catch {
  commit = 'unknown'
}
const NOTE = 'Every hit is a candidate. A person decides whether it gets rewritten.'

let shown = hits
const rule = option('rule')
const kind = option('kind')
const only = option('file')
if (rule) shown = shown.filter((h) => h.rule === rule)
if (kind) shown = shown.filter((h) => h.kind === kind)
if (only) shown = shown.filter((h) => h.file.includes(only))

if (flag('json')) {
  console.log(JSON.stringify({ commit, note: NOTE, totals, longest, files, hits: shown }, null, 2))
} else if (flag('md')) {
  const pad = (n) => String(n)
  const out = [`Scanner totals at \`${commit}\`. ${NOTE}`, '', '| Rule | Comments | Copy | Docs | Total |', '|---|---:|---:|---:|---:|']
  for (const r of RULES) {
    const c = totals.byRule[r.id]
    out.push(`| ${r.label} | ${c.comment} | ${c.copy} | ${c.doc} | ${c.comment + c.copy + c.doc} |`)
  }
  const all = Object.fromEntries(KINDS.map((k) => [k, hits.filter((h) => h.kind === k).length]))
  out.push(`| **All rules** | **${all.comment}** | **${all.copy}** | **${all.doc}** | **${hits.length}** |`, '')
  out.push(
    `Comment lines: ${totals.commentLines} across ${totals.files} source files, against ${totals.codeLines} code lines ` +
      `(${(totals.commentLines / totals.codeLines).toFixed(2)} per code line). Banner comments: ${totals.banners}. ` +
      `Comment blocks of 8 lines or more: ${totals.longBlocks}. Longest block: ${longest.lines} lines at \`${longest.file}:${longest.line}\`.`,
    '',
    '| File | Comment lines | Code lines | Ratio | Banners | Longest block | Hits |',
    '|---|---:|---:|---:|---:|---:|---:|',
  )
  for (const f of [...code].sort((a, b) => b.commentLines - a.commentLines).slice(0, 20)) {
    out.push(
      `| \`${f.file.replace(/^vellum\//, '')}\` | ${f.commentLines} | ${f.codeLines} | ${(f.commentLines / Math.max(1, f.codeLines)).toFixed(2)} | ${f.banners} | ${f.longest.lines} | ${pad(f.hits)} |`,
    )
  }
  console.log(out.join('\n'))
} else {
  console.log(NOTE, '\n')
  console.log(`commit ${commit}: ${totals.files} source files, ${totals.docs} docs`)
  console.log(`comment lines ${totals.commentLines}, code lines ${totals.codeLines}, banners ${totals.banners}, blocks of 8+ lines ${totals.longBlocks}`)
  console.log(`longest block ${longest.lines} lines at ${longest.file}:${longest.line}\n`)
  console.log('rule'.padEnd(14), 'comment'.padStart(8), 'copy'.padStart(6), 'doc'.padStart(6))
  for (const r of RULES) {
    const c = totals.byRule[r.id]
    console.log(r.id.padEnd(14), String(c.comment).padStart(8), String(c.copy).padStart(6), String(c.doc).padStart(6))
  }
  console.log(`\n${shown.length} hits${rule || kind || only ? ' (filtered)' : ''}\n`)
  for (const h of shown) console.log(`${h.file}:${h.line}  [${h.kind} ${h.rule}]  ${h.excerpt}`)
}
