import type { BrowserWindow } from 'electron'

export const showAboutDialog = (win?: BrowserWindow | null): void => {
  if (win?.webContents) {
    win.webContents.send('mt::about-dialog')
  }
}

export const showTweetDialog = (win: BrowserWindow | null | undefined, type: string): void => {
  if (win?.webContents) {
    win.webContents.send('mt::tweet', type)
  }
}
