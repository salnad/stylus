import { app, BrowserWindow, ipcMain, type IpcMainEvent, type WebContents } from 'electron'
import EventEmitter from 'events'
import log from 'electron-log'
import Watcher, { WATCHER_STABILITY_THRESHOLD, WATCHER_STABILITY_POLL_INTERVAL } from '../filesystem/watcher'
import { WindowType, type WindowTypeValue } from '../windows/base'

interface AppMenuContract {
  has(windowId: number): boolean
  addDefaultMenu(windowId: number): void
  setActiveWindow(windowId: number): void
  removeWindowMenu(windowId: number): void
  updateAlwaysOnTopMenu(windowId: number, flag: boolean): void
}

interface PreferencesContract {
  getItem(key: string): unknown
}

interface ApplicationWindowLike extends EventEmitter {
  id: number
  type: WindowTypeValue
  browserWindow: BrowserWindow
  destroy(): void
  reload(): void
  addToOpenedFiles(filePath: string): void
  openTab(filePath: string, options: Record<string, unknown>, select: boolean): void
  removeFromOpenedFiles(pathname: string): void
  changeOpenedFilePath(pathname: string, oldPathname: string): void
  getCandidateScores(fileList: string[]): Array<{ id: number, score: number }>
}

class WindowActivityList {
  private readonly _buf: number[]

  constructor () {
    this._buf = []
  }

  getNewest (): number | null {
    const { _buf } = this
    if (_buf.length) {
      return _buf[_buf.length - 1]
    }
    return null
  }

  getSecondNewest (): number | null {
    const { _buf } = this
    if (_buf.length >= 2) {
      return _buf[_buf.length - 2]
    }
    return null
  }

  setNewest (id: number | null): void {
    if (id == null) {
      return
    }

    const { _buf } = this
    const index = _buf.indexOf(id)
    if (index !== -1) {
      const lastIndex = _buf.length - 1
      if (index === lastIndex) {
        return
      }
      _buf.splice(index, 1)
    }
    _buf.push(id)
  }

  delete (id: number): void {
    const { _buf } = this
    const index = _buf.indexOf(id)
    if (index !== -1) {
      _buf.splice(index, 1)
    }
  }
}

class WindowManager extends EventEmitter {
  private readonly _appMenu: AppMenuContract
  private _activeWindowId: number | null
  private readonly _windows: Map<number, ApplicationWindowLike>
  private readonly _windowActivity: WindowActivityList
  private readonly _watcher: InstanceType<typeof Watcher>

  constructor (appMenu: AppMenuContract, preferences: PreferencesContract) {
    super()

    this._appMenu = appMenu
    this._activeWindowId = null
    this._windows = new Map()
    this._windowActivity = new WindowActivityList()
    this._watcher = new Watcher(preferences)

    this._listenForIpcMain()
  }

  add (window: ApplicationWindowLike): void {
    const { id: windowId } = window
    this._windows.set(windowId, window)

    if (!this._appMenu.has(windowId)) {
      this._appMenu.addDefaultMenu(windowId)
    }

    if (this.windowCount === 1) {
      this.setActiveWindow(windowId)
    }

    window.on('window-focus', () => {
      this.setActiveWindow(windowId)
    })
    window.on('window-closed', () => {
      this.remove(windowId)
      this._watcher.unwatchByWindowId(windowId)
    })
  }

  get (windowId: number | null): ApplicationWindowLike | undefined {
    if (windowId == null) {
      return undefined
    }
    return this._windows.get(windowId)
  }

  getBrowserWindow (windowId: number): BrowserWindow | undefined {
    const window = this.get(windowId)
    return window?.browserWindow
  }

  remove (windowId: number): ApplicationWindowLike | undefined {
    const { _windows } = this
    const window = this.get(windowId)
    if (window) {
      window.removeAllListeners('window-focus')

      this._windowActivity.delete(windowId)
      const nextWindowId = this._windowActivity.getNewest()
      this.setActiveWindow(nextWindowId)

      _windows.delete(windowId)
    }
    return window
  }

  setActiveWindow (windowId: number | null): void {
    if (this._activeWindowId !== windowId) {
      this._activeWindowId = windowId
      this._windowActivity.setNewest(windowId)
      if (windowId != null) {
        this._appMenu.setActiveWindow(windowId)
      }
      this.emit('activeWindowChanged', windowId)
    }
  }

