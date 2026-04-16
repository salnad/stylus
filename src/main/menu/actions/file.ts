import fs from 'fs-extra'
import path from 'path'
import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  shell,
  type IpcMainEvent
} from 'electron'
import log from 'electron-log'
import { isDirectory, isFile, exists } from 'common/filesystem'
import {
  MARKDOWN_EXTENSIONS,
  isMarkdownFile
} from 'common/filesystem/paths'
import type { MarkdownDocumentOptions } from 'common/types/documents'
import { checkUpdates, userSetting } from './marktext'
import { showTabBar } from './view'
import { COMMANDS } from '../../commands'
import { EXTENSION_HASN, PANDOC_EXTENSIONS, URL_REG } from '../../config'
import { normalizeAndResolvePath, writeFile } from '../../filesystem'
import { writeMarkdownFile } from '../../filesystem/markdown'
import { getPath, getRecommendTitleFromMarkdownString } from '../../utils'
import pandoc from '../../utils/pandoc'

type MaybeWindow = BrowserWindow | null | undefined
type ExportType = keyof typeof EXTENSION_HASN

interface ExportPageOptions {
  pageSize?: string
  pageSizeWidth?: number
  pageSizeHeight?: number
  isLandscape?: boolean
}

interface ExportRequest {
  type: ExportType
  content?: string
  pathname?: string
  title?: string
  pageOptions?: ExportPageOptions
}

interface SaveRequest {
  id: string | number
  filename: string
  markdown: string
  pathname: string
  options: MarkdownDocumentOptions
  defaultPath?: string
}

interface UnsavedFileInfo extends SaveRequest {}

interface RenameRequest {
  id: string | number
  pathname: string
  newPathname: string
}

interface MoveToRequest {
  id: string | number
  pathname: string
}

interface LinkClickData {
  href?: string
  text?: string
}

interface LinkClickPayload {
  data?: LinkClickData
  dirname?: string
}

interface CommandManagerLike {
  add(id: string, callback: unknown): void
}

const getExportExtensionFilter = (type: ExportType): Electron.FileFilter[] | undefined => {
  if (type === 'pdf') {
    return [{
      name: 'Portable Document Format',
      extensions: ['pdf']
    }]
  } else if (type === 'styledHtml') {
    return [{
      name: 'Hypertext Markup Language',
      extensions: ['html']
    }]
  }

  return undefined
}

const getPdfPageOptions = (options?: ExportPageOptions): Record<string, unknown> => {
  if (!options) {
    return {}
  }

  const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = options
  if (pageSize === 'custom' && pageSizeWidth && pageSizeHeight) {
    return {
      pageSize: { height: pageSizeHeight * 1000, width: pageSizeWidth * 1000 },
      landscape: !!isLandscape
    }
  }
  return { pageSize, landscape: !!isLandscape }
}

const removePrintServiceFromWindow = (win: MaybeWindow): void => {
  if (win) {
    win.webContents.send('mt::print-service-clearup')
  }
}

const handleResponseForExport = async (event: IpcMainEvent, request: ExportRequest): Promise<void> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const { type, content, pathname = '', title = '', pageOptions } = request
  const extension = EXTENSION_HASN[type]
  const dirname = pathname ? path.dirname(pathname) : getPath('documents')
  let nakedFilename = pathname ? path.basename(pathname, '.md') : title
  if (!nakedFilename) {
    nakedFilename = 'Untitled'
  }

  const defaultPath = path.join(dirname, `${nakedFilename}${extension}`)
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath,
    filters: getExportExtensionFilter(type)
  })

  if (!filePath || canceled) {
    if (type === 'pdf') {
      removePrintServiceFromWindow(win)
    }
    return
  }

  try {
    if (type === 'pdf') {
      const options = { printBackground: true } as Record<string, unknown>
      Object.assign(options, getPdfPageOptions(pageOptions))
      const data = await win.webContents.printToPDF(options as Electron.PrintToPDFOptions)
      removePrintServiceFromWindow(win)
      await writeFile(filePath, data, extension, 'binary')
    } else {
      if (!content) {
        throw new Error('No HTML content found.')
      }
      await writeFile(filePath, content, extension, 'utf8')
    }
    win.webContents.send('mt::export-success', { type, filePath })
  } catch (err) {
    const error = err as Error
    log.error('Error while exporting:', error)
    const ERROR_MSG = error.message || `Error happened when export ${filePath}`
    win.webContents.send('mt::show-notification', {
      title: 'Export failure',
      type: 'error',
      message: ERROR_MSG
    })
  }
}

const handleResponseForPrint = (event: IpcMainEvent): void => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }
  win.webContents.print({ printBackground: true }, () => {
    removePrintServiceFromWindow(win)
  })
}

