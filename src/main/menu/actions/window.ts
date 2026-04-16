import { ipcMain, Menu, type BrowserWindow } from 'electron'
import { isOsx } from '../../config'
import { COMMANDS } from '../../commands'
import { zoomIn, zoomOut } from '../../windows/utils'

type MaybeWindow = BrowserWindow | null | undefined

export const minimizeWindow = (win: MaybeWindow): void => {
  if (!win) {
    return
  }

  if (isOsx) {
    Menu.sendActionToFirstResponder('performMiniaturize:')
  } else {
    win.minimize()
  }
}

export const toggleAlwaysOnTop = (win: MaybeWindow): void => {
  if (win) {
    ipcMain.emit('window-toggle-always-on-top', win)
  }
}

export const toggleFullScreen = (win: MaybeWindow): void => {
  if (win) {
    win.setFullScreen(!win.isFullScreen())
  }
}

export const loadWindowCommands = (commandManager: {
  add(id: string, callback: (win: MaybeWindow) => void): void
}): void => {
  commandManager.add(COMMANDS.WINDOW_MINIMIZE, minimizeWindow)
  commandManager.add(COMMANDS.WINDOW_TOGGLE_ALWAYS_ON_TOP, toggleAlwaysOnTop)
  commandManager.add(COMMANDS.WINDOW_TOGGLE_FULL_SCREEN, toggleFullScreen)
  commandManager.add(COMMANDS.WINDOW_ZOOM_IN, win => {
    if (win) {
      zoomIn(win)
    }
  })
  commandManager.add(COMMANDS.WINDOW_ZOOM_OUT, win => {
    if (win) {
      zoomOut(win)
    }
  })
}
