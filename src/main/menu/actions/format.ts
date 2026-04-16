import type { Menu as ElectronMenu, BrowserWindow } from 'electron'
import { COMMANDS } from '../../commands'

type FormatType =
  | 'clear'
  | 'em'
  | 'mark'
  | 'link'
  | 'image'
  | 'inline_code'
  | 'inline_math'
  | 'del'
  | 'strong'
  | 'sub'
  | 'sup'
  | 'u'

const MENU_ID_FORMAT_MAP = Object.freeze({
  strongMenuItem: 'strong',
  emphasisMenuItem: 'em',
  inlineCodeMenuItem: 'inline_code',
  strikeMenuItem: 'del',
  hyperlinkMenuItem: 'link',
  imageMenuItem: 'image',
  inlineMathMenuItem: 'inline_math'
} as const)

const format = (win: BrowserWindow | null | undefined, type: FormatType): void => {
  if (win?.webContents) {
    win.webContents.send('mt::editor-format-action', { type })
  }
}

export const clearFormat = (win?: BrowserWindow | null): void => {
  format(win, 'clear')
}

export const emphasis = (win?: BrowserWindow | null): void => {
  format(win, 'em')
}

export const highlight = (win?: BrowserWindow | null): void => {
  format(win, 'mark')
}

export const hyperlink = (win?: BrowserWindow | null): void => {
  format(win, 'link')
}

export const image = (win?: BrowserWindow | null): void => {
  format(win, 'image')
}

export const inlineCode = (win?: BrowserWindow | null): void => {
  format(win, 'inline_code')
}

export const inlineMath = (win?: BrowserWindow | null): void => {
  format(win, 'inline_math')
}

export const strikethrough = (win?: BrowserWindow | null): void => {
  format(win, 'del')
}

export const strong = (win?: BrowserWindow | null): void => {
  format(win, 'strong')
}

export const subscript = (win?: BrowserWindow | null): void => {
  format(win, 'sub')
}

export const superscript = (win?: BrowserWindow | null): void => {
  format(win, 'sup')
}

export const underline = (win?: BrowserWindow | null): void => {
  format(win, 'u')
}

interface CommandManagerLike {
  add(id: string, callback: unknown): void
}

export const loadFormatCommands = (commandManager: CommandManagerLike): void => {
  commandManager.add(COMMANDS.FORMAT_CLEAR_FORMAT, clearFormat)
  commandManager.add(COMMANDS.FORMAT_EMPHASIS, emphasis)
  commandManager.add(COMMANDS.FORMAT_HIGHLIGHT, highlight)
  commandManager.add(COMMANDS.FORMAT_HYPERLINK, hyperlink)
  commandManager.add(COMMANDS.FORMAT_IMAGE, image)
  commandManager.add(COMMANDS.FORMAT_INLINE_CODE, inlineCode)
  commandManager.add(COMMANDS.FORMAT_INLINE_MATH, inlineMath)
  commandManager.add(COMMANDS.FORMAT_STRIKE, strikethrough)
  commandManager.add(COMMANDS.FORMAT_STRONG, strong)
  commandManager.add(COMMANDS.FORMAT_SUBSCRIPT, subscript)
  commandManager.add(COMMANDS.FORMAT_SUPERSCRIPT, superscript)
  commandManager.add(COMMANDS.FORMAT_UNDERLINE, underline)
}

export const updateFormatMenu = (applicationMenu: ElectronMenu, formats: Record<string, boolean>): void => {
  const formatMenuItem = applicationMenu.getMenuItemById('formatMenuItem')
  const submenu = formatMenuItem?.submenu
  if (!submenu) {
    return
  }

  submenu.items.forEach(item => {
    item.checked = false
  })
  submenu.items.forEach(item => {
    if (item.id && formats[MENU_ID_FORMAT_MAP[item.id as keyof typeof MENU_ID_FORMAT_MAP]]) {
      item.checked = true
    }
  })
}
