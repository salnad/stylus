import {
  Menu,
  MenuItem,
  type BrowserWindow,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type PopupOptions
} from 'electron'
import {
  CUT,
  COPY,
  PASTE,
  COPY_AS_MARKDOWN,
  COPY_AS_HTML,
  PASTE_AS_PLAIN_TEXT,
  SEPARATOR,
  INSERT_BEFORE,
  INSERT_AFTER
} from './menuItems'
import spellcheckMenuBuilder from './spellcheck'

const CONTEXT_ITEMS = [
  INSERT_BEFORE,
  INSERT_AFTER,
  SEPARATOR,
  CUT,
  COPY,
  PASTE,
  SEPARATOR,
  COPY_AS_MARKDOWN,
  COPY_AS_HTML,
  PASTE_AS_PLAIN_TEXT
]

type MutableMenuItemConstructorOptions = MenuItemConstructorOptions & {
  enabled?: boolean
}

const isInsideEditor = (params: ContextMenuParams): boolean => {
  const { isEditable, editFlags, inputFieldType } = params
  return isEditable && inputFieldType === 'none' && !!editFlags.canEditRichly
}

export const showEditorContextMenu = (
  win: BrowserWindow,
  params: ContextMenuParams,
  isSpellcheckerEnabled: boolean
): void => {
  const {
    isEditable,
    hasImageContents,
    selectionText,
    editFlags,
    misspelledWord,
    dictionarySuggestions
  } = params

  if (isInsideEditor(params) && !hasImageContents) {
    const hasText = selectionText.trim().length > 0
    const canCopy = hasText && editFlags.canCut && editFlags.canCopy
    const isMisspelled = isEditable && !!selectionText && !!misspelledWord

    const menu = new Menu()
    if (isSpellcheckerEnabled) {
      const spellingSubmenu = spellcheckMenuBuilder(
        isMisspelled,
        misspelledWord as never,
        dictionarySuggestions as never
      )
      menu.append(new MenuItem({
        label: 'Spelling...',
        submenu: spellingSubmenu as unknown as MenuItemConstructorOptions['submenu']
      }))
      menu.append(new MenuItem(SEPARATOR as MenuItemConstructorOptions))
    }

    const copyItems = [CUT, COPY, COPY_AS_HTML, COPY_AS_MARKDOWN]
    copyItems.forEach(item => {
      const mutableItem = item as MutableMenuItemConstructorOptions
      mutableItem.enabled = canCopy
    })
    CONTEXT_ITEMS.forEach(item => {
      menu.append(new MenuItem(item as MenuItemConstructorOptions))
    })
    const popupOptions: PopupOptions = { window: win, x: params.x, y: params.y }
    menu.popup(popupOptions)
  }
}
