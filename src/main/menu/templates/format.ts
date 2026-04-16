import { type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/format'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

const withWindowAction = (
  handler: (focusedWindow?: Electron.BrowserWindow | null) => void
): NonNullable<MenuItemConstructorOptions['click']> => {
  return (_menuItem, focusedWindow) => {
    handler(focusedWindow)
  }
}

const format = (keybindings: KeybindingsLike): MenuItemConstructorOptions => {
  const submenu: MenuItemConstructorOptions[] = [{
    id: 'strongMenuItem',
    label: 'Bold',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.strong') ?? undefined,
    click: withWindowAction(actions.strong)
  }, {
    id: 'emphasisMenuItem',
    label: 'Italic',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.emphasis') ?? undefined,
    click: withWindowAction(actions.emphasis)
  }, {
    id: 'underlineMenuItem',
    label: 'Underline',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.underline') ?? undefined,
    click: withWindowAction(actions.underline)
  }, {
    type: 'separator'
  }, {
    id: 'superscriptMenuItem',
    label: 'Superscript',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.superscript') ?? undefined,
    click: withWindowAction(actions.superscript)
  }, {
    id: 'subscriptMenuItem',
    label: 'Subscript',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.subscript') ?? undefined,
    click: withWindowAction(actions.subscript)
  }, {
    id: 'highlightMenuItem',
    label: 'Highlight',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.highlight') ?? undefined,
    click: withWindowAction(actions.highlight)
  }, {
    type: 'separator'
  }, {
    id: 'inlineCodeMenuItem',
    label: 'Inline Code',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.inline-code') ?? undefined,
    click: withWindowAction(actions.inlineCode)
  }, {
    id: 'inlineMathMenuItem',
    label: 'Inline Math',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.inline-math') ?? undefined,
    click: withWindowAction(actions.inlineMath)
  }, {
    type: 'separator'
  }, {
    id: 'strikeMenuItem',
    label: 'Strikethrough',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.strike') ?? undefined,
    click: withWindowAction(actions.strikethrough)
  }, {
    id: 'hyperlinkMenuItem',
    label: 'Hyperlink',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.hyperlink') ?? undefined,
    click: withWindowAction(actions.hyperlink)
  }, {
    id: 'imageMenuItem',
    label: 'Image',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('format.image') ?? undefined,
    click: withWindowAction(actions.image)
  }, {
    type: 'separator'
  }, {
    label: 'Clear Formatting',
    accelerator: keybindings.getAccelerator('format.clear-format') ?? undefined,
    click: withWindowAction(actions.clearFormat)
  }]

  return {
    id: 'formatMenuItem',
    label: 'F&ormat',
    submenu
  }
}

export default format