  getActiveWindow (): ApplicationWindowLike | undefined {
    return this.get(this._activeWindowId)
  }

  getActiveWindowId (): number | null {
    return this._activeWindowId
  }

  getActiveEditor (): ApplicationWindowLike | undefined {
    let win = this.getActiveWindow()
    if (win && win.type !== WindowType.EDITOR) {
      win = this.get(this._windowActivity.getSecondNewest())
      if (win && win.type === WindowType.EDITOR) {
        return win
      }
      return undefined
    }
    return win
  }

  getActiveEditorId (): number | null {
    const win = this.getActiveEditor()
    return win ? win.id : null
  }

  getWindowsByType (type: WindowTypeValue): Array<{ id: number, win: ApplicationWindowLike }> {
    if (!WindowType[type.toUpperCase() as keyof typeof WindowType]) {
      console.error(`"${type}" is not a valid window type.`)
    }

    const result: Array<{ id: number, win: ApplicationWindowLike }> = []
    for (const [key, value] of this.windows) {
      if (value.type === type) {
        result.push({
          id: key,
          win: value
        })
      }
    }
    return result
  }

  findBestWindowToOpenIn (fileList: string[]): Array<{ windowId: number | null, fileList: string[] }> {
    if (!fileList || !Array.isArray(fileList) || !fileList.length) return []
    const { windows } = this
    const lastActiveEditorId = this.getActiveEditorId()

    if (this.windowCount <= 1) {
      return [{ windowId: lastActiveEditorId, fileList }]
    }

    let filePathScores: Array<{ id: number, score: number }> | null = null
    for (const window of windows.values()) {
      if (window.type === WindowType.EDITOR) {
        const scores = window.getCandidateScores(fileList)
        if (!filePathScores) {
          filePathScores = scores
        } else {
          const len = filePathScores.length
          for (let i = 0; i < len; ++i) {
            if (filePathScores[i].score !== -1 && filePathScores[i].score < scores[i].score) {
              filePathScores[i] = scores[i]
            }
          }
        }
      }
    }

    const scoreList = filePathScores ?? []
    const result: Array<{ windowId: number | null, fileList: string[] }> = []
    const len = scoreList.length
    for (let i = 0; i < len; ++i) {
      let { id: windowId, score } = scoreList[i]

      if (score === -1) {
        continue
      } else if (score === 0) {
        windowId = lastActiveEditorId ?? 0
      }

      let item = result.find(windowItem => windowItem.windowId === windowId)
      if (!item) {
        item = { windowId, fileList: [] }
        result.push(item)
      }
      item.fileList.push(fileList[i])
    }
    return result
  }

  get windows (): Map<number, ApplicationWindowLike> {
    return this._windows
  }

  get windowCount (): number {
    return this._windows.size
  }

  closeWatcher (): void {
    this._watcher.close()
  }

  forceClose (browserWindow: BrowserWindow | null | undefined): boolean {
    if (!browserWindow) {
      return false
    }

    const { id: windowId } = browserWindow
    const { _appMenu, _windows } = this

    this._watcher.unwatchByWindowId(windowId)
    _appMenu.removeWindowMenu(windowId)

    const window = this.remove(windowId)
    if (window) {
      window.destroy()
    } else {
      log.error('Something went wrong: Cannot find associated application window!')
      browserWindow.destroy()
    }

    if (_windows.size === 0) {
      app.quit()
    }
    return true
  }

  forceCloseById (windowId: number): boolean {
    const browserWindow = this.getBrowserWindow(windowId)
    if (browserWindow) {
      return this.forceClose(browserWindow)
    }
    return false
  }

  private _windowFromSender (sender: WebContents): BrowserWindow | null {
    return BrowserWindow.fromWebContents(sender)
  }

  private _isIpcMainEvent (value: unknown): value is IpcMainEvent {
    return typeof value === 'object' && value !== null && 'sender' in value
  }

  private _internalListener<T extends unknown[]> (listener: (args: T) => void): (event: IpcMainEvent, ...args: unknown[]) => void {
    return (event, ...args) => {
      const payload = this._isIpcMainEvent(event) ? args : [event, ...args]
      listener(payload as T)
    }
  }

