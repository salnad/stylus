import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { minimizeWindow, toggleAlwaysOnTop, toggleFullScreen } from '../actions/window'
import { zoomIn, zoomOut } from '../../windows/utils'
import { isOsx } from '../../config'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

const window = (keybindings: KeybindingsLike): MenuItemConstructorOptions => {
  const submenu: MenuItemConstructorOptions[] = [{
    label: 'Minimize',
    accelerator: keybindings.getAccelerator('window.minimize') ?? undefined,
    click (_menuItem, browserWindow) {
      minimizeWindow(browserWindow)
    }
  }, {
    id: 'alwaysOnTopMenuItem',
    label: 'Always on Top',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('window.toggle-always-on-top') ?? undefined,
    click (_menuItem, browserWindow) {
      toggleAlwaysOnTop(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Zoom In',
    accelerator: keybindings.getAccelerator('window.zoom-in') ?? undefined,
    click (_menuItem, browserWindow) {
      if (browserWindow) {
        zoomIn(browserWindow as BrowserWindow)
      }
    }
  }, {
    label: 'Zoom Out',
    accelerator: keybindings.getAccelerator('window.zoom-out') ?? undefined,
    click (_menuItem, browserWindow) {
      if (browserWindow) {
        zoomOut(browserWindow as BrowserWindow)
      }
    }
  }, {
    type: 'separator'
  }, {
    label: 'Show in Full Screen',
    accelerator: keybindings.getAccelerator('window.toggle-full-screen') ?? undefined,
    click (_menuItem, browserWindow) {
      if (browserWindow) {
        toggleFullScreen(browserWindow)
      }
    }
  }]

  if (isOsx) {
    submenu.push({
      label: 'Bring All to Front',
      click () {
        Menu.sendActionToFirstResponder('arrangeInFront:')
      }
    })
  }

  return {
    label: '&Window',
    role: 'window',
    submenu
  }
}

export default window
