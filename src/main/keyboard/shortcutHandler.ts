import { shell, type BrowserWindow } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import log from 'electron-log'
import { electronLocalshortcut, isValidElectronAccelerator } from '@hfelix/electron-localshortcut'
import { isFile2 } from 'common/filesystem'
import { isEqualAccelerator } from 'common/keybinding'
import type { AppEnvironment } from '../app/env'
import { isLinux, isOsx } from '../config'
import { getKeyboardInfo, keyboardLayoutMonitor, type KeyboardInfo } from '../keyboard'
import keybindingsDarwin from './keybindingsDarwin'
import keybindingsLinux from './keybindingsLinux'
import keybindingsWindows from './keybindingsWindows'

interface CommandManagerLike {
  has(id: string): boolean
  execute(id: string, win: BrowserWindow): unknown
}

interface ElectronLocalshortcutKeyMapping {
  value?: string
  withShift?: string
  withAltGr?: string
  withShiftAltGr?: string
}

type KeybindingMap = Map<string, string>
type RawUserKeybindings = Record<string, unknown>

class Keybindings {
  public readonly configPath: string
  public readonly commandManager: CommandManagerLike
  public userKeybindings: KeybindingMap
  public keys: KeybindingMap

  constructor (commandManager: CommandManagerLike, appEnvironment: AppEnvironment) {
    const { userDataPath } = appEnvironment.paths
    this.configPath = path.join(userDataPath, 'keybindings.json')
    this.commandManager = commandManager
    this.userKeybindings = new Map()
    this.keys = this.getDefaultKeybindings()

    this._prepareKeyMapper()

    if (appEnvironment.isDevMode) {
      for (const [id, accelerator] of this.keys) {
        if (!commandManager.has(id)) {
          console.error(`[DEBUG] Command with id="${id}" isn't available for accelerator="${accelerator}".`)
        }
      }
    }

    this._loadLocalKeybindings()
  }

  getAccelerator (id: string): string | null {
    return this.keys.get(id) ?? null
  }

  registerAccelerator (win: BrowserWindow, accelerator: string, callback: (win: BrowserWindow) => void): void {
    if (!win || !accelerator || !callback) {
      throw new Error(`addKeyHandler: invalid arguments (accelerator="${accelerator}").`)
    }

    electronLocalshortcut.register(win, accelerator, () => {
      callback(win)
      return true
    })
  }

  unregisterAccelerator (win: BrowserWindow, accelerator: string): void {
    electronLocalshortcut.unregister(win, accelerator)
  }

  registerEditorKeyHandlers (win: BrowserWindow): void {
    for (const [id, accelerator] of this.keys) {
      if (accelerator && accelerator.length > 1) {
        this.registerAccelerator(win, accelerator, () => {
          this.commandManager.execute(id, win)
        })
      }
    }
  }

  openConfigInFileManager (): void {
    const { configPath } = this
    if (!isFile2(configPath)) {
      fs.writeFileSync(configPath, '{\n\n\n}\n', 'utf-8')
    }
    shell.openPath(configPath).catch(err => {
      console.error(err)
    })
  }

  getDefaultKeybindings (): KeybindingMap {
    if (isOsx) {
      return keybindingsDarwin
    } else if (isLinux) {
      return keybindingsLinux
    }
    return keybindingsWindows
  }

  getUserKeybindings (): KeybindingMap {
    return this.userKeybindings
  }

  async setUserKeybindings (userKeybindings: KeybindingMap): Promise<boolean> {
    this.userKeybindings = new Map(userKeybindings)
    return this._saveUserKeybindings()
  }

  private _prepareKeyMapper (): void {
    const { layout, keymap } = getKeyboardInfo()
    electronLocalshortcut.setKeyboardLayout(layout, keymap as Record<string, ElectronLocalshortcutKeyMapping>)

    keyboardLayoutMonitor.addKeyboardLayoutListener(({ layout, keymap }: KeyboardInfo) => {
      if (global.MARKTEXT_DEBUG && process.env.MARKTEXT_DEBUG_KEYBOARD) {
        console.log('[DEBUG] Keyboard layout changed:\n', layout)
      }
      electronLocalshortcut.setKeyboardLayout(layout, keymap as Record<string, ElectronLocalshortcutKeyMapping>)
    })
  }

  private async _saveUserKeybindings (): Promise<boolean> {
    const { configPath, userKeybindings } = this
    try {
      const userKeybindingJson = JSON.stringify(Object.fromEntries(userKeybindings), null, 2)
      await fsPromises.writeFile(configPath, userKeybindingJson, 'utf8')
      return true
    } catch {
      return false
    }
  }

  private _loadLocalKeybindings (): void {
    if (global.MARKTEXT_SAFE_MODE || !isFile2(this.configPath)) {
      return
    }

    const rawUserKeybindings = this._loadUserKeybindingsFromDisk()
    if (!rawUserKeybindings) {
      log.warn('Invalid keybinding configuration: failed to load or parse file.')
      return
    }

    const userAccelerators = new Map<string, string>()
    for (const key in rawUserKeybindings) {
      if (this.keys.has(key)) {
        const value = rawUserKeybindings[key]
        if (typeof value === 'string') {
          if (value.length === 0) {
            userAccelerators.set(key, '')
          } else if (isValidElectronAccelerator(value)) {
            userAccelerators.set(key, value)
          } else {
            console.error(`[WARNING] "${value}" is not a valid accelerator.`)
          }
        }
      }
    }

    for (const [keyA, valueA] of userAccelerators) {
      for (const [keyB, valueB] of userAccelerators) {
        if (valueA !== '' && keyA !== keyB && isEqualAccelerator(valueA, valueB)) {
          const err = `Invalid keybindings.json configuration: Duplicate value for "${keyA}" and "${keyB}"!`
          console.log(err)
          log.error(err)
          return
        }
      }
    }

    if (userAccelerators.size === 0) {
      return
    }

    const accelerators = new Map(this.keys)

    for (const [userKey, userValue] of userAccelerators) {
      for (const [key, value] of accelerators) {
        if (isEqualAccelerator(value, userValue)) {
          accelerators.set(key, '')
          if (userAccelerators.get(key) == null) {
            userAccelerators.set(key, '')
          }
          break
        }
      }
      accelerators.set(userKey, userValue)
    }

    this.keys = accelerators
    this.userKeybindings = userAccelerators
  }

  private _loadUserKeybindingsFromDisk (): RawUserKeybindings | null {
    try {
      const obj = JSON.parse(fs.readFileSync(this.configPath, 'utf8')) as RawUserKeybindings
      if (typeof obj !== 'object' || obj === null) {
        return null
      }
      return obj
    } catch {
      return null
    }
  }
}

export default Keybindings
