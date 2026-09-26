#!/usr/bin/env node
/**
 * Fold a Vite build into one self-contained HTML file.
 *
 *   node scripts/bundle-single-file.mjs [--out <path>] [--fragment]
 *
 * Every stylesheet and module chunk is inlined, `public/fonts/*.woff2` are
 * embedded as data URIs, and the favicon rides along, so the result loads
 * with no network at all - double-click it, mail it, drop it on any host.
 *
 *   --fragment  emit page content only (no doctype/html/head/body) for hosts
 *               that supply their own document skeleton, such as Claude
 *               Artifacts. Implies no <meta charset>, which is why non-ASCII
 *               is escaped either way.
 *
 * Run `tsc -b && vite build` first, or just use `pnpm build:single`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const argv = process.argv.slice(2)
const fragment = argv.includes('--fragment')
const outFlag = argv.indexOf('--out')
const out = outFlag === -1 ? join(dist, 'vellum.html') : resolve(argv[outFlag + 1])

const entry = join(dist, 'index.html')
if (!existsSync(entry)) {
  console.error(`No build found at ${entry}\nRun the build first: pnpm build`)
  process.exit(1)
}

const html = readFileSync(entry, 'utf8')
const asset = (href) => join(dist, href.replace(/^\.?\//, ''))

/** `url(/fonts/x.woff2)` points at public/, which Vite copies verbatim. */
function embedFonts(css) {
  return css.replace(/url\(\/?((?:[\w./-]*\/)?fonts\/[\w.-]+\.woff2)\)/g, (whole, rel) => {
    const file = join(dist, rel)
    if (!existsSync(file)) {
      console.warn(`  ! font not found, left as-is: ${rel}`)
      return whole
    }
    return `url(data:font/woff2;base64,${readFileSync(file).toString('base64')})`
  })
}

/**
 * `\uXXXX` is valid in JS strings, regexes and identifiers alike, so escaping
 * every non-ASCII codepoint keeps the page correct even where the host serves
 * it without a charset declaration.
 */
const escapeNonAscii = (js) =>
  js.replace(/[^\x00-\x7F]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'App'

const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map(
  (m) => m[1],
)
const scripts = [...html.matchAll(/<script[^>]+type="module"[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g)]
  .map((m) => m[1])

if (!scripts.length) {
  console.error('No module scripts found in dist/index.html - nothing to inline.')
  process.exit(1)
}

const css = styles.map((href) => embedFonts(readFileSync(asset(href), 'utf8'))).join('\n')
const js = scripts
  .map((src) => escapeNonAscii(readFileSync(asset(src), 'utf8')))
  // the only sequence that can end script data early
  .map((s) => s.replace(/<\/script/gi, '<\\/script'))
  .join('\n;\n')

const head = []
if (!fragment) {
  head.push('<meta charset="utf-8" />')
  head.push('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />')
  for (const meta of html.matchAll(/<meta name="(description|theme-color)"[^>]*>/g)) head.push(meta[0])
  const icon = join(dist, 'favicon.svg')
  if (existsSync(icon)) {
    const b64 = readFileSync(icon).toString('base64')
    head.push(`<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${b64}" />`)
  }
}
head.push(`<title>${title}</title>`)

const inner = `<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`

const page = fragment
  ? `${head.join('\n')}\n${inner}`
  : `<!doctype html>
<html lang="en">
  <head>
${head.map((l) => `    ${l}`).join('\n')}
  </head>
  <body>
${inner}  </body>
</html>
`

// A leftover absolute reference means something did not get inlined, and the
// page would silently 404 it wherever it is served from. Fail loudly instead.
const leftovers = [
  ...page.matchAll(/(?:src|href)="\/(?!\/)[^"]*"|url\(\/(?!\/)[^)]*\)/g),
].map((m) => m[0])

if (leftovers.length) {
  console.error('Un-inlined absolute references remain:')
  for (const l of [...new Set(leftovers)].slice(0, 10)) console.error(`  ${l}`)
  process.exit(1)
}

writeFileSync(out, page)

const kb = (n) => `${(n / 1024).toFixed(0)} KB`
console.log(`${fragment ? 'fragment' : 'document'} -> ${out}`)
console.log(
  `  ${styles.length} stylesheet(s) ${kb(css.length)} · ${scripts.length} chunk(s) ${kb(js.length)} · total ${kb(Buffer.byteLength(page))}`,
)
