import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import Store from 'electron-store'
import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { isWindows } from '../config'
import { hasSameKeys } from '../utils'
import schema from './schema.json'
import type { PreferenceState, PreferenceKey } from 'common/types/preferences'
import type AppPaths from '../app/paths'

const PREFERENCES_FILE_NAME = 'preferences'
type PreferenceStoreOptions = import('electron-store').Options<PreferenceState>

class Preference extends EventEmitter {
  public readonly preferencesPath: string
  public readonly hasPreferencesFile: boolean
  public readonly store: Store<PreferenceState>
  public readonly staticPath: string

  constructor (paths: AppPaths) {
    super()

    const { preferencesPath } = paths
    const storeOptions = {
      schema,
      name: PREFERENCES_FILE_NAME
    } as unknown as PreferenceStoreOptions

    this.preferencesPath = preferencesPath
    this.hasPreferencesFile = fs.existsSync(path.join(this.preferencesPath, `./${PREFERENCES_FILE_NAME}.json`))
    this.store = new Store<PreferenceState>(storeOptions)
    this.staticPath = path.join(__static ?? '', 'preference.json')

    this.init()
  }

  init = (): void => {
    let defaultSettings: PreferenceState | null = null
    try {
      defaultSettings = JSON.parse(fs.readFileSync(this.staticPath, { encoding: 'utf8' }) || '{}') as PreferenceState

      if (nativeTheme.shouldUseDarkColors) {
        defaultSettings.theme = 'dark'
      }
    } catch (err) {
      log.error(err)
    }

    if (!defaultSettings) {
      throw new Error('Can not load static preference.json file')
    }

    if (!this.hasPreferencesFile) {
      this.store.set(defaultSettings)
    } else {
      const userSetting = { ...this.getAll() } as Partial<PreferenceState> & Record<string, unknown>
      const requiresUpdate = !hasSameKeys(
        defaultSettings as unknown as Record<string, unknown>,
        userSetting
      )
      const defaultSettingKeys = Object.keys(defaultSettings)

      if (requiresUpdate) {
        const filteredUserSetting = Object.fromEntries(
          Object.entries(userSetting).filter(([key]) => defaultSettingKeys.includes(key))
        ) as Partial<PreferenceState>
        this.store.set({
          ...defaultSettings,
          ...filteredUserSetting
        })
      }
    }

    this._listenForIpcMain()
  }

  getAll (): PreferenceState {
    return this.store.store
  }

  setItem<K extends PreferenceKey> (key: K, value: PreferenceState[K]): void {
    ipcMain.emit('broadcast-preferences-changed', { [key]: value })
    this.store.set(key, value)
  }

  getItem<K extends PreferenceKey> (key: K): PreferenceState[K] {
    return this.store.get(key) as PreferenceState[K]
  }

  setItems (settings: Partial<PreferenceState> | null | undefined): void {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    for (const key of Object.keys(settings) as PreferenceKey[]) {
      const value = settings[key]
      if (typeof value !== 'undefined') {
        ipcMain.emit('broadcast-preferences-changed', { [key]: value })
        this.store.set({ [key]: value } as Partial<PreferenceState>)
      }
    }
  }

  getPreferredEol (): 'lf' | 'crlf' {
    const endOfLine = this.getItem('endOfLine')
    if (endOfLine === 'lf') {
      return 'lf'
    }
    return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
  }

  exportJSON (): void {
    // todo
  }

  importJSON (): void {
    // todo
  }

  private _listenForIpcMain (): void {
    ipcMain.on('mt::ask-for-user-preference', event => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.webContents.send('mt::user-preference', this.getAll())
      }
    })
    ipcMain.on('mt::set-user-preference', (_event, settings: Partial<PreferenceState>) => {
      this.setItems(settings)
    })
    ipcMain.on('mt::cmd-toggle-autosave', () => {
      this.setItem('autoSave', !this.getItem('autoSave'))
    })
    ipcMain.on('set-user-preference', (_event, settings: Partial<PreferenceState>) => {
      this.setItems(settings)
    })
  }
}

export default Preference