  private _listenForIpcMain (): void {
    ipcMain.on('mt::window-add-file-path', (event, filePath: string) => {
      const win = this._windowFromSender(event.sender)
      if (!win) {
        return
      }

      const editor = this.get(win.id)
      if (!editor) {
        log.error(`Cannot find window id "${win.id}" to add opened file.`)
        return
      }
      editor.addToOpenedFiles(filePath)
    })

    ipcMain.on('mt::close-window', event => {
      const win = this._windowFromSender(event.sender)
      this.forceClose(win)
    })

    ipcMain.on('mt::open-file', (event, filePath: string, options: Record<string, unknown>) => {
      const win = this._windowFromSender(event.sender)
      if (!win) {
        return
      }

      const editor = this.get(win.id)
      if (!editor) {
        log.error(`Cannot find window id "${win.id}" to open file.`)
        return
      }
      editor.openTab(filePath, options, true)
    })

    ipcMain.on('mt::window-tab-closed', (event, pathname: string) => {
      const win = this._windowFromSender(event.sender)
      if (!win) {
        return
      }

      const editor = this.get(win.id)
      if (editor) {
        editor.removeFromOpenedFiles(pathname)
      }
    })

    ipcMain.on('mt::window-toggle-always-on-top', event => {
      const win = this._windowFromSender(event.sender)
      if (!win) {
        return
      }

      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(win.id, flag)
    })

    ipcMain.on('watcher-unwatch-all-by-id', this._internalListener(([windowId]: [number]) => {
      this._watcher.unwatchByWindowId(windowId)
    }))
    ipcMain.on('watcher-watch-file', this._internalListener(([win, filePath]: [BrowserWindow, string]) => {
      this._watcher.watch(win, filePath, 'file')
    }))
    ipcMain.on('watcher-watch-directory', this._internalListener(([win, pathname]: [BrowserWindow, string]) => {
      this._watcher.watch(win, pathname, 'dir')
    }))
    ipcMain.on('watcher-unwatch-file', this._internalListener(([win, filePath]: [BrowserWindow, string]) => {
      this._watcher.unwatch(win, filePath, 'file')
    }))
    ipcMain.on('watcher-unwatch-directory', this._internalListener(([win, pathname]: [BrowserWindow, string]) => {
      this._watcher.unwatch(win, pathname, 'dir')
    }))

    ipcMain.on('window-add-file-path', this._internalListener(([windowId, filePath]: [number, string]) => {
      const editor = this.get(windowId)
      if (!editor) {
        log.error(`Cannot find window id "${windowId}" to add opened file.`)
        return
      }
      editor.addToOpenedFiles(filePath)
    }))
    ipcMain.on('window-change-file-path', this._internalListener(([windowId, pathname, oldPathname]: [number, string, string]) => {
      const editor = this.get(windowId)
      if (!editor) {
        log.error(`Cannot find window id "${windowId}" to change file path.`)
        return
      }
      editor.changeOpenedFilePath(pathname, oldPathname)
    }))

    ipcMain.on('window-file-saved', this._internalListener(([windowId, pathname]: [number, string]) => {
      const duration = WATCHER_STABILITY_THRESHOLD + (WATCHER_STABILITY_POLL_INTERVAL * 2)
      this._watcher.ignoreChangedEvent(windowId, pathname, duration)
    }))

    ipcMain.on('window-close-by-id', this._internalListener(([id]: [number]) => {
      this.forceCloseById(id)
    }))
    ipcMain.on('window-reload-by-id', this._internalListener(([id]: [number]) => {
      const window = this.get(id)
      if (window) {
        window.reload()
      }
    }))
    ipcMain.on('window-toggle-always-on-top', this._internalListener(([win]: [BrowserWindow]) => {
      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(win.id, flag)
    }))

    ipcMain.on('broadcast-preferences-changed', this._internalListener(([prefs]: [Record<string, unknown>]) => {
      if (typeof prefs.titleBarStyle !== 'undefined') {
        delete prefs.titleBarStyle
      }
      if (Object.keys(prefs).length > 0) {
        for (const { browserWindow } of this._windows.values()) {
          browserWindow.webContents.send('mt::user-preference', prefs)
        }
      }
    }))

    ipcMain.on('broadcast-user-data-changed', this._internalListener(([userData]: [Record<string, unknown>]) => {
      for (const { browserWindow } of this._windows.values()) {
        browserWindow.webContents.send('mt::user-preference', userData)
      }
    }))
  }
}

export default WindowManager
