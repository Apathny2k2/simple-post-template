#!/usr/bin/env node
// Checks that files changed only in their comments: every token of code,
// string and JSX text must match the version at a git revision.
//
//   node scripts/same-code.mjs [revision]      default HEAD

import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(app, '..')
const rev = process.argv[2] ?? 'HEAD'
const git = (cmd) => execSync(`git ${cmd}`, { cwd: repo, maxBuffer: 64 * 1024 * 1024 }).toString()

function tokens(file, text) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const out = []
  const walk = (node) => {
    // `{/* a comment */}` in JSX is a comment, so it may come and go
    if (ts.isJsxExpression(node) && !node.expression) return
    const children = node.getChildren(sf)
    if (!children.length) {
      if (node.kind === ts.SyntaxKind.EndOfFileToken) return
      let t = node.getText(sf)
      if (node.kind === ts.SyntaxKind.JsxText) {
        t = t.replace(/\s+/g, ' ').trim()
        if (!t) return
      }
      out.push(t)
      return
    }
    for (const c of children) walk(c)
  }
  walk(sf)
  return out
}

const cssCode = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()

const changed = git(`diff --name-only ${rev} -- vellum/src`).split('\n').filter((f) => /\.(tsx?|css)$/.test(f))
let bad = 0
for (const rel of changed) {
  let before = ''
  try {
    before = git(`show ${rev}:${rel}`)
  } catch {
    console.log(`new file, skipped: ${rel}`)
    continue
  }
  const after = (await import('node:fs')).readFileSync(path.join(repo, rel), 'utf8')
  if (rel.endsWith('.css')) {
    if (cssCode(before) !== cssCode(after)) {
      bad++
      console.log(`CODE CHANGED: ${rel}`)
    }
    continue
  }
  const a = tokens(rel, before)
  const b = tokens(rel, after)
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      bad++
      console.log(`CODE CHANGED: ${rel} at token ${i}: ${JSON.stringify(a[i])} -> ${JSON.stringify(b[i])}`)
      break
    }
  }
}
console.log(`${changed.length} files checked, ${bad} with code changes`)
process.exit(bad ? 1 : 0)
