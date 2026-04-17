import os from 'os'
import path from 'path'
import { _electron } from 'playwright'
import type { ElectronApplication, Page } from 'playwright'

const mainEntrypoint = 'dist/electron/main.js'

const getDateAsFilename = (): string => {
  const date = new Date()
  return '' + date.getFullYear() + (date.getMonth() + 1) + date.getDay()
}

const getTempPath = (): string => {
  const name = 'marktext-e2etest-' + getDateAsFilename()
  return path.join(os.tmpdir(), name)
}

export const getElectronPath = (): string => {
  const launcherName = process.platform === 'win32' ? 'electron.cmd' : 'electron'
  return path.resolve(path.join('node_modules', '.bin', launcherName))
}

export interface LaunchedElectronApp {
  app: ElectronApplication
  page: Page
}

export const launchElectron = async (userArgs: string[] = []): Promise<LaunchedElectronApp> => {
  const executablePath = getElectronPath()
  const args = [mainEntrypoint, '--user-data-dir', getTempPath(), ...userArgs]
  const app = await _electron.launch({
    executablePath,
    args,
    timeout: 30000
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await new Promise(resolve => setTimeout(resolve, 500))
  return { app, page }
}