const handleResponseForSave = async (event: IpcMainEvent, request: SaveRequest): Promise<string | number | void> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const { id, filename, markdown, pathname, options, defaultPath } = request
  let recommendFilename = getRecommendTitleFromMarkdownString(markdown)
  if (!recommendFilename) {
    recommendFilename = filename || 'Untitled'
  }

  const alreadyExistOnDisk = !!pathname
  let filePath = pathname

  if (!filePath) {
    const { filePath: dialogPath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(defaultPath || getPath('documents'), `${recommendFilename}.md`)
    })

    if (dialogPath && !canceled) {
      filePath = dialogPath
    }
  }

  if (!filePath) {
    return
  }

  filePath = path.resolve(filePath)
  const extension = path.extname(filePath) || '.md'
  filePath = !filePath.endsWith(extension) ? `${filePath}${extension}` : filePath

  return writeMarkdownFile(filePath, markdown, options)
    .then(() => {
      if (!alreadyExistOnDisk) {
        ipcMain.emit('window-add-file-path', win.id, filePath)
        ipcMain.emit('menu-add-recently-used', filePath)

        const nextFilename = path.basename(filePath)
        win.webContents.send('mt::set-pathname', { id, pathname: filePath, filename: nextFilename })
      } else {
        ipcMain.emit('window-file-saved', win.id, filePath)
        win.webContents.send('mt::tab-saved', id)
      }
      return id
    })
    .catch(err => {
      const error = err as Error
      log.error('Error while saving:', error)
      win.webContents.send('mt::tab-save-failure', id, error.message)
    })
}

const showUnsavedFilesMessage = async (win: BrowserWindow, files: UnsavedFileInfo[]): Promise<{ needSave: boolean } | null> => {
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', 'Cancel', 'Don\'t save'],
    defaultId: 0,
    message: `Do you want to save the changes you made to ${files.length} ${files.length === 1 ? 'file' : 'files'}?\n\n${files.map(f => f.filename).join('\n')}`,
    detail: 'Your changes will be lost if you don\'t save them.',
    cancelId: 1,
    noLink: true
  })

  switch (response) {
    case 2:
      return { needSave: false }
    case 0:
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ needSave: true })
        })
      })
    default:
      return null
  }
}

const noticePandocNotFound = (win: BrowserWindow): void => {
  win.webContents.send('mt::pandoc-not-exists', {
    title: 'Import Warning',
    type: 'warning',
    message: 'Install pandoc before you want to import files.',
    time: 10000
  })
}

const openPandocFile = async (windowId: number, pathname: string): Promise<void> => {
  try {
    const converter = pandoc(pathname, 'markdown')
    const data = await converter()
    ipcMain.emit('app-open-markdown-by-id', windowId, data)
  } catch (err) {
    log.error('Error while converting file:', err as Error)
  }
}

ipcMain.on('mt::save-tabs', (event, unsavedFiles: UnsavedFileInfo[]) => {
  Promise.all(unsavedFiles.map(file => handleResponseForSave(event, file))).catch(error => {
    log.error(error)
  })
})

ipcMain.on('mt::save-and-close-tabs', async (event, unsavedFiles: UnsavedFileInfo[]) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const userResult = await showUnsavedFilesMessage(win, unsavedFiles)
  if (!userResult) {
    return
  }

  const { needSave } = userResult
  if (needSave) {
    Promise.all(unsavedFiles.map(file => handleResponseForSave(event, file)))
      .then(arr => {
        const tabIds = arr.filter(id => id != null)
        win.webContents.send('mt::force-close-tabs-by-id', tabIds)
      })
      .catch(error => {
        log.error('Error while save all:', error as Error)
      })
  } else {
    const tabIds = unsavedFiles.map(file => file.id)
    win.webContents.send('mt::force-close-tabs-by-id', tabIds)
  }
})

ipcMain.on('mt::response-file-save-as', async (event, request: SaveRequest) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const { id, filename, markdown, pathname, options, defaultPath } = request
  let recommendFilename = getRecommendTitleFromMarkdownString(markdown)
  if (!recommendFilename) {
    recommendFilename = filename || 'Untitled'
  }

  const alreadyExistOnDisk = !!pathname

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: pathname || path.join(defaultPath || getPath('documents'), `${recommendFilename}.md`)
  })

  if (filePath && !canceled) {
    const resolvedFilePath = path.resolve(filePath)
    writeMarkdownFile(resolvedFilePath, markdown, options)
      .then(() => {
        if (!alreadyExistOnDisk) {
          ipcMain.emit('window-add-file-path', win.id, resolvedFilePath)
          ipcMain.emit('menu-add-recently-used', resolvedFilePath)

          const nextFilename = path.basename(resolvedFilePath)
          win.webContents.send('mt::set-pathname', { id, pathname: resolvedFilePath, filename: nextFilename })
        } else if (pathname !== resolvedFilePath) {
          ipcMain.emit('window-change-file-path', win.id, resolvedFilePath, pathname ?? '')

          const nextFilename = path.basename(resolvedFilePath)
          win.webContents.send('mt::set-pathname', { id, pathname: resolvedFilePath, filename: nextFilename })
        } else {
          ipcMain.emit('window-file-saved', win.id, resolvedFilePath)
          win.webContents.send('mt::tab-saved', id)
        }
      })
      .catch(err => {
        const error = err as Error
        log.error('Error while save as:', error)
        win.webContents.send('mt::tab-save-failure', id, error.message)
      })
  }
})

