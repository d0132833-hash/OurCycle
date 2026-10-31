import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const SCREENSHOTS_DIR = path.resolve('screenshots/responsive')
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE_URL = 'http://localhost:3000'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: false, hasTouch: true },
  { name: 'laptop', width: 1440, height: 900, isMobile: false, hasTouch: false },
]

async function runResponsiveTests() {
  console.log('🚀 Starting Multi-Viewport Responsive Validation...')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  try {
    const page = await browser.newPage()

    // 1. Authenticate once
    console.log('1. Checking vault login/setup...')
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' })

    const inputs = await page.$$('input[type="password"], input[type="text"]')
    const testPin = process.env.TEST_VAULT_PIN || process.env.VAULT_PIN || '123456'
    if (inputs.length >= 2) {
      console.log('Setting up vault with PIN...')
      await inputs[0].type(testPin)
      await inputs[1].type(testPin)
      const btn = await page.waitForSelector('button[type="submit"]')
      await btn.click()
      await page.waitForNavigation({ waitUntil: 'networkidle2' })
    } else if (inputs.length === 1) {
      console.log('Unlocking vault with PIN...')
      await inputs[0].type(testPin)
      const btn = await page.waitForSelector('button[type="submit"]')
      await btn.click()
      await page.waitForNavigation({ waitUntil: 'networkidle2' })
    }

    console.log('Vault authenticated. Testing viewports...')

    for (const vp of VIEWPORTS) {
      console.log(`\n========================================`)
      console.log(`📱 Testing Viewport: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`)
      console.log(`========================================`)

      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
      })

      // A. Today (Her View)
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' })
      await sleep(400)

      // Ensure in Her View
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const herBtn = buttons.find((b) => b.innerText.includes('Her View'))
        if (herBtn) herBtn.click()
      })
      await sleep(300)

      // Check overflow
      const overflow = await page.evaluate(() => {
        return {
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
          hasHorizontalScroll: document.body.scrollWidth > window.innerWidth,
        }
      })
      console.log(`[${vp.name}] Horizontal overflow:`, overflow.hasHorizontalScroll ? '⚠️ YES' : '✅ NO')

      // Check navigation visibility
      const navStatus = await page.evaluate(() => {
        const bottomNav = document.querySelector('nav[aria-label="Main navigation"]')
        const desktopNav = document.querySelector('nav[aria-label="Desktop navigation"]')
        return {
          bottomNavVisible: bottomNav ? window.getComputedStyle(bottomNav).display !== 'none' : false,
          desktopNavVisible: desktopNav ? window.getComputedStyle(desktopNav).display !== 'none' : false,
        }
      })
      console.log(`[${vp.name}] Bottom nav visible:`, navStatus.bottomNavVisible)
      console.log(`[${vp.name}] Desktop nav visible:`, navStatus.desktopNavVisible)

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${vp.name}-01-today-her.png`),
        fullPage: true,
      })
      console.log(`📸 Saved: ${vp.name}-01-today-her.png`)

      // B. Today (Partner View)
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const partnerBtn = buttons.find((b) => b.innerText.trim() === 'Partner')
        if (partnerBtn) partnerBtn.click()
      })
      await sleep(400)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${vp.name}-02-today-partner.png`),
        fullPage: true,
      })
      console.log(`📸 Saved: ${vp.name}-02-today-partner.png`)

      // C. Calendar View
      await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'networkidle2' })
      await sleep(400)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${vp.name}-03-calendar.png`),
        fullPage: true,
      })
      console.log(`📸 Saved: ${vp.name}-03-calendar.png`)

      // D. Insights View
      await page.goto(`${BASE_URL}/insights`, { waitUntil: 'networkidle2' })
      await sleep(400)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${vp.name}-04-insights.png`),
        fullPage: true,
      })
      console.log(`📸 Saved: ${vp.name}-04-insights.png`)

      // E. Settings View
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' })
      await sleep(400)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${vp.name}-05-settings.png`),
        fullPage: true,
      })
      console.log(`📸 Saved: ${vp.name}-05-settings.png`)

      // F. Clinical Report View
      await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle2' })
      await sleep(400)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${vp.name}-06-report.png`),
        fullPage: true,
      })
      console.log(`📸 Saved: ${vp.name}-06-report.png`)
    }

    console.log('\n🎉 ALL VIEWPORTS VALIDATED AND SCREENSHOTS GENERATED SUCCESSFULLY!')
  } finally {
    await browser.close()
  }
}

runResponsiveTests().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})

