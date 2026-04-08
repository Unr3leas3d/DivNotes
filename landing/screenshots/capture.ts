import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mockupsDir = path.join(__dirname, 'mockups')
const outputDir = path.join(__dirname, '..', 'public', 'screenshots')

export interface MockupDefinition {
  file: string
  output: string
  width: number
  height: number
}

export const mockups: MockupDefinition[] = [
  { file: 'popup-dashboard.html', output: 'popup-dashboard.png', width: 380, height: 500 },
  { file: 'side-panel.html', output: 'side-panel.png', width: 400, height: 600 },
  { file: 'folders.html', output: 'folders.png', width: 380, height: 500 },
  { file: 'tags.html', output: 'tags.png', width: 380, height: 500 },
  { file: 'cloud-sync.html', output: 'cloud-sync.png', width: 400, height: 600 },
  { file: 'element-inspector.html', output: 'element-inspector.png', width: 800, height: 500 },
  { file: 'obsidian-vault.html', output: 'obsidian-vault.png', width: 600, height: 400 },
]

export async function capture() {
  fs.mkdirSync(outputDir, { recursive: true })

  const browser = await chromium.launch()

  try {
    for (const mockup of mockups) {
      const page = await browser.newPage({
        viewport: { width: mockup.width, height: mockup.height },
        deviceScaleFactor: 2,
      })

      const filePath = path.join(mockupsDir, mockup.file)
      await page.goto(pathToFileURL(filePath).href, { waitUntil: 'load' })
      await page.waitForTimeout(100)

      await page.screenshot({
        path: path.join(outputDir, mockup.output),
        type: 'png',
        clip: { x: 0, y: 0, width: mockup.width, height: mockup.height },
      })

      console.log(`Captured: ${mockup.output}`)
      await page.close()
    }
  } finally {
    await browser.close()
  }

  console.log(`All screenshots saved to ${outputDir}`)
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  capture().catch((error) => {
    console.error('Screenshot capture failed:', error)
    process.exit(1)
  })
}
