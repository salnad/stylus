import { type MenuItemConstructorOptions } from 'electron'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

const prefEdit = (keybindings: KeybindingsLike): MenuItemConstructorOptions => {
  return {
    label: 'Edit',
    submenu: [{
      label: 'Cut',
      accelerator: keybindings.getAccelerator('edit.cut') ?? undefined,
      role: 'cut'
    }, {
      label: 'Copy',
      accelerator: keybindings.getAccelerator('edit.copy') ?? undefined,
      role: 'copy'
    }, {
      label: 'Paste',
      accelerator: keybindings.getAccelerator('edit.paste') ?? undefined,
      role: 'paste'
    }, {
      type: 'separator'
    }, {
      label: 'Select All',
      accelerator: keybindings.getAccelerator('edit.select-all') ?? undefined,
      role: 'selectAll'
    }]
  }
}

export default prefEdit
