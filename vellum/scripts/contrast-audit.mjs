import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const screens = [
  ['dash',     '#/'],
  ['projects', '#/projects'],
  ['settings', '#/settings/appearance'],
  ['support',  '#/settings/support'],
  ['editor',   '#/editor/voidling'],
]
const lowContrast = []
for (const [name, hash] of screens) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto('http://localhost:5199/' + hash, { waitUntil: 'networkidle' })
  await p.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.setAttribute('data-stage', 'light')
  })
  await p.waitForTimeout(1100)
  await p.screenshot({ path: `L-${name}.png`, fullPage: false })

  // audit: any visible text whose colour is close to its background
  const bad = await p.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/[\d.]+/g); if (!m) return null
      const [r, g, bl] = m.slice(0, 3).map(Number)
      const a = m[3] === undefined ? 1 : Number(m[3])
      if (a < 0.3) return null
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
    }
    // Returns null when the backdrop cannot be judged from computed
    // style alone - a gradient or an image has no backgroundColor, and
    // walking past it to a distant ancestor invents a contrast figure.
    // Without this the X/Y/Z chips (white on a solid colour gradient,
    // plainly legible) were reported as 1.09:1 failures in light and
    // as passes in dark, purely because the fallback ancestor differed.
    const bgOf = (el) => {
      let n = el
      while (n && n !== document.documentElement) {
        const st = getComputedStyle(n)
        if (st.backgroundImage && st.backgroundImage !== 'none') return null
        const l = lum(st.backgroundColor); if (l !== null) return l
        n = n.parentElement
      }
      return lum(getComputedStyle(document.body).backgroundColor) ?? 1
    }
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length) continue
      const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('')
      if (!txt) continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      const st = getComputedStyle(el)
      if (st.visibility === 'hidden' || st.opacity === '0') continue
      const fg = lum(st.color); if (fg === null) continue
      const bg = bgOf(el); if (bg === null) continue
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
      if (ratio < 4.5) out.push({ txt: txt.slice(0, 32), ratio: +ratio.toFixed(2), color: st.color, cls: el.className?.toString?.().slice(0, 34) })
    }
    return out
  })
  const seen = new Set()
  const uniq = bad.filter(x => { const k = x.cls + x.txt; if (seen.has(k)) return false; seen.add(k); return true })
  console.log(`${name.padEnd(9)} shot ok · pageerrors=${errs.length} · under-4.5:1 text runs=${uniq.length}`)
  uniq.slice(0, 6).forEach(x => console.log(`    ${String(x.ratio).padStart(5)}:1  "${x.txt}"  ${x.cls}`))
  lowContrast.push([name, uniq.length])
  await ctx.close()
}
await b.close()
console.log('\ntotals:', lowContrast.map(([n, c]) => `${n}=${c}`).join('  '))
