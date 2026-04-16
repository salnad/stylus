import path from 'path'
import fsPromises from 'fs/promises'
import type { FSWatcher, Stats } from 'fs'
import type { BrowserWindow } from 'electron'
import log from 'electron-log'
import chokidar from 'chokidar'
import { exists } from 'common/filesystem'
import { hasMarkdownExtension } from 'common/filesystem/paths'
import type { MarkdownDocumentRaw } from 'common/types/documents'
import { getUniqueId } from '../utils'
import { loadMarkdownFile } from './markdown'
import { isLinux, isOsx } from '../config'

export const WATCHER_STABILITY_THRESHOLD = 1000
export const WATCHER_STABILITY_POLL_INTERVAL = 150

type WatchType = 'dir' | 'file'

interface PreferenceSnapshot {
  autoGuessEncoding?: boolean
  trimTrailingNewline?: number
}

interface PreferenceLike {
  getItem(key: string): unknown
  getAll(): PreferenceSnapshot
  getPreferredEol(): 'lf' | 'crlf'
}

interface WatcherFileChange {
  pathname: string
  data?: MarkdownDocumentRaw
}

interface WatcherDirectoryChange {
  pathname: string
  name?: string
  isCollapsed?: boolean
  isDirectory?: boolean
  isFile?: boolean
  isMarkdown?: boolean
  folders?: never[]
  files?: never[]
}

interface WatcherFileAddChange extends WatcherDirectoryChange {
  birthTime: Date
  data?: MarkdownDocumentRaw
}

interface IgnoreChangeEvent {
  windowId: number
  pathname: string
  duration: number
  start: Date
}

interface WatchEntry {
  win: BrowserWindow
  watcher: FSWatcher
  pathname: string
  type: WatchType
  close(): void
}

const EVENT_NAME = {
  dir: 'mt::update-object-tree',
  file: 'mt::update-file'
} as const

const add = async (
  win: BrowserWindow,
  pathname: string,
  type: WatchType,
  endOfLine: 'lf' | 'crlf',
  autoGuessEncoding: boolean,
  trimTrailingNewline: number
): Promise<void> => {
  const stats = await fsPromises.stat(pathname)
  const birthTime = stats.birthtime
  const isMarkdown = hasMarkdownExtension(pathname)
  const file: WatcherFileAddChange = {
    pathname,
    name: path.basename(pathname),
    isFile: true,
    isDirectory: false,
    birthTime,
    isMarkdown
  }
  if (isMarkdown) {
    try {
      const data = await loadMarkdownFile(
        pathname,
        endOfLine,
        autoGuessEncoding,
        trimTrailingNewline
      )
      file.data = data
    } catch (err) {
      if (type === 'file') {
        const message = err instanceof Error ? err.message : String(err)
        win.webContents.send('mt::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message
        })
        return
      }
    }
    win.webContents.send(EVENT_NAME[type], {
      type: 'add',
      change: file
    })
  }
}

const unlink = (win: BrowserWindow, pathname: string, type: WatchType): void => {
  const file: WatcherFileChange = { pathname }
  win.webContents.send(EVENT_NAME[type], {
    type: 'unlink',
    change: file
  })
}

const change = async (
  win: BrowserWindow,
  pathname: string,
  type: WatchType,
  endOfLine: 'lf' | 'crlf',
  autoGuessEncoding: boolean,
  trimTrailingNewline: number
): Promise<void> => {
  if (type === 'dir') return

  if (hasMarkdownExtension(pathname)) {
    try {
      const data = await loadMarkdownFile(
        pathname,
        endOfLine,
        autoGuessEncoding,
        trimTrailingNewline
      )
      const file: WatcherFileChange = {
        pathname,
        data
      }
      win.webContents.send('mt::update-file', {
        type: 'change',
        change: file
      })
    } catch (err) {
      if (type === 'file') {
        const message = err instanceof Error ? err.message : String(err)
        win.webContents.send('mt::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message
        })
      }
    }
  }
}

const addDir = (win: BrowserWindow, pathname: string, type: WatchType): void => {
  if (type === 'file') return

  const directory: WatcherDirectoryChange = {
    pathname,
    name: path.basename(pathname),
    isCollapsed: true,
    isDirectory: true,
    isFile: false,
    isMarkdown: false,
    folders: [],
    files: []
  }

  win.webContents.send('mt::update-object-tree', {
    type: 'addDir',
    change: directory
  })
}

const unlinkDir = (win: BrowserWindow, pathname: string, type: WatchType): void => {
  if (type === 'file') return

  const directory: WatcherDirectoryChange = { pathname }
  win.webContents.send('mt::update-object-tree', {
    type: 'unlinkDir',
    change: directory
  })
}

class Watcher {
  private readonly _preferences: PreferenceLike
  private _ignoreChangeEvents: IgnoreChangeEvent[]
  public watchers: Record<string, WatchEntry>

  constructor (preferences: PreferenceLike) {
    this._preferences = preferences
    this._ignoreChangeEvents = []
    this.watchers = {}
  }

