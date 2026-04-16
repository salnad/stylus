import edit from './edit'
import prefEdit from './prefEdit'
import file from './file'
import help from './help'
import marktext from './marktext'
import view from './view'
import window from './window'
import paragraph from './paragraph'
import format from './format'
import theme from './theme'
import dock from './dock'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

interface PreferencesLike {
  getAll(): {
    autoSave?: boolean
  }
}

export const dockMenu = dock

export const configSettingMenu = (keybindings: KeybindingsLike): unknown[] => {
  return [
    ...(process.platform === 'darwin' ? [marktext(keybindings)] : []),
    prefEdit(keybindings),
    help()
  ]
}

export default function createEditorMenu (
  keybindings: KeybindingsLike,
  preferences: PreferencesLike,
  recentlyUsedFiles: string[]
): unknown[] {
  return [
    ...(process.platform === 'darwin' ? [marktext(keybindings)] : []),
    file(keybindings, preferences, recentlyUsedFiles),
    edit(keybindings),
    paragraph(keybindings),
    format(keybindings),
    window(keybindings),
    theme(preferences),
    view(keybindings),
    help()
  ]
}
