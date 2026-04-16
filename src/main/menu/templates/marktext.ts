import { app, type MenuItemConstructorOptions } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

const marktext = (keybindings: KeybindingsLike): MenuItemConstructorOptions => {
  const submenu: MenuItemConstructorOptions[] = [{
    label: 'About MarkText',
    click (_menuItem, focusedWindow) {
      if (focusedWindow) {
        showAboutDialog(focusedWindow)
      }
    }
  }, {
    label: 'Check for updates...',
    click (_menuItem, focusedWindow) {
      if (focusedWindow) {
        actions.checkUpdates(focusedWindow)
      }
    }
  }, {
    label: 'Preferences',
    accelerator: keybindings.getAccelerator('file.preferences') ?? undefined,
    click () {
      actions.userSetting()
    }
  }, {
    type: 'separator'
  }, {
    label: 'Services',
    role: 'services',
    submenu: []
  }, {
    type: 'separator'
  }, {
    label: 'Hide MarkText',
    accelerator: keybindings.getAccelerator('mt.hide') ?? undefined,
    click () {
      actions.osxHide()
    }
  }, {
    label: 'Hide Others',
    accelerator: keybindings.getAccelerator('mt.hide-others') ?? undefined,
    click () {
      actions.osxHideAll()
    }
  }, {
    label: 'Show All',
    click () {
      actions.osxShowAll()
    }
  }, {
    type: 'separator'
  }, {
    label: 'Quit MarkText',
    accelerator: keybindings.getAccelerator('file.quit') ?? undefined,
    click: app.quit
  }]

  return {
    label: 'MarkText',
    submenu
  }
}

export default marktext
