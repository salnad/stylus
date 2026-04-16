import { ipcMain, shell } from 'electron'
import log from 'electron-log'
import EventEmitter from 'events'
import fsPromises from 'fs/promises'
import {
  getCurrentKeyboardLayout,
  getKeyMap,
  onDidChangeKeyboardLayout,
  type IKeyboardLayoutInfo,
  type IKeyboardMapping
} from 'native-keymap'
import os from 'os'
import path from 'path'

export interface KeyboardInfo {
  layout: IKeyboardLayoutInfo
  keymap: IKeyboardMapping
}

let currentKeyboardInfo: KeyboardInfo | null = null

const loadKeyboardInfo = (): KeyboardInfo => {
  const keyboardInfo: KeyboardInfo = {
    layout: getCurrentKeyboardLayout(),
    keymap: getKeyMap()
  }
  currentKeyboardInfo = keyboardInfo
  return keyboardInfo
}

export const getKeyboardInfo = (): KeyboardInfo => {
  if (!currentKeyboardInfo) {
    return loadKeyboardInfo()
  }
  return currentKeyboardInfo
}

const KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID = 'onDidChangeKeyboardLayout'

class KeyboardLayoutMonitor extends EventEmitter {
  private _isSubscribed: boolean
  private _emitTimer: NodeJS.Timeout | null

  constructor () {
    super()
    this._isSubscribed = false
    this._emitTimer = null
  }

  addKeyboardLayoutListener (callback: (info: KeyboardInfo) => void): this {
    this._ensureNativeListener()
    return super.addListener(KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID, callback)
  }

  removeKeyboardLayoutListener (callback: (info: KeyboardInfo) => void): this {
    return super.removeListener(KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID, callback)
  }

  private _ensureNativeListener (): void {
    if (this._isSubscribed) {
      return
    }

    this._isSubscribed = true
    onDidChangeKeyboardLayout(() => {
      if (this._emitTimer) {
        clearTimeout(this._emitTimer)
      }
      this._emitTimer = setTimeout(() => {
        this.emit(KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID, loadKeyboardInfo())
        this._emitTimer = null
      }, 150)
    })
  }
}

export const keyboardLayoutMonitor = new KeyboardLayoutMonitor()

export const registerKeyboardListeners = (): void => {
  ipcMain.handle('mt::keybinding-get-keyboard-info', async () => {
    return getKeyboardInfo()
  })

  ipcMain.on('mt::keybinding-debug-dump-keyboard-info', async () => {
    const dumpPath = path.join(os.tmpdir(), 'marktext_keyboard_info.json')
    const content = JSON.stringify(getKeyboardInfo(), null, 2)

    fsPromises.writeFile(dumpPath, content, 'utf8')
      .then(() => {
        console.log(`Keyboard information written to "${dumpPath}".`)
        shell.openPath(dumpPath).catch(error => {
          log.error('Error opening keyboard information dump:', error)
        })
      })
      .catch(error => {
        log.error('Error dumping keyboard information:', error)
      })
  })
}
