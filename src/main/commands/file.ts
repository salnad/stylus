import type { BrowserWindow } from 'electron'
import { COMMANDS, type CommandManagerContract } from './index'

type MaybeWindow = BrowserWindow | null | undefined

const openQuickOpenDialog = (win: MaybeWindow): void => {
  if (win?.webContents) {
    win.webContents.send('mt::execute-command-by-id', 'file.quick-open')
  }
}

export const loadFileCommands = (commandManager: CommandManagerContract): void => {
  commandManager.add(COMMANDS.FILE_QUICK_OPEN, openQuickOpenDialog as never)
}
