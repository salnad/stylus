import path from 'path'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import log from 'electron-log'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
  type BrowserWindowConstructorOptions,
  type IpcMainEvent
} from 'electron'
import { isChildOfDirectory } from 'common/filesystem/paths'
import type { ParsedApplicationArgs } from 'common/types/app'
import { isLinux, isOsx, isWindows } from '../config'
import parseArgs from '../cli/parser'
import { normalizeAndResolvePath } from '../filesystem'
import { normalizeMarkdownPath } from '../filesystem/markdown'
import { registerKeyboardListeners } from '../keyboard'
import { selectTheme } from '../menu/actions/theme'
import { dockMenu } from '../menu/templates'
import registerSpellcheckerListeners from '../spellchecker'
import { watchers } from '../utils/imagePathAutoComplement'
import { WindowType } from '../windows/base'
import EditorWindow from '../windows/editor'
import SettingWindow from '../windows/setting'
import type Accessor from './accessor'
import type WindowManager from './windowManager'

interface NormalizedPathInfo {
  isDir: boolean
  path: string
}

interface ApplicationWindowRuntime {
  id: number | null
  type: string
  browserWindow: BrowserWindow | null
  bringToFront(): void
}

interface EditorWindowRuntime extends ApplicationWindowRuntime {
  openedRootDirectory: string
  openTab(filePath: string, options: Record<string, unknown>, selected: boolean): void
  openTabsFromPaths(fileList: string[]): void
  openUntitledTab(selected?: boolean, markdown?: string): void
  openFolder(pathname: string): void
}

class App {
  private readonly _accessor: Accessor
  private readonly _args: ParsedApplicationArgs
  private readonly _openFilesCache: NormalizedPathInfo[]
  private _openFilesTimer: NodeJS.Timeout | null
  private readonly _windowManager: WindowManager

  constructor (accessor: Accessor, args: ParsedApplicationArgs) {
    this._accessor = accessor
    this._args = args ?? { _: [] }
    this._openFilesCache = []
    this._openFilesTimer = null
    this._windowManager = accessor.windowManager

    this._listenForIpcMain()
  }