  watch (win: BrowserWindow, watchPath: string, type: WatchType = 'dir'): () => void {
    const usePolling = isOsx ? true : !!this._preferences.getItem('watcherUsePolling')

    const id = getUniqueId()
    const watcher = chokidar.watch(watchPath, {
      ignored: (pathname, fileInfo?: Stats) => {
        if (!fileInfo) {
          return /(?:^|[/\\])(?:\..|node_modules|(?:.+\.asar))/.test(pathname)
        }

        if (/(?:^|[/\\])(?:\..|node_modules|(?:.+\.asar))/.test(pathname)) {
          return true
        }
        if (fileInfo.isDirectory()) {
          return false
        }
        return !hasMarkdownExtension(pathname)
      },
      ignoreInitial: type === 'file',
      persistent: true,
      ignorePermissionErrors: true,
      depth: type === 'file' ? (isOsx ? 1 : 0) : undefined,
      awaitWriteFinish: {
        stabilityThreshold: WATCHER_STABILITY_THRESHOLD,
        pollInterval: WATCHER_STABILITY_POLL_INTERVAL
      },
      usePolling
    })

    let disposed = false
    let enospcReached = false
    let renameTimer: NodeJS.Timeout | null = null

    watcher
      .on('add', async pathname => {
        if (!await this._shouldIgnoreEvent(win.id, pathname, type, usePolling)) {
          const eol = this._preferences.getPreferredEol()
          const {
            autoGuessEncoding = true,
            trimTrailingNewline = 2
          } = this._preferences.getAll()
          add(win, pathname, type, eol, autoGuessEncoding, trimTrailingNewline)
        }
      })
      .on('change', async pathname => {
        if (!await this._shouldIgnoreEvent(win.id, pathname, type, usePolling)) {
          const eol = this._preferences.getPreferredEol()
          const {
            autoGuessEncoding = true,
            trimTrailingNewline = 2
          } = this._preferences.getAll()
          change(win, pathname, type, eol, autoGuessEncoding, trimTrailingNewline)
        }
      })
      .on('unlink', pathname => unlink(win, pathname, type))
      .on('addDir', pathname => addDir(win, pathname, type))
      .on('unlinkDir', pathname => unlinkDir(win, pathname, type))
      .on('raw', (event: string, subpath: string, details: unknown) => {
        if (global.MARKTEXT_DEBUG_VERBOSE && global.MARKTEXT_DEBUG_VERBOSE >= 3) {
          console.log('watcher: ', event, subpath, details)
        }

        if (isLinux && type === 'file' && event === 'rename') {
          if (renameTimer) {
            clearTimeout(renameTimer)
          }
          renameTimer = setTimeout(async () => {
            renameTimer = null
            if (disposed) {
              return
            }

            const fileExists = await exists(watchPath)
            if (fileExists) {
              watcher.unwatch(watchPath)
              watcher.add(watchPath)
            }
          }, 150)
        }
      })
      .on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOSPC') {
          if (!enospcReached) {
            enospcReached = true
            log.warn('inotify limit reached: Too many file descriptors are opened.')

            win.webContents.send('mt::show-notification', {
              title: 'inotify limit reached',
              type: 'warning',
              message: 'Cannot watch all files and file changes because too many file descriptors are opened.'
            })
          }
        } else {
          log.error('Error while watching files:', error)
        }
      })

    const closeFn = (): void => {
      disposed = true
      if (this.watchers[id]) {
        delete this.watchers[id]
      }
      if (renameTimer) {
        clearTimeout(renameTimer)
        renameTimer = null
      }
      watcher.close()
    }

    this.watchers[id] = {
      win,
      watcher: watcher as unknown as FSWatcher,
      pathname: watchPath,
      type,
      close: closeFn
    }

    return closeFn
  }

  unwatch (win: BrowserWindow, watchPath: string, type: WatchType = 'dir'): void {
    for (const id of Object.keys(this.watchers)) {
      const entry = this.watchers[id]
      if (entry.win === win && entry.pathname === watchPath && entry.type === type) {
        entry.watcher.close()
        delete this.watchers[id]
        break
      }
    }
  }

  unwatchByWindowId (windowId: number): void {
    const watchers: FSWatcher[] = []
    const watchIds: string[] = []
    for (const id of Object.keys(this.watchers)) {
      const entry = this.watchers[id]
      if (entry.win.id === windowId) {
        watchers.push(entry.watcher)
        watchIds.push(id)
      }
    }

    if (watchers.length) {
      watchIds.forEach(id => delete this.watchers[id])
      watchers.forEach(watcher => watcher.close())
    }
  }

  close (): void {
    Object.keys(this.watchers).forEach(id => this.watchers[id].close())
    this.watchers = {}
    this._ignoreChangeEvents = []
  }

  ignoreChangedEvent (
    windowId: number,
    pathname: string,
    duration = WATCHER_STABILITY_THRESHOLD + (WATCHER_STABILITY_POLL_INTERVAL * 2)
  ): void {
    this._ignoreChangeEvents.push({ windowId, pathname, duration, start: new Date() })
  }

  private async _shouldIgnoreEvent (
    winId: number,
    pathname: string,
    type: WatchType,
    usePolling: boolean
  ): Promise<boolean> {
    if (type === 'file') {
      const currentTime = new Date()
      for (let i = 0; i < this._ignoreChangeEvents.length; ++i) {
        const { windowId, pathname: pathToIgnore, start, duration } = this._ignoreChangeEvents[i]
        if (windowId === winId && pathToIgnore === pathname) {
          this._ignoreChangeEvents.splice(i, 1)
          --i

          if (currentTime.getTime() - start.getTime() < duration) {
            return true
          }

          if (!usePolling) {
            try {
              const fileInfo = await fsPromises.stat(pathname)
              if (fileInfo.mtime.getTime() - start.getTime() < duration) {
                if (global.MARKTEXT_DEBUG_VERBOSE && global.MARKTEXT_DEBUG_VERBOSE >= 3) {
                  console.log(`Ignoring file event after "stat": current="${currentTime}", start="${start}", file="${fileInfo.mtime}".`)
                }
                return true
              }
            } catch (error) {
              console.error('Failed to "stat" file to determine modification time:', error)
            }
          }
        }
      }
    }
    return false
  }
}

export default Watcher