ipcMain.on('mt::close-window-confirm', async (event, unsavedFiles: UnsavedFileInfo[]) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const userResult = await showUnsavedFilesMessage(win, unsavedFiles)
  if (!userResult) {
    return
  }

  const { needSave } = userResult
  if (needSave) {
    Promise.all(unsavedFiles.map(file => handleResponseForSave(event, file)))
      .then(() => {
        ipcMain.emit('window-close-by-id', win.id)
      })
      .catch(err => {
        const error = err as Error
        log.error('Error while saving before quit:', error)

        dialog.showMessageBox(win, {
          type: 'error',
          buttons: ['Close', 'Keep It Open'],
          message: 'Failure while saving files',
          detail: error.message
        })
          .then(({ response }) => {
            if (win.id && response === 0) {
              ipcMain.emit('window-close-by-id', win.id)
            }
          })
      })
  } else {
    ipcMain.emit('window-close-by-id', win.id)
  }
})

ipcMain.on('mt::response-file-save', handleResponseForSave)
ipcMain.on('mt::response-export', handleResponseForExport)
ipcMain.on('mt::response-print', handleResponseForPrint)

ipcMain.on('mt::window::drop', async (event, fileList: string[]) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  for (const file of fileList) {
    if (isMarkdownFile(file)) {
      openFileOrFolder(win, file)
      continue
    }

    if (PANDOC_EXTENSIONS.some(ext => file.endsWith(ext))) {
      if (!pandoc.exists()) {
        noticePandocNotFound(win)
      } else {
        await openPandocFile(win.id, file)
      }
      break
    }
  }
})

ipcMain.on('mt::rename', async (event, { id, pathname, newPathname }: RenameRequest) => {
  if (pathname === newPathname) return
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const doRename = (): void => {
    fs.rename(pathname, newPathname, err => {
      if (err) {
        log.error(`mt::rename: Cannot rename "${pathname}" to "${newPathname}".\n${err.stack}`)
        return
      }

      ipcMain.emit('window-change-file-path', win.id, newPathname, pathname)
      event.sender.send('mt::set-pathname', {
        id,
        pathname: newPathname,
        filename: path.basename(newPathname)
      })
    })
  }

  if (!await exists(newPathname)) {
    doRename()
  } else {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Replace', 'Cancel'],
      defaultId: 1,
      message: `The file "${path.basename(newPathname)}" already exists. Do you want to replace it?`,
      cancelId: 1,
      noLink: true
    })

    if (response === 0) {
      doRename()
    }
  }
})

ipcMain.on('mt::response-file-move-to', async (event, { id, pathname }: MoveToRequest) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    buttonLabel: 'Move to',
    nameFieldLabel: 'Filename:',
    defaultPath: pathname
  })

  if (filePath && !canceled) {
    fs.rename(pathname, filePath, err => {
      if (err) {
        log.error(`mt::rename: Cannot rename "${pathname}" to "${filePath}".\n${err.stack}`)
        return
      }

      ipcMain.emit('window-change-file-path', win.id, filePath, pathname)
      event.sender.send('mt::set-pathname', { id, pathname: filePath, filename: path.basename(filePath) })
    })
  }
})

ipcMain.on('mt::ask-for-open-project-in-sidebar', async event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) {
    return
  }

  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })

  if (filePaths && filePaths[0]) {
    const resolvedPath = normalizeAndResolvePath(filePaths[0])
    ipcMain.emit('app-open-directory-by-id', win.id, resolvedPath, true)
  }
})

ipcMain.on('mt::format-link-click', (event, { data, dirname }: LinkClickPayload) => {
  if (!data || (!data.href && !data.text)) {
    return
  }

  const urlCandidate = data.href || data.text || ''
  if (URL_REG.test(urlCandidate)) {
    shell.openExternal(urlCandidate).catch(error => {
      log.error(error)
    })
    return
  } else if (/^[a-z0-9]+:\/\//i.test(urlCandidate)) {
    return
  }

  const { href } = data
  if (!href) {
    return
  }

  let pathname: string | null = null
  if (path.isAbsolute(href)) {
    pathname = href
  } else if (dirname && !path.isAbsolute(href)) {
    pathname = path.join(dirname, href)
  }

  if (pathname) {
    pathname = path.normalize(pathname)
    if (isMarkdownFile(pathname)) {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        openFileOrFolder(win, pathname)
      }
    } else {
      shell.openPath(pathname).catch(error => {
        log.error(error)
      })
    }
  }
})

