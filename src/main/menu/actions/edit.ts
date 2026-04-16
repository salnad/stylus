import path from 'path'
import { BrowserWindow, ipcMain, type Menu } from 'electron'
import log from 'electron-log'
import { COMMANDS } from '../../commands'
import { searchFilesAndDir } from '../../utils/imagePathAutoComplement'

type MaybeWindow = BrowserWindow | null | undefined

ipcMain.on('mt::ask-for-image-auto-path', (event, payload: { pathname: string, src: string, id: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const { pathname, src, id } = payload
  if (!src || typeof src !== 'string') {
    win.webContents.send(`mt::response-of-image-path-${id}`, [])
    return
  }

  if (src.endsWith('/') || src.endsWith('\\') || src.endsWith('.')) {
    win.webContents.send(`mt::response-of-image-path-${id}`, [])
    return
  }

  const fullPath = path.isAbsolute(src) ? src : path.join(path.dirname(pathname), src)
  const dir = path.dirname(fullPath)
  const searchKey = path.basename(fullPath)
  searchFilesAndDir(dir, searchKey)
    .then(files => {
      win.webContents.send(`mt::response-of-image-path-${id}`, files)
    })
    .catch(err => {
      log.error(err)
      win.webContents.send(`mt::response-of-image-path-${id}`, [])
    })
})

export const edit = (win: MaybeWindow, type: string): void => {
  if (win?.webContents) {
    win.webContents.send('mt::editor-edit-action', type)
  }
}

export const editorUndo = (win: MaybeWindow): void => {
  edit(win, 'undo')
}

export const editorRedo = (win: MaybeWindow): void => {
  edit(win, 'redo')
}

export const editorCopyAsMarkdown = (win: MaybeWindow): void => {
  edit(win, 'copyAsMarkdown')
}

export const editorCopyAsHtml = (win: MaybeWindow): void => {
  edit(win, 'copyAsHtml')
}

export const editorPasteAsPlainText = (win: MaybeWindow): void => {
  edit(win, 'pasteAsPlainText')
}

export const editorSelectAll = (win: MaybeWindow): void => {
  edit(win, 'selectAll')
}

export const editorDuplicate = (win: MaybeWindow): void => {
  edit(win, 'duplicate')
}

export const editorCreateParagraph = (win: MaybeWindow): void => {
  edit(win, 'createParagraph')
}

export const editorDeleteParagraph = (win: MaybeWindow): void => {
  edit(win, 'deleteParagraph')
}

export const editorFind = (win: MaybeWindow): void => {
  edit(win, 'find')
}

export const editorFindNext = (win: MaybeWindow): void => {
  edit(win, 'findNext')
}

export const editorFindPrevious = (win: MaybeWindow): void => {
  edit(win, 'findPrev')
}

export const editorReplace = (win: MaybeWindow): void => {
  edit(win, 'undo')
}

export const findInFolder = (win: MaybeWindow): void => {
  edit(win, 'findInFolder')
}

export const nativeCut = (win: MaybeWindow): void => {
  win?.webContents.cut()
}

export const nativeCopy = (win: MaybeWindow): void => {
  win?.webContents.copy()
}

export const nativePaste = (win: MaybeWindow): void => {
  win?.webContents.paste()
}

export const screenshot = (win: MaybeWindow): void => {
  if (win) {
    ipcMain.emit('screen-capture', win)
  }
}

export const lineEnding = (win: MaybeWindow, lineEndingValue: string): void => {
  if (win?.webContents) {
    win.webContents.send('mt::set-line-ending', lineEndingValue)
  }
}

export const loadEditCommands = (commandManager: { add(id: string, callback: unknown): void }): void => {
  commandManager.add(COMMANDS.EDIT_COPY, nativeCopy)
  commandManager.add(COMMANDS.EDIT_COPY_AS_HTML, editorCopyAsHtml)
  commandManager.add(COMMANDS.EDIT_COPY_AS_MARKDOWN, editorCopyAsMarkdown)
  commandManager.add(COMMANDS.EDIT_CREATE_PARAGRAPH, editorCreateParagraph)
  commandManager.add(COMMANDS.EDIT_CUT, nativeCut)
  commandManager.add(COMMANDS.EDIT_DELETE_PARAGRAPH, editorDeleteParagraph)
  commandManager.add(COMMANDS.EDIT_DUPLICATE, editorDuplicate)
  commandManager.add(COMMANDS.EDIT_FIND, editorFind)
  commandManager.add(COMMANDS.EDIT_FIND_IN_FOLDER, findInFolder)
  commandManager.add(COMMANDS.EDIT_FIND_NEXT, editorFindNext)
  commandManager.add(COMMANDS.EDIT_FIND_PREVIOUS, editorFindPrevious)
  commandManager.add(COMMANDS.EDIT_PASTE, nativePaste)
  commandManager.add(COMMANDS.EDIT_PASTE_AS_PLAINTEXT, editorPasteAsPlainText)
  commandManager.add(COMMANDS.EDIT_REDO, editorRedo)
  commandManager.add(COMMANDS.EDIT_REPLACE, editorReplace)
  commandManager.add(COMMANDS.EDIT_SCREENSHOT, screenshot)
  commandManager.add(COMMANDS.EDIT_SELECT_ALL, editorSelectAll)
  commandManager.add(COMMANDS.EDIT_UNDO, editorUndo)
}

export const updateSidebarMenu = (applicationMenu: Menu, value: boolean): void => {
  const sideBarMenuItem = applicationMenu.getMenuItemById('sideBarMenuItem')
  if (sideBarMenuItem) {
    sideBarMenuItem.checked = !!value
  }
}
