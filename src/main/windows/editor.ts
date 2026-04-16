import path from 'path'
import { BrowserWindow, dialog, ipcMain, type BrowserWindowConstructorOptions } from 'electron'
import { enable as remoteEnable } from '@electron/remote/main'
import log from 'electron-log'
import windowStateKeeper from 'electron-window-state'
import { isChildOfDirectory, isSamePathSync } from 'common/filesystem/paths'
import type { MarkdownDocumentRaw } from 'common/types/documents'
import BaseWindow, { WindowLifecycle, WindowType } from './base'
import { ensureWindowPosition, zoomIn, zoomOut } from './utils'
import { TITLE_BAR_HEIGHT, editorWinOptions, isLinux, isOsx, type MarkTextBrowserWindowOptions } from '../config'
import { showEditorContextMenu } from '../contextMenu/editor'
import { loadMarkdownFile } from '../filesystem/markdown'
import { switchLanguage } from '../spellchecker'

interface PendingFileToOpen {
  filePath: string
  options: Record<string, unknown>
  selected: boolean
}

interface LoadedPendingFileToOpen {
  doc: MarkdownDocumentRaw
  options: Record<string, unknown>
  selected: boolean
}

interface PendingMarkdownToOpen {
  selected: boolean
  markdown: string
}

interface PreferencesSnapshot {
  titleBarStyle?: string
  theme?: string
  sideBarVisibility?: boolean
  tabBarVisibility?: boolean
  sourceCodeModeEnabled?: boolean
  spellcheckerEnabled?: boolean
  spellcheckerLanguage?: string
  autoGuessEncoding?: boolean
  trimTrailingNewline?: number
}

interface PreferencesContract {
  getAll(): PreferencesSnapshot
  getPreferredEol(): 'lf' | 'crlf'
  getItem(key: string): unknown
}

interface MenuContract {
  addEditorMenu(win: BrowserWindow, options?: { sourceCodeModeEnabled?: boolean }): void
  updateLineEndingMenu(windowId: number, lineEnding: string): void
  addRecentlyUsedDocument(filePath: string): void
}

interface AccessorContract {
  menu: MenuContract
  env: {
    disableSpellcheck: boolean
  }
  preferences: PreferencesContract
}

class EditorWindow extends BaseWindow {
  private _directoryToOpen: string | null
  private _filesToOpen: LoadedPendingFileToOpen[]
  private _markdownToOpen: PendingMarkdownToOpen[]
  private _openedRootDirectory: string
  private _openedFiles: string[]

  constructor (accessor: AccessorContract) {
    super(accessor)
    this.type = WindowType.EDITOR
    this._directoryToOpen = null
    this._filesToOpen = []
    this._markdownToOpen = []
    this._openedRootDirectory = ''
    this._openedFiles = []
  }

  private get accessor (): AccessorContract {
    return this._accessor as AccessorContract
  }

