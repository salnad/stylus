import type { MenuItemConstructorOptions } from 'electron'

type ContextMenuClick = NonNullable<MenuItemConstructorOptions['click']>

type MutableMenuItem = MenuItemConstructorOptions & {
  id: string
  label?: string
  role?: MenuItemConstructorOptions['role']
  enabled?: boolean
}

const emitToWindow = (channel: string, payload?: string): ContextMenuClick => {
  return (_menuItem, targetWindow) => {
    if (!targetWindow) {
      return
    }

    if (typeof payload === 'undefined') {
      targetWindow.webContents.send(channel)
    } else {
      targetWindow.webContents.send(channel, payload)
    }
  }
}

export const CUT: MutableMenuItem = {
  label: 'Cut',
  id: 'cutMenuItem',
  role: 'cut'
}

export const COPY: MutableMenuItem = {
  label: 'Copy',
  id: 'copyMenuItem',
  role: 'copy'
}

export const PASTE: MutableMenuItem = {
  label: 'Paste',
  id: 'pasteMenuItem',
  role: 'paste'
}

export const COPY_AS_MARKDOWN: MutableMenuItem = {
  label: 'Copy As Markdown',
  id: 'copyAsMarkdownMenuItem',
  click: emitToWindow('mt::cm-copy-as-markdown')
}

export const COPY_AS_HTML: MutableMenuItem = {
  label: 'Copy As Html',
  id: 'copyAsHtmlMenuItem',
  click: emitToWindow('mt::cm-copy-as-html')
}

export const PASTE_AS_PLAIN_TEXT: MutableMenuItem = {
  label: 'Paste as Plain Text',
  id: 'pasteAsPlainTextMenuItem',
  click: emitToWindow('mt::cm-paste-as-plain-text')
}

export const INSERT_BEFORE: MutableMenuItem = {
  label: 'Insert Paragraph Before',
  id: 'insertParagraphBeforeMenuItem',
  click: emitToWindow('mt::cm-insert-paragraph', 'before')
}

export const INSERT_AFTER: MutableMenuItem = {
  label: 'Insert Paragraph After',
  id: 'insertParagraphAfterMenuItem',
  click: emitToWindow('mt::cm-insert-paragraph', 'after')
}

export const SEPARATOR: MenuItemConstructorOptions = {
  type: 'separator'
}
