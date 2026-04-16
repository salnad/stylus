import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Menu, ipcMain } from 'electron'
import { COMMANDS } from '../../commands'
import { isOsx } from '../../config'

let runningUpdate = false
let currentWindow: BrowserWindow | null = null

autoUpdater.autoDownload = false

autoUpdater.on('error', error => {
  if (currentWindow) {
    currentWindow.webContents.send('mt::UPDATE_ERROR', error === null ? 'Error: unknown' : (error.message || error).toString())
  }
})

autoUpdater.on('update-available', () => {
  if (currentWindow) {
    currentWindow.webContents.send('mt::UPDATE_AVAILABLE', 'Found an update, do you want download and install now?')
  }
  runningUpdate = false
})

autoUpdater.on('update-not-available', () => {
  if (currentWindow) {
    currentWindow.webContents.send('mt::UPDATE_NOT_AVAILABLE', 'Current version is up-to-date.')
  }
  runningUpdate = false
})

autoUpdater.on('update-downloaded', () => {
  if (currentWindow) {
    currentWindow.webContents.send('mt::UPDATE_DOWNLOADED', 'Update downloaded, application will be quit for update...')
  }
  setImmediate(() => autoUpdater.quitAndInstall())
})

ipcMain.on('mt::NEED_UPDATE', (_event, { needUpdate }: { needUpdate: boolean }) => {
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else {
    runningUpdate = false
  }
})

ipcMain.on('mt::check-for-update', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    checkUpdates(win)
  }
})

export const userSetting = (): void => {
  ipcMain.emit('app-create-settings-window')
}

export const checkUpdates = (browserWindow: BrowserWindow): void => {
  if (!runningUpdate) {
    runningUpdate = true
    currentWindow = browserWindow
    autoUpdater.checkForUpdates()
  }
}

export const osxHide = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hide:')
  }
}

export const osxHideAll = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hideOtherApplications:')
  }
}

export const osxShowAll = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('unhideAllApplications:')
  }
}

export const loadMarktextCommands = (commandManager: { add(id: string, callback: unknown): void }): void => {
  commandManager.add(COMMANDS.MT_HIDE, osxHide)
  commandManager.add(COMMANDS.MT_HIDE_OTHERS, osxHideAll)
}