  init (): void {
    if (isOsx) {
      app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    }

    app.on('second-instance', (_event, argv, workingDirectory) => {
      const args = parseArgs(argv.slice(1))
      const buf: NormalizedPathInfo[] = []

      for (const pathname of args._) {
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(path.resolve(workingDirectory, pathname))
        if (info) {
          buf.push(info)
        }
      }

      if (args['--new-window']) {
        this._openPathList(buf, true)
        return
      }

      this._openFilesCache.push(...buf)
      if (this._openFilesCache.length) {
        this._openFilesToOpen()
      } else {
        (this._windowManager.getActiveWindow() as unknown as ApplicationWindowRuntime | undefined)?.bringToFront()
      }
    })

    app.on('open-file', this.openFile)
    app.on('ready', this.ready)

    app.on('window-all-closed', () => {
      for (const watcher of watchers.values()) {
        watcher.close()
      }
      this._windowManager.closeWatcher()
      if (!isOsx) {
        app.quit()
      }
    })

    app.on('activate', () => {
      if (this._windowManager.windowCount === 0) {
        this.ready()
      }
    })

    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-attach-webview', event => {
        event.preventDefault()
      })
      contents.on('will-navigate', event => {
        event.preventDefault()
      })
      contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    })
  }

  async getScreenshotFileName (): Promise<string> {
    const screenshotFolderPath = await this._accessor.dataCenter.getItem('screenshotFolderPath')
    const fileName = `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-screenshot.png`
    return path.join(String(screenshotFolderPath), fileName)
  }

  readonly ready = (): void => {
    const { preferences } = this._accessor

    if (this._args._.length) {
      for (const pathname of this._args._) {
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(pathname)
        if (info) {
          this._openFilesCache.push(info)
        }
      }
    }

    const {
      startUpAction,
      defaultDirectoryToOpen,
      autoSwitchTheme,
      theme = 'light'
    } = preferences.getAll()

    if (startUpAction === 'folder' && defaultDirectoryToOpen) {
      const info = normalizeMarkdownPath(defaultDirectoryToOpen)
      if (info) {
        this._openFilesCache.unshift(info)
      }
    }

    const isDarkTheme = /dark/i.test(theme)
    if (autoSwitchTheme === 0 && isDarkTheme !== nativeTheme.shouldUseDarkColors) {
      selectTheme(nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
      nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    } else {
      nativeTheme.themeSource = isDarkTheme ? 'dark' : 'light'
    }

    let isDarkMode = nativeTheme.shouldUseDarkColors
    ipcMain.on('broadcast-preferences-changed', (_event: IpcMainEvent, change: Record<string, unknown>) => {
      if (change.theme) {
        const nextIsDarkTheme = /dark/i.test(String(change.theme))
        if (isDarkMode !== nextIsDarkTheme) {
          isDarkMode = nextIsDarkTheme
          nativeTheme.themeSource = nextIsDarkTheme ? 'dark' : 'light'
        } else if (nativeTheme.themeSource === 'system') {
          nativeTheme.themeSource = isDarkMode ? 'dark' : 'light'
        }
      }
    })

    if (isOsx) {
      app.dock.setMenu(dockMenu)
    } else if (isWindows) {
      app.setJumpList([{
        type: 'recent'
      }, {
        type: 'tasks',
        items: [{
          type: 'task',
          title: 'New Window',
          description: 'Opens a new window',
          program: process.execPath,
          args: '--new-window',
          iconPath: process.execPath,
          iconIndex: 0
        }]
      }])
    }

    if (this._openFilesCache.length) {
      this._openFilesToOpen()
    } else {
      this._createEditorWindow()
    }
  }

  readonly openFile = (event: Electron.Event, pathname: string): void => {
    event.preventDefault()
    const info = normalizeMarkdownPath(pathname)
    if (!info) {
      return
    }

    this._openFilesCache.push(info)

    if (app.isReady()) {
      if (this._openFilesTimer) {
        clearTimeout(this._openFilesTimer)
      }
      this._openFilesTimer = setTimeout(() => {
        this._openFilesTimer = null
        this._openFilesToOpen()
      }, 100)
    }
  }

  private _createEditorWindow (
    rootDirectory: string | null = null,
    fileList: string[] = [],
    markdownList: string[] = [],
    options: BrowserWindowConstructorOptions = {}
  ): EditorWindow {
    const editor = new EditorWindow(this._accessor as unknown as ConstructorParameters<typeof EditorWindow>[0])
    editor.createWindow(rootDirectory, fileList, markdownList, options)
    this._windowManager.add(editor as unknown as Parameters<WindowManager['add']>[0])
    if (this._windowManager.windowCount === 1 && editor.id != null) {
      this._accessor.menu.setActiveWindow(editor.id)
    }
    return editor
  }

  private _createSettingWindow (category?: string | null): void {
    const setting = new SettingWindow(this._accessor as unknown as ConstructorParameters<typeof SettingWindow>[0])
    setting.createWindow(category ?? null)
    this._windowManager.add(setting as unknown as Parameters<WindowManager['add']>[0])
    if (this._windowManager.windowCount === 1 && setting.id != null) {
      this._accessor.menu.setActiveWindow(setting.id)
    }
  }

  private _openFilesToOpen (): void {
    this._openPathList(this._openFilesCache, false)
  }

  private _openPathList (pathsToOpen: NormalizedPathInfo[], openFilesInSameWindow = false): void {
    const openFilesInNewWindow = !!this._accessor.preferences.getItem('openFilesInNewWindow')

    const fileSet = new Set<string>()
    const directorySet = new Set<string>()
    for (const { isDir, path: pathname } of pathsToOpen) {
      if (isDir) {
        directorySet.add(pathname)
      } else {
        fileSet.add(pathname)
      }
    }

    for (const window of this._windowManager.windows.values()) {
      if (window.type === WindowType.EDITOR) {
        const editorWindow = window as unknown as EditorWindowRuntime
        const openedRootDirectory = editorWindow.openedRootDirectory ?? ''
        if (directorySet.has(openedRootDirectory)) {
          editorWindow.bringToFront()
          directorySet.delete(openedRootDirectory)
        }
      }
    }

    const directoriesToOpen = Array.from(directorySet).map(rootDirectory => ({ rootDirectory, fileList: [] as string[] }))
    const filesToOpen = Array.from(fileSet)

    if (openFilesInSameWindow) {
      if (directoriesToOpen.length) {
        directoriesToOpen[0].fileList.push(...filesToOpen)
        directoriesToOpen.length = 1
      } else {
        directoriesToOpen.push({ rootDirectory: null as unknown as string, fileList: [...filesToOpen] })
      }
      filesToOpen.length = 0
    }

    if (!openFilesInSameWindow && !openFilesInNewWindow) {
      const isFirstWindow = this._windowManager.getActiveEditorId() === null

      for (let i = 0; i < directoriesToOpen.length; ++i) {
        const { fileList, rootDirectory } = directoriesToOpen[i]

        let breakOuterLoop = false
        for (let j = 0; j < filesToOpen.length; ++j) {
          const pathname = filesToOpen[j]
          if (isChildOfDirectory(rootDirectory, pathname)) {
            if (isFirstWindow) {
              fileList.push(...filesToOpen)
              filesToOpen.length = 0
              breakOuterLoop = true
              break
            }
            fileList.push(pathname)
            filesToOpen.splice(j, 1)
            --j
          }
        }

        if (breakOuterLoop) {
          break
        }
      }

      if (isFirstWindow && directoriesToOpen.length && filesToOpen.length) {
        directoriesToOpen[0].fileList.push(...filesToOpen)
        filesToOpen.length = 0
      } else {
        const windowList = this._windowManager.findBestWindowToOpenIn(filesToOpen)
        for (const item of windowList) {
          const { windowId, fileList } = item

          if (fileList.length === 0) {
            continue
          }

          if (windowId !== null) {
            const window = this._windowManager.get(windowId) as unknown as EditorWindowRuntime | undefined
            if (window) {
              window.openTabsFromPaths(fileList)
              window.bringToFront()
              continue
            }
          }
          this._createEditorWindow(null, fileList)
        }
      }

      for (const item of directoriesToOpen) {
        this._createEditorWindow(item.rootDirectory, item.fileList)
      }
    } else {
      for (const pathname of filesToOpen) {
        this._createEditorWindow(null, [pathname])
      }

      for (const item of directoriesToOpen) {
        this._createEditorWindow(item.rootDirectory, item.fileList)
      }
    }

    pathsToOpen.length = 0
  }

  private _openSettingsWindow (category?: string | null): void {
    const settingWins = this._windowManager.getWindowsByType(WindowType.SETTINGS)
    if (settingWins.length >= 1) {
      const browserSettingWindow = settingWins[0].win.browserWindow
      if (!browserSettingWindow) {
        return
      }
      browserSettingWindow.webContents.send('settings::change-tab', category)
      if (isLinux) {
        browserSettingWindow.focus()
      } else {
        browserSettingWindow.moveTop()
      }
      return
    }
    this._createSettingWindow(category)
  }

  private _listenForIpcMain (): void {
    registerKeyboardListeners()
    registerSpellcheckerListeners()

    ipcMain.on('app-create-editor-window', () => {
      this._createEditorWindow()
    })

    ipcMain.on('screen-capture', async (_event, win: BrowserWindow) => {
      if (!isOsx) {
        return
      }

      const screenshotFileName = await this.getScreenshotFileName()
      exec('screencapture -i -c', async err => {
        if (err) {
          log.error(err)
          return
        }
        try {
          const image = clipboard.readImage()
          const bufferImage = image.toPNG()
          await fsPromises.writeFile(screenshotFileName, bufferImage)
        } catch (writeError) {
          log.error(writeError)
        }
        win.webContents.send('mt::screenshot-captured')
      })
    })

    ipcMain.on('app-create-settings-window', (_event, category?: string | null) => {
      this._openSettingsWindow(category)
    })

    ipcMain.on('app-open-file-by-id', (_event, windowId: number, filePath: string) => {
      const openFilesInNewWindow = !!this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [filePath])
        return
      }

      const editor = this._windowManager.get(windowId) as unknown as EditorWindowRuntime | undefined
      if (editor) {
        editor.openTab(filePath, {}, true)
      }
    })

    ipcMain.on('app-open-files-by-id', (_event, windowId: number, fileList: string[]) => {
      const openFilesInNewWindow = !!this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, fileList)
        return
      }

      const editor = this._windowManager.get(windowId) as unknown as EditorWindowRuntime | undefined
      if (editor) {
        const normalizedFileList = fileList
          .map(item => normalizeMarkdownPath(item))
          .filter((item): item is NormalizedPathInfo => !!item && !item.isDir)
          .map(item => item.path)
        editor.openTabsFromPaths(normalizedFileList)
      }
    })

    ipcMain.on('app-open-markdown-by-id', (_event, windowId: number, data: string) => {
      const openFilesInNewWindow = !!this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [], [data])
        return
      }

      const editor = this._windowManager.get(windowId) as unknown as EditorWindowRuntime | undefined
      if (editor) {
        editor.openUntitledTab(true, data)
      }
    })

    ipcMain.on('app-open-directory-by-id', (_event, windowId: number, pathname: string, openInSameWindow: boolean) => {
      const { openFolderInNewWindow } = this._accessor.preferences.getAll()
      if (openInSameWindow || !openFolderInNewWindow) {
        const editor = this._windowManager.get(windowId) as unknown as EditorWindowRuntime | undefined
        if (editor) {
          editor.openFolder(pathname)
          return
        }
      }
      this._createEditorWindow(pathname)
    })

    ipcMain.on('mt::app-try-quit', () => {
      app.quit()
    })

    ipcMain.on('mt::open-file-by-window-id', (_event, windowId: number, filePath: string) => {
      const resolvedPath = normalizeAndResolvePath(filePath)
      const openFilesInNewWindow = !!this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [resolvedPath])
        return
      }

      const editor = this._windowManager.get(windowId) as unknown as EditorWindowRuntime | undefined
      if (editor) {
        editor.openTab(resolvedPath, {}, true)
      }
    })

    ipcMain.on('mt::select-default-directory-to-open', async event => {
      const { defaultDirectoryToOpen } = this._accessor.preferences.getAll()
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return
      }

      const { filePaths } = await dialog.showOpenDialog(win, {
        defaultPath: defaultDirectoryToOpen,
        properties: ['openDirectory', 'createDirectory']
      })
      if (filePaths?.[0]) {
        this._accessor.preferences.setItems({ defaultDirectoryToOpen: filePaths[0] })
      }
    })

    ipcMain.on('mt::open-setting-window', () => {
      this._openSettingsWindow()
    })

    ipcMain.on('mt::make-screenshot', event => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        ipcMain.emit('screen-capture', null, win)
      }
    })

    ipcMain.on('mt::request-keybindings', event => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return
      }

      win.webContents.send('mt::keybindings-response', Object.fromEntries(this._accessor.keybindings.getDefaultKeybindings()))
    })

    ipcMain.on('mt::open-keybindings-config', () => {
      this._accessor.keybindings.openConfigInFileManager()
    })

    ipcMain.handle('mt::keybinding-get-pref-keybindings', async () => {
      const defaultKeybindings = this._accessor.keybindings.getDefaultKeybindings()
      const userKeybindings = this._accessor.keybindings.getUserKeybindings()
      return { defaultKeybindings, userKeybindings }
    })

    ipcMain.handle('mt::keybinding-save-user-keybindings', async (_event, userKeybindings: Map<string, string>) => {
      return this._accessor.keybindings.setUserKeybindings(userKeybindings)
    })

    ipcMain.handle('mt::fs-trash-item', async (_event, fullPath: string) => {
      return shell.trashItem(fullPath)
    })
  }
}

export default App
