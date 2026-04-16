import { ipcRenderer } from 'electron'
import { isEqualAccelerator } from 'common/keybinding'
import getCommandDescriptionById from '@/commands/descriptions'
import { isOsx } from '@/util'

const SHORTCUT_TYPE_DEFAULT = 0
const SHORTCUT_TYPE_USER = 1

export interface UIKeybindingEntry {
  id: string
  description: string
  accelerator: string
  type: number
}

type KeybindingMap = Map<string, string>

const getShortcutDescriptionById = (id: string): string => {
  const description = getCommandDescriptionById(id)
  if (!description) {
    return id
  }
  return description
}

export default class KeybindingConfigurator {
  public defaultKeybindings: KeybindingMap
  public keybindingList: UIKeybindingEntry[]
  public isDirty: boolean

  constructor (defaultKeybindings: KeybindingMap, userKeybindings: KeybindingMap) {
    this.defaultKeybindings = defaultKeybindings
    this.keybindingList = this._buildUiKeybindingList(defaultKeybindings, userKeybindings)
    this.isDirty = false
  }

  private _buildUiKeybindingList (defaultKeybindings: KeybindingMap, userKeybindings: KeybindingMap): UIKeybindingEntry[] {
    const uiKeybindings: UIKeybindingEntry[] = []
    for (const [id] of defaultKeybindings) {
      if (!isOsx && id.startsWith('mt.')) {
        continue
      }
      uiKeybindings.push(this._toUiKeybinding(id, defaultKeybindings, userKeybindings))
    }
    uiKeybindings.sort((a, b) => a.description.localeCompare(b.description))
    return uiKeybindings
  }

  private _toUiKeybinding (id: string, defaultKeybindings: KeybindingMap, userKeybindings: KeybindingMap): UIKeybindingEntry {
    const description = getShortcutDescriptionById(id)
    const userAccelerator = userKeybindings.get(id)
    let type = SHORTCUT_TYPE_DEFAULT

    let accelerator: string
    if (userAccelerator != null) {
      type = SHORTCUT_TYPE_USER
      accelerator = userAccelerator
    } else {
      accelerator = defaultKeybindings.get(id) ?? ''
    }
    return { id, description, accelerator, type }
  }

  getKeybindings (): UIKeybindingEntry[] {
    return this.keybindingList
  }

  async save (): Promise<boolean> {
    if (!this.isDirty) {
      return true
    }

    const userKeybindings = this._getUserKeybindingMap()
    const result = await ipcRenderer.invoke('mt::keybinding-save-user-keybindings', userKeybindings)
    if (result) {
      this.isDirty = false
      return true
    }
    return false
  }

  private _getUserKeybindingMap (): KeybindingMap {
    const userKeybindings = new Map<string, string>()
    for (const entry of this.keybindingList) {
      const { id, accelerator, type } = entry
      if (type !== SHORTCUT_TYPE_DEFAULT) {
        userKeybindings.set(id, accelerator)
      }
    }
    return userKeybindings
  }

  change (id: string, accelerator: string): boolean {
    const entry = this.keybindingList.find(item => item.id === id)
    if (!entry) {
      return false
    }

    if (accelerator && this._isDuplicate(accelerator)) {
      return false
    }

    entry.accelerator = accelerator
    entry.type = this._isDefaultBinding(id, accelerator)
      ? SHORTCUT_TYPE_DEFAULT
      : SHORTCUT_TYPE_USER
    this.isDirty = true
    return true
  }

  unbind (id: string): boolean {
    return this.change(id, '')
  }

  resetToDefault (id: string): boolean {
    const accelerator = this.defaultKeybindings.get(id)
    if (accelerator == null) {
      return false
    }
    return this.change(id, accelerator)
  }

  async resetAll (): Promise<boolean> {
    const { defaultKeybindings, keybindingList } = this
    for (const entry of keybindingList) {
      const defaultAccelerator = defaultKeybindings.get(entry.id)
      if (defaultAccelerator) {
        entry.accelerator = defaultAccelerator
      } else {
        entry.accelerator = ''
      }
      entry.type = SHORTCUT_TYPE_DEFAULT
    }
    this.isDirty = true
    return this.save()
  }

  getDefaultAccelerator (id: string): string | undefined {
    return this.defaultKeybindings.get(id)
  }

  private _isDuplicate (accelerator: string): boolean {
    return accelerator !== '' &&
      this.keybindingList.findIndex(entry => isEqualAccelerator(entry.accelerator, accelerator)) !== -1
  }

  private _isDefaultBinding (id: string, accelerator: string): boolean {
    return this.defaultKeybindings.get(id) === accelerator
  }
}
