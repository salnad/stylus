import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/view'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

const withWindowAction = (
  handler: (focusedWindow?: BrowserWindow | null) => void
): NonNullable<MenuItemConstructorOptions['click']> => {
  return (_menuItem, focusedWindow) => {
    handler(focusedWindow)
  }
}

const view = (keybindings: KeybindingsLike): MenuItemConstructorOptions => {
  const submenu: MenuItemConstructorOptions[] = [{
    label: 'Command Palette...',
    accelerator: keybindings.getAccelerator('view.command-palette') ?? undefined,
    click: withWindowAction(actions.showCommandPalette)
  }, {
    type: 'separator'
  }, {
    id: 'sourceCodeModeMenuItem',
    label: 'Source Code Mode',
    accelerator: keybindings.getAccelerator('view.source-code-mode') ?? undefined,
    type: 'checkbox',
    checked: false,
    click: withWindowAction(actions.toggleSourceCodeMode)
  }, {
    id: 'typewriterModeMenuItem',
    label: 'Typewriter Mode',
    accelerator: keybindings.getAccelerator('view.typewriter-mode') ?? undefined,
    type: 'checkbox',
    checked: false,
    click: withWindowAction(actions.toggleTypewriterMode)
  }, {
    id: 'focusModeMenuItem',
    label: 'Focus Mode',
    accelerator: keybindings.getAccelerator('view.focus-mode') ?? undefined,
    type: 'checkbox',
    checked: false,
    click: withWindowAction(actions.toggleFocusMode)
  }, {
    type: 'separator'
  }, {
    label: 'Show Sidebar',
    id: 'sideBarMenuItem',
    accelerator: keybindings.getAccelerator('view.toggle-sidebar') ?? undefined,
    type: 'checkbox',
    checked: false,
    click: withWindowAction(actions.toggleSidebar)
  }, {
    label: 'Show Tab Bar',
    id: 'tabBarMenuItem',
    accelerator: keybindings.getAccelerator('view.toggle-tabbar') ?? undefined,
    type: 'checkbox',
    checked: false,
    click: withWindowAction(actions.toggleTabBar)
  }, {
    label: 'Toggle Table of Contents',
    id: 'tocMenuItem',
    accelerator: keybindings.getAccelerator('view.toggle-toc') ?? undefined,
    click: withWindowAction(actions.showTableOfContents)
  }, {
    label: 'Reload Images',
    accelerator: keybindings.getAccelerator('view.reload-images') ?? undefined,
    click: withWindowAction(actions.reloadImageCache)
  }]

  if (global.MARKTEXT_DEBUG) {
    submenu.push({
      type: 'separator'
    }, {
      label: 'Show Developer Tools',
      accelerator: keybindings.getAccelerator('view.toggle-dev-tools') ?? undefined,
      click: withWindowAction(actions.debugToggleDevTools)
    }, {
      label: 'Reload window',
      accelerator: keybindings.getAccelerator('view.dev-reload') ?? undefined,
      click: withWindowAction(actions.debugReloadWindow)
    })
  }

  return {
    label: '&View',
    submenu
  }
}

export default view
