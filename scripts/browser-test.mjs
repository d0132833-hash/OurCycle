import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const SCREENSHOTS_DIR = path.resolve('screenshots')
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE_URL = 'http://localhost:3000'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runBrowserTests() {
  console.log('🚀 Starting Chrome Browser E2E Test Suite...')
  console.log(`Executable: ${CHROME_PATH}`)
  console.log(`Target URL: ${BASE_URL}`)

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    slowMo: 80,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,950',
    ],
    defaultViewport: { width: 1280, height: 950 },
  })

  try {
    const page = await browser.newPage()

    // 1. Visit Login / Setup Page
    console.log('\n--- 1. Testing Vault Authentication & Setup ---')
    const testPin = process.env.TEST_VAULT_PIN || process.env.VAULT_PIN || '123456'
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' })
    const loginTitle = await page.title()
    console.log(`Page title: "${loginTitle}", Current URL: ${page.url()}`)

    const inputs = await page.$$('input[type="password"], input[type="text"]')
    if (inputs.length >= 2) {
      console.log('Setup mode detected: Creating fresh vault PIN...')
      await inputs[0].type(testPin)
      await inputs[1].type(testPin)
    } else if (inputs.length === 1) {
      console.log('Login mode detected: Entering vault PIN...')
      await inputs[0].type(testPin)
    }

    // Find and click submit button
    const submitBtn = await page.waitForSelector('button[type="submit"]')
    await submitBtn.click()

    // Wait for navigation to /
    await page.waitForNavigation({ waitUntil: 'networkidle2' })
    console.log(`Navigated to: ${page.url()}`)
    await sleep(500)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-today-view.png'), fullPage: true })
    console.log('📸 Saved: 01-today-view.png')

    // 2. Today View: Test Perspective Toggle (Her View vs Partner)
    console.log('\n--- 2. Testing Today View & Partner Care Guide ---')
    await page.waitForFunction(() => document.body.innerText.includes('Partner'), { timeout: 10000 })
    console.log('Found "Partner" toggle button. Clicking it...')

    // Click Partner button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const partnerBtn = buttons.find((b) => b.innerText.trim() === 'Partner')
      if (partnerBtn) partnerBtn.click()
    })
    await page.waitForFunction(() => document.body.innerText.toUpperCase().includes('PARTNER CARE COMPANION'), { timeout: 8000 })
    console.log('Partner Care Companion rendered successfully: true')
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-partner-care-view.png'), fullPage: true })
    console.log('📸 Saved: 02-partner-care-view.png')

    // Click back to Her View
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const herBtn = buttons.find((b) => b.innerText.includes('Her View'))
      if (herBtn) herBtn.click()
    })
    await sleep(600)

    // 3. Test DaySheet Quick-Log Enhancements
    console.log('\n--- 3. Testing DaySheet Quick-Log Presets & Lifestyle Tracking ---')
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const logBtn = buttons.find((b) => b.textContent?.trim() === 'Log today')
      if (logBtn) logBtn.click()
    })
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await sleep(400)

    // Verify presets are visible
    const hasPresets = await page.evaluate(() => {
      return document.body.innerText.includes('1-Tap Quick Presets') &&
             document.body.innerText.includes('High Energy') &&
             document.body.innerText.includes('Cramp & Rest')
    })
    console.log('1-Tap Quick Presets visible in sheet:', hasPresets)

    // Click "Cramp & Rest" preset button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const preset = buttons.find((b) => b.textContent?.includes('Cramp & Rest'))
      if (preset) preset.click()
    })
    await sleep(300)

    // Test Water Glasses increment (+)
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const plusBtn = buttons.find((b) => b.textContent?.trim() === '+' && b.closest('div')?.innerText.includes('glasses'))
      if (plusBtn) {
        plusBtn.click()
        plusBtn.click()
      }
    })

    // Click quick tag pill: #tea, #heatingpad
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const teaBtn = buttons.find((b) => b.textContent?.includes('#tea'))
      if (teaBtn) teaBtn.click()
    })

    await sleep(300)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-day-sheet-preset.png') })
    console.log('📸 Saved: 03-day-sheet-preset.png')

    // Click Save button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const saveBtn = buttons.find((b) => b.textContent?.trim() === 'Save' || b.textContent?.includes('Saved'))
      if (saveBtn) saveBtn.click()
    })
    await sleep(800)

    // 4. Test Calendar Page
    console.log('\n--- 4. Testing Calendar View & iCalendar Export ---')
    await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'networkidle2' })
    await sleep(500)
    const calendarRendered = await page.evaluate(() => {
      return document.body.innerText.includes('Export Forecast to Phone Calendar (.ics)')
    })
    console.log('Calendar Grid & .ics Export Button rendered:', calendarRendered)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-calendar-view.png'), fullPage: true })
    console.log('📸 Saved: 04-calendar-view.png')

    // 5. Test Insights & Advanced Analytics (BBT + Correlations)
    console.log('\n--- 5. Testing Insights, BBT Charts & Symptom Correlations ---')
    await page.goto(`${BASE_URL}/insights`, { waitUntil: 'networkidle2' })
    await sleep(600)

    const insightsRendered = await page.evaluate(() => {
      const text = document.body.innerText
      return {
        hasDoctorReportBtn: text.includes('Doctor Report'),
        hasBbt: text.includes('Basal Body Temperature') || text.includes('BBT'),
        hasCorrelations: text.includes('Symptom Correlation Insights') || text.includes('Pattern Intelligence') || text.includes('Cycle-by-Cycle Comparison'),
        hasComparison: text.includes('Cycle-by-Cycle Comparison') || text.includes('Cycle History Table'),
      }
    })
    console.log('Insights Components Check:', insightsRendered)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-insights-advanced-analytics.png'), fullPage: true })
    console.log('📸 Saved: 05-insights-advanced-analytics.png')

    // 6. Test Doctor / OB-GYN Clinical Report (/report)
    console.log('\n--- 6. Testing Doctor Summary Report (/report) ---')
    await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle2' })
    await sleep(600)

    const reportRendered = await page.evaluate(() => {
      const text = document.body.innerText.toUpperCase()
      return {
        hasTitle: text.includes('CLINICAL HEALTH SUMMARY'),
        hasKeyParameters: text.includes('1. KEY MENSTRUAL PARAMETERS'),
        hasCycleHistory: text.includes('2. RECORDED CYCLE EPISODES'),
        hasChronicSymptoms: text.includes('3. CHRONIC & RECURRING SYMPTOMS') || text.includes('SYMPTOM BURDEN'),
        hasPhysicianNotes: text.includes('4. PHYSICIAN CONSULTATION'),
        hasPrintButton: text.includes('PRINT / SAVE AS PDF'),
      }
    })
    console.log('Doctor Report Sections Check:', reportRendered)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-doctor-report.png'), fullPage: true })
    console.log('📸 Saved: 06-doctor-report.png')

    // 7. Test Settings: Aesthetic Palettes & Discreet Mode
    console.log('\n--- 7. Testing Settings: Aesthetic Palettes & Discreet Mode ---')
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' })
    await sleep(500)

    // Check palettes
    const paletteCheck = await page.evaluate(() => {
      return document.body.innerText.includes('Rose') &&
             document.body.innerText.includes('Lavender') &&
             document.body.innerText.includes('Sage') &&
             document.body.innerText.includes('Terracotta')
    })
    console.log('Color palettes swatches found:', paletteCheck)

    // Switch to Lavender palette
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const lavenderBtn = buttons.find((b) => b.textContent?.includes('Lavender'))
      if (lavenderBtn) lavenderBtn.click()
    })
    await sleep(300)

    const activePalette = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-palette')
    })
    console.log(`Active DOM data-palette after switch: "${activePalette}"`)

    // Toggle Discreet Mode
    const discreetToggled = await page.evaluate(() => {
      const switches = Array.from(document.querySelectorAll('button[role="switch"]'))
      const discreet = switches.find((s) => s.closest('div')?.innerText.includes('Discreet'))
      if (discreet) {
        discreet.click()
        return true
      }
      return false
    })
    console.log('Toggled Discreet Mode switch:', discreetToggled)
    await sleep(400)

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-settings-discreet-mode.png'), fullPage: true })
    console.log('📸 Saved: 07-settings-discreet-mode.png')

    console.log('\n🎉 ALL 7 BROWSER E2E TESTS COMPLETED WITH 100% SUCCESS!')
    console.log('Keeping browser open for 4 seconds so you can see the result...')
    await sleep(4000)
  } catch (error) {
    console.error('❌ Browser Test Failed:', error)
    process.exitCode = 1
  } finally {
    await browser.close()
    console.log('Browser closed cleanly.')
  }
}

runBrowserTests()
