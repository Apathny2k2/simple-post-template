import { chromium } from 'playwright'
const [,, hash, out, w = '1440', h = '900'] = process.argv
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await page.goto('http://localhost:5173/' + hash)
await page.reload()
await page.waitForTimeout(1500)
await page.screenshot({ path: out })
console.log(JSON.stringify({ errs, cubes: await page.locator('.model-cube').count(), faces: await page.locator('.model-face').count() }))
await browser.close()