  createWindow (
    rootDirectory: string | null = null,
    fileList: string[] = [],
    markdownList: string[] = [],
    options: BrowserWindowConstructorOptions = {}
  ): BrowserWindow {
    const { menu: appMenu, env, preferences } = this.accessor
    const addBlankTab = !rootDirectory && fileList.length === 0 && markdownList.length === 0

    const mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800
    })

    const { x, y, width, height } = ensureWindowPosition(mainWindowState)
    const winOptions: MarkTextBrowserWindowOptions = Object.assign({ x, y, width, height }, editorWinOptions, options)
    if (isLinux) {
      winOptions.icon = path.join(__static ?? '', 'logo-96px.png')
    }

    const {
      titleBarStyle,
      theme = 'light',
      sideBarVisibility,
      tabBarVisibility,
      sourceCodeModeEnabled,
      spellcheckerEnabled,
      spellcheckerLanguage
    } = preferences.getAll()

    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    winOptions.backgroundColor = this._getPreferredBackgroundColor(theme)
    if (env.disableSpellcheck && winOptions.webPreferences) {
      winOptions.webPreferences.spellcheck = false
    }

    let win: BrowserWindow | null = this.browserWindow = new BrowserWindow(winOptions)
    remoteEnable(win.webContents)
    this.id = win.id

    if (spellcheckerEnabled && !isOsx && spellcheckerLanguage) {
      try {
        switchLanguage(win, spellcheckerLanguage)
      } catch (error) {
        log.error('Unable to set spell checker language on startup:', error)
      }
    }

    appMenu.addEditorMenu(win, { sourceCodeModeEnabled })

    win.webContents.on('context-menu', (event, params) => {
      const spellcheckEnabledPref = !!preferences.getItem('spellcheckerEnabled')
      showEditorContextMenu(
        win as BrowserWindow,
        params,
        spellcheckEnabledPref
      )
    })

    win.webContents.once('did-finish-load', () => {
      this.lifecycle = WindowLifecycle.READY
      this.emit('window-ready')

      this.bringToFront()

      const lineEnding = preferences.getPreferredEol()
      if (this.id != null) {
        appMenu.updateLineEndingMenu(this.id, lineEnding)
      }

      win?.webContents.send('mt::bootstrap-editor', {
        addBlankTab,
        markdownList: this._markdownToOpen.map(item => item.markdown),
        lineEnding,
        sideBarVisibility,
        tabBarVisibility,
        sourceCodeModeEnabled
      })

      this._doOpenFilesToOpen()
      this._markdownToOpen.length = 0

      win?.webContents.on('zoom-changed', (_event, zoomDirection) => {
        if (!win) {
          return
        }
        if (zoomDirection === 'in') {
          zoomIn(win)
        } else if (zoomDirection === 'out') {
          zoomOut(win)
        }
      })
    })

    win.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
      log.error(`The window failed to load or was cancelled: ${errorCode}; ${errorDescription}`)
    })

    win.webContents.once('render-process-gone', async (_event, { reason }) => {
      if (!win || reason === 'clean-exit') {
        return
      }

      const msg = `The renderer process has crashed unexpected or is killed (${reason}).`
      log.error(msg)

      if (reason === 'abnormal-exit') {
        return
      }

      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Close', 'Reload', 'Keep It Open'],
        message: 'MarkText has crashed',
        detail: msg
      })

      if (win.id) {
        switch (response) {
          case 0:
            this.destroy()
            break
          case 1:
            this.reload()
            break
          default:
            break
        }
      }
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win?.webContents.send('mt::window-active-status', { status: true })
    })

    win.on('blur', () => {
      this.emit('window-blur')
      win?.webContents.send('mt::window-active-status', { status: false })
    })

    win.on('maximize', () => {
      win?.webContents.send('mt::window-maximize')
    })
    win.on('unmaximize', () => {
      win?.webContents.send('mt::window-unmaximize')
    })
    win.on('enter-full-screen', () => {
      win?.webContents.send('mt::window-enter-full-screen')
    })
    win.on('leave-full-screen', () => {
      win?.webContents.send('mt::window-leave-full-screen')
    })

    win.on('close', event => {
      this.emit('window-close')
      event.preventDefault()
      win?.webContents.send('mt::ask-for-close')
    })

    win.on('closed', () => {
      this.lifecycle = WindowLifecycle.QUITTED
      this.emit('window-closed')
      win = null
    })

    this.lifecycle = WindowLifecycle.LOADING
    win.loadURL(this._buildUrlString(this.id, this.accessor.env as never, preferences as never))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    mainWindowState.manage(win)
    win.webContents.setIgnoreMenuShortcuts(true)

    setTimeout(() => {
      if (rootDirectory) {
        this.openFolder(rootDirectory)
      }
      if (fileList.length) {
        this.openTabsFromPaths(fileList)
      }
      for (const markdown of markdownList) {
        this.openUntitledTab(true, markdown)
      }
    }, 0)

    return win
  }

  openTab (filePath: string, options: Record<string, unknown> = {}, selected = true): void {
    if (this.lifecycle === WindowLifecycle.QUITTED) return
    this.openTabs([{ filePath, options, selected }])
  }

  openTabsFromPaths (filePaths: string[]): void {
    if (!filePaths || filePaths.length === 0) return

    const fileList: PendingFileToOpen[] = filePaths.map(filePath => ({ filePath, options: {}, selected: false }))
    fileList[0].selected = true
    this.openTabs(fileList)
  }

  openTabs (fileList: PendingFileToOpen[]): void {
    if (this.lifecycle === WindowLifecycle.QUITTED) return

    const { browserWindow } = this
    const { preferences } = this.accessor
    const eol = preferences.getPreferredEol()
    const {
      autoGuessEncoding = true,
      trimTrailingNewline = 2
    } = preferences.getAll()

    for (const { filePath, options, selected } of fileList) {
      loadMarkdownFile(filePath, eol, autoGuessEncoding, trimTrailingNewline)
        .then(rawDocument => {
          if (this.lifecycle === WindowLifecycle.READY) {
            this._doOpenTab(rawDocument, options, selected)
          } else {
            this._filesToOpen.push({ doc: rawDocument, options, selected })
          }
        })
        .catch((err: Error) => {
          log.error(`[ERROR] Cannot open file or directory: ${err.message}\n\n${err.stack ?? ''}`)
          browserWindow?.webContents.send('mt::show-notification', {
            title: 'Cannot open tab',
            type: 'error',
            message: err.message
          })
        })
    }
  }

  openUntitledTab (selected = true, markdown = ''): void {
    if (this.lifecycle === WindowLifecycle.QUITTED) return

    if (this.lifecycle === WindowLifecycle.READY) {
      this.browserWindow?.webContents.send('mt::new-untitled-tab', selected, markdown)
    } else {
      this._markdownToOpen.push({ selected, markdown })
    }
  }

  openFolder (pathname: string): void {
    if (!pathname || this.lifecycle === WindowLifecycle.QUITTED || isSamePathSync(pathname, this._openedRootDirectory)) {
      return
    }

    if (this.lifecycle === WindowLifecycle.READY && this.browserWindow) {
      const { menu: appMenu } = this.accessor

      if (this._openedRootDirectory) {
        ipcMain.emit('watcher-unwatch-directory', this.browserWindow, this._openedRootDirectory)
      }

      appMenu.addRecentlyUsedDocument(pathname)
      this._openedRootDirectory = pathname
      ipcMain.emit('watcher-watch-directory', this.browserWindow, pathname)
      this.browserWindow.webContents.send('mt::open-directory', pathname)
    } else {
      this._directoryToOpen = pathname
    }
  }

  addToOpenedFiles (filePath: string): void {
    if (!this.browserWindow) {
      return
    }
    this._openedFiles.push(filePath)
    ipcMain.emit('watcher-watch-file', this.browserWindow, filePath)
  }

  changeOpenedFilePath (pathname: string, oldPathname: string): void {
    if (!this.browserWindow) {
      return
    }

    const index = this._openedFiles.findIndex(p => p === oldPathname)
    if (index === -1) {
      this._openedFiles.push(pathname)
    } else {
      this._openedFiles[index] = pathname
    }

    ipcMain.emit('watcher-unwatch-file', this.browserWindow, oldPathname)
    ipcMain.emit('watcher-watch-file', this.browserWindow, pathname)
  }

  removeFromOpenedFiles (pathname: string): void {
    if (!this.browserWindow) {
      return
    }

    const index = this._openedFiles.findIndex(p => p === pathname)
    if (index !== -1) {
      this._openedFiles.splice(index, 1)
    }
    ipcMain.emit('watcher-unwatch-file', this.browserWindow, pathname)
  }

  getCandidateScores (fileList: string[]): Array<{ id: number, score: number }> {
    const buf: Array<{ id: number, score: number }> = []

    for (const pathname of fileList) {
      let score = 0
      if (this._openedFiles.some(p => p === pathname)) {
        score = -1
      } else {
        if (isChildOfDirectory(this._openedRootDirectory, pathname)) {
          score += 5
        }
        for (const item of this._openedFiles) {
          if (isChildOfDirectory(path.dirname(item), pathname)) {
            score += 1
          }
        }
      }
      buf.push({ id: this.id ?? -1, score })
    }

    return buf
  }

  reload (): void {
    if (!this.browserWindow || this.id == null) {
      return
    }

    ipcMain.emit('watcher-unwatch-all-by-id', this.id)

    this._directoryToOpen = ''
    this._filesToOpen = []
    this._markdownToOpen = []
    this._openedRootDirectory = ''
    this._openedFiles = []

    this.browserWindow.webContents.once('did-finish-load', () => {
      this.lifecycle = WindowLifecycle.READY
      const { preferences } = this.accessor
      const { sideBarVisibility, tabBarVisibility, sourceCodeModeEnabled } = preferences.getAll()
      const lineEnding = preferences.getPreferredEol()
      this.browserWindow?.webContents.send('mt::bootstrap-editor', {
        addBlankTab: true,
        markdownList: [],
        lineEnding,
        sideBarVisibility,
        tabBarVisibility,
        sourceCodeModeEnabled
      })
    })

    this.lifecycle = WindowLifecycle.LOADING
    super.reload()
  }

  destroy (): void {
    super.destroy()
    this._directoryToOpen = null
    this._filesToOpen = []
    this._markdownToOpen = []
    this._openedRootDirectory = ''
    this._openedFiles = []
  }

  get openedRootDirectory (): string {
    return this._openedRootDirectory
  }

  private _doOpenTab (rawDocument: MarkdownDocumentRaw, options: Record<string, unknown>, selected: boolean): void {
    if (!this.browserWindow) {
      return
    }
    const { menu: appMenu } = this.accessor
    const { pathname } = rawDocument

    ipcMain.emit('watcher-watch-file', this.browserWindow, pathname)
    appMenu.addRecentlyUsedDocument(pathname)
    this._openedFiles.push(pathname)
    this.browserWindow.webContents.send('mt::open-new-tab', rawDocument, options, selected)
  }

  private _doOpenFilesToOpen (): void {
    if (this.lifecycle !== WindowLifecycle.READY) {
      throw new Error('Invalid state.')
    }

    if (this._directoryToOpen) {
      this.openFolder(this._directoryToOpen)
    }
    this._directoryToOpen = null

    for (const { doc, options, selected } of this._filesToOpen) {
      this._doOpenTab(doc, options, selected)
    }
    this._filesToOpen.length = 0

    for (const { markdown, selected } of this._markdownToOpen) {
      this.browserWindow?.webContents.send('mt::new-untitled-tab', selected, markdown)
    }
  }
}

export default EditorWindow
