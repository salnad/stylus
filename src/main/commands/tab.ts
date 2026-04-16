import type { BrowserWindow } from 'electron'
import { COMMANDS } from './index'

type MaybeWindow = BrowserWindow | null | undefined

const switchToLeftTab = (win: MaybeWindow): void => {
  if (win?.webContents) {
    win.webContents.send('mt::tabs-cycle-left')
  }
}

const switchToRightTab = (win: MaybeWindow): void => {
  if (win?.webContents) {
    win.webContents.send('mt::tabs-cycle-right')
  }
}

const switchTabByIndex = (win: MaybeWindow, index: number): void => {
  if (win?.webContents) {
    win.webContents.send('mt::switch-tab-by-index', index)
  }
}

export const loadTabCommands = (commandManager: {
  add(id: string, callback: unknown): void
}): void => {
  commandManager.add(COMMANDS.TABS_CYCLE_BACKWARD, switchToLeftTab)
  commandManager.add(COMMANDS.TABS_CYCLE_FORWARD, switchToRightTab)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_LEFT, switchToLeftTab)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_RIGHT, switchToRightTab)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FIRST, (win: MaybeWindow) => switchTabByIndex(win, 0))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SECOND, (win: MaybeWindow) => switchTabByIndex(win, 1))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_THIRD, (win: MaybeWindow) => switchTabByIndex(win, 2))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FOURTH, (win: MaybeWindow) => switchTabByIndex(win, 3))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FIFTH, (win: MaybeWindow) => switchTabByIndex(win, 4))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SIXTH, (win: MaybeWindow) => switchTabByIndex(win, 5))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SEVENTH, (win: MaybeWindow) => switchTabByIndex(win, 6))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_EIGHTH, (win: MaybeWindow) => switchTabByIndex(win, 7))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_NINTH, (win: MaybeWindow) => switchTabByIndex(win, 8))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_TENTH, (win: MaybeWindow) => switchTabByIndex(win, 9))
}