ipcMain.on('mt::cmd-open-file', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    openFile(win)
  }
})

ipcMain.on('mt::cmd-new-editor-window', () => {
  newEditorWindow()
})

ipcMain.on('mt::cmd-open-folder', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    openFolder(win)
  }
})

ipcMain.on('mt::cmd-close-window', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.on('mt::cmd-import-file', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    importFile(win)
  }
})

export const exportFile = (win: MaybeWindow, type: ExportType): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::show-export-dialog', type)
  }
}

export const importFile = async (win: BrowserWindow): Promise<void> => {
  if (!pandoc.exists()) {
    noticePandocNotFound(win)
    return
  }

  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{
      name: 'All Files',
      extensions: Array.from(PANDOC_EXTENSIONS)
    }]
  })

  if (filePaths && filePaths[0]) {
    await openPandocFile(win.id, filePaths[0])
  }
}

export const printDocument = (win: MaybeWindow): void => {
  if (win) {
    win.webContents.send('mt::show-export-dialog', 'print')
  }
}

export const openFile = async (win: BrowserWindow): Promise<void> => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{
      name: 'Markdown document',
      extensions: Array.from(MARKDOWN_EXTENSIONS)
    }]
  })

  if (Array.isArray(filePaths) && filePaths.length > 0) {
    ipcMain.emit('app-open-files-by-id', win.id, filePaths)
  }
}

export const openFolder = async (win: BrowserWindow): Promise<void> => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })

  if (filePaths && filePaths[0]) {
    openFileOrFolder(win, filePaths[0])
  }
}

export const openFileOrFolder = (win: BrowserWindow, pathname: string): void => {
  const resolvedPath = normalizeAndResolvePath(pathname)
  if (isFile(resolvedPath)) {
    ipcMain.emit('app-open-file-by-id', win.id, resolvedPath)
  } else if (isDirectory(resolvedPath)) {
    ipcMain.emit('app-open-directory-by-id', win.id, resolvedPath)
  } else {
    console.error(`[ERROR] Cannot open unknown file: "${resolvedPath}"`)
  }
}

export const newBlankTab = (win: MaybeWindow): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::new-untitled-tab')
    showTabBar(win)
  }
}

export const newEditorWindow = (): void => {
  ipcMain.emit('app-create-editor-window')
}

export const closeTab = (win: MaybeWindow): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-close-tab')
  }
}

export const closeWindow = (win: MaybeWindow): void => {
  win?.close()
}

export const save = (win: MaybeWindow): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-ask-file-save')
  }
}

export const saveAs = (win: MaybeWindow): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-ask-file-save-as')
  }
}

export const autoSave = (menuItem: { checked: boolean }): void => {
  ipcMain.emit('set-user-preference', { autoSave: menuItem.checked })
}

export const moveTo = (win: MaybeWindow): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-move-file')
  }
}

export const rename = (win: MaybeWindow): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-rename-file')
  }
}

export const clearRecentlyUsed = (): void => {
  ipcMain.emit('menu-clear-recently-used')
}

export const loadFileCommands = (commandManager: CommandManagerLike): void => {
  commandManager.add(COMMANDS.FILE_CHECK_UPDATE, checkUpdates)
  commandManager.add(COMMANDS.FILE_CLOSE_TAB, closeTab)
  commandManager.add(COMMANDS.FILE_CLOSE_WINDOW, closeWindow)
  commandManager.add(COMMANDS.FILE_EXPORT_FILE, exportFile)
  commandManager.add(COMMANDS.FILE_IMPORT_FILE, importFile)
  commandManager.add(COMMANDS.FILE_MOVE_FILE, moveTo)
  commandManager.add(COMMANDS.FILE_NEW_FILE, newEditorWindow)
  commandManager.add(COMMANDS.FILE_NEW_TAB, newBlankTab)
  commandManager.add(COMMANDS.FILE_OPEN_FILE, openFile)
  commandManager.add(COMMANDS.FILE_OPEN_FOLDER, openFolder)
  commandManager.add(COMMANDS.FILE_PREFERENCES, userSetting)
  commandManager.add(COMMANDS.FILE_PRINT, printDocument)
  commandManager.add(COMMANDS.FILE_QUIT, app.quit)
  commandManager.add(COMMANDS.FILE_RENAME_FILE, rename)
  commandManager.add(COMMANDS.FILE_SAVE, save)
  commandManager.add(COMMANDS.FILE_SAVE_AS, saveAs)
}
