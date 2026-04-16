import path from 'path'
import { BrowserWindow, ipcMain } from 'electron'
import { enable as remoteEnable } from '@electron/remote/main'
import { electronLocalshortcut } from '@hfelix/electron-localshortcut'
import BaseWindow, { WindowLifecycle, WindowType, type UserPreferenceLike } from './base'
import { centerWindowOptions } from './utils'
import { TITLE_BAR_HEIGHT, preferencesWinOptions, isLinux, isOsx, type MarkTextBrowserWindowOptions } from '../config'
import type Accessor from '../app/accessor'
import type { AppEnvironment } from '../app/env'

interface PreferenceSnapshot extends Record<string, unknown> {
  codeFontFamily: string
  codeFontSize: string | number
  hideScrollbar: boolean
  titleBarStyle: string
  theme: string
}

interface PreferenceContract extends UserPreferenceLike {
  getAll(): PreferenceSnapshot
}

interface KeybindingsContract {
  getAccelerator(id: string): string | undefined
}

class SettingWindow extends BaseWindow {
  constructor (accessor: Accessor) {
    super(accessor)
    this.type = WindowType.SETTINGS
  }

  private get accessor (): Accessor {
    return this._accessor as Accessor
  }

  createWindow (category: string | null = null): BrowserWindow {
    const { menu: appMenu, env, keybindings, preferences } = this.accessor as unknown as {
      menu: { addSettingMenu(win: BrowserWindow): void }
      env: AppEnvironment
      keybindings: KeybindingsContract
      preferences: PreferenceContract
    }

    const winOptions: MarkTextBrowserWindowOptions = Object.assign({}, preferencesWinOptions)
    centerWindowOptions(winOptions)
    if (isLinux) {
      winOptions.icon = path.join(__static ?? '', 'logo-96px.png')
    }

    winOptions.resizable = true

    const { titleBarStyle, theme } = preferences.getAll()
    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    winOptions.backgroundColor = this._getPreferredBackgroundColor(theme || 'light')

    let win: BrowserWindow | null = this.browserWindow = new BrowserWindow(winOptions)
    remoteEnable(win.webContents)
    this.id = win.id

    appMenu.addSettingMenu(win)

    win.once('ready-to-show', () => {
      this.lifecycle = WindowLifecycle.READY
      this.emit('window-ready')
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win?.webContents.send('mt::window-active-status', { status: true })
    })

    win.on('blur', () => {
      this.emit('window-blur')
      win?.webContents.send('mt::window-active-status', { status: false })
    })

    win.on('close', event => {
      this.emit('window-close')

      event.preventDefault()
      if (win) {
        ipcMain.emit('window-close-by-id', win.id)
      }
    })

    win.on('closed', () => {
      this.emit('window-closed')
      win = null
    })

    this.lifecycle = WindowLifecycle.LOADING
    const url = this._buildUrlWithSettings(this.id, env, preferences)
    if (category) {
      url.searchParams.set('type', `${WindowType.SETTINGS}/${category}`)
    }
    this.browserWindow.loadURL(url.toString())
    this.browserWindow.setSheetOffset(TITLE_BAR_HEIGHT)

    const devToolsAccelerator = keybindings.getAccelerator('view.toggle-dev-tools')
    if (env.debug && devToolsAccelerator) {
      electronLocalshortcut.register(this.browserWindow, devToolsAccelerator, () => {
        this.browserWindow?.webContents.toggleDevTools()
      })
    }
    return this.browserWindow
  }
}

export default SettingWindow
