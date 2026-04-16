import EventEmitter from 'events'
import path from 'path'
import { pathToFileURL } from 'url'
import type { BrowserWindow } from 'electron'
import type { AppEnvironment } from '../app/env'
import { isLinux } from '../config'

export interface UserPreferenceLike {
  getAll: () => {
    codeFontFamily: string
    codeFontSize: string | number
    hideScrollbar: boolean
    theme: string
    titleBarStyle: string
  }
}

export const WindowType = {
  BASE: 'base',
  EDITOR: 'editor',
  SETTINGS: 'settings'
} as const

export type WindowTypeValue = typeof WindowType[keyof typeof WindowType]

export const WindowLifecycle = {
  NONE: 0,
  LOADING: 1,
  READY: 2,
  QUITTED: 3
} as const

export type WindowLifecycleValue = typeof WindowLifecycle[keyof typeof WindowLifecycle]

class BaseWindow extends EventEmitter {
  protected readonly _accessor: unknown
  public id: number | null
  public browserWindow: BrowserWindow | null
  public lifecycle: WindowLifecycleValue
  public type: WindowTypeValue

  constructor (accessor: unknown) {
    super()

    this._accessor = accessor
    this.id = null
    this.browserWindow = null
    this.lifecycle = WindowLifecycle.NONE
    this.type = WindowType.BASE
  }

  bringToFront (): void {
    const { browserWindow: win } = this
    if (!win) {
      return
    }

    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    if (isLinux) {
      win.focus()
    } else {
      win.moveTop()
    }
  }

  reload (): void {
    this.browserWindow?.reload()
  }

  destroy (): void {
    this.lifecycle = WindowLifecycle.QUITTED
    this.emit('window-closed')

    this.removeAllListeners()
    if (this.browserWindow) {
      this.browserWindow.destroy()
      this.browserWindow = null
    }
    this.id = null
  }

  protected _buildUrlWithSettings (windowId: number, env: AppEnvironment, userPreference: UserPreferenceLike): URL {
    const { type } = this
    const { debug, paths } = env
    const {
      codeFontFamily,
      codeFontSize,
      hideScrollbar,
      theme,
      titleBarStyle
    } = userPreference.getAll()

    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:9091'
      : pathToFileURL(path.join(__dirname, 'index.html')).toString()

    const url = new URL(baseUrl)
    url.searchParams.set('udp', paths.userDataPath)
    url.searchParams.set('debug', debug ? '1' : '0')
    url.searchParams.set('wid', windowId.toString())
    url.searchParams.set('type', type)

    url.searchParams.set('cff', codeFontFamily)
    url.searchParams.set('cfs', String(codeFontSize))
    url.searchParams.set('hsb', hideScrollbar ? '1' : '0')
    url.searchParams.set('theme', theme)
    url.searchParams.set('tbs', titleBarStyle)

    return url
  }

  protected _buildUrlString (windowId: number, env: AppEnvironment, userPreference: UserPreferenceLike): string {
    return this._buildUrlWithSettings(windowId, env, userPreference).toString()
  }

  protected _getPreferredBackgroundColor (theme: string): string {
    switch (theme) {
      case 'dark':
        return '#282828'
      case 'material-dark':
        return '#34393f'
      case 'ulysses':
        return '#f3f3f3'
      case 'graphite':
        return '#f7f7f7'
      case 'one-dark':
        return '#282c34'
      case 'light':
      default:
        return '#ffffff'
    }
  }
}

export default BaseWindow
