import { app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { isOsx } from '../../config'
import * as actions from '../actions/file'
import { userSetting } from '../actions/marktext'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

interface UserPreferenceLike {
  getAll(): {
    autoSave?: boolean
  }
}

type MaybeWindow = BrowserWindow | undefined

const createMenuHandler = (callback: (browserWindow: MaybeWindow) => void) => {
  return (_menuItem: Electron.MenuItem, browserWindow: MaybeWindow): void => {
    callback(browserWindow)
  }
}

const createRecentItem = (label: string): MenuItemConstructorOptions => ({
  label,
  click (_menuItem, browserWindow) {
    actions.openFileOrFolder(browserWindow, label)
  }
})

export default function fileTemplate (
  keybindings: KeybindingsLike,
  userPreference: UserPreferenceLike,
  recentlyUsedFiles: string[]
): MenuItemConstructorOptions {
  const { autoSave = false } = userPreference.getAll()
  const fileMenu: MenuItemConstructorOptions = {
    label: '&File',
    submenu: [{
      label: 'New Tab',
      accelerator: keybindings.getAccelerator('file.new-tab') ?? undefined,
      click: createMenuHandler(actions.newBlankTab)
    }, {
      label: 'New Window',
      accelerator: keybindings.getAccelerator('file.new-window') ?? undefined,
      click: createMenuHandler(() => actions.newEditorWindow())
    }, {
      type: 'separator'
    }, {
      label: 'Open File...',
      accelerator: keybindings.getAccelerator('file.open-file') ?? undefined,
      click: createMenuHandler(actions.openFile)
    }, {
      label: 'Open Folder...',
      accelerator: keybindings.getAccelerator('file.open-folder') ?? undefined,
      click: createMenuHandler(actions.openFolder)
    }]
  }

  const submenu = fileMenu.submenu as MenuItemConstructorOptions[]

  if (!isOsx) {
    const recentlyUsedMenu: MenuItemConstructorOptions = {
      label: 'Open Recent',
      submenu: recentlyUsedFiles.map(item => createRecentItem(item))
    }

    const recentSubmenu = recentlyUsedMenu.submenu as MenuItemConstructorOptions[]
    recentSubmenu.push({
      type: 'separator',
      visible: recentlyUsedFiles.length > 0
    }, {
      label: 'Clear Recently Used',
      enabled: recentlyUsedFiles.length > 0,
      click: createMenuHandler(() => actions.clearRecentlyUsed())
    })

    submenu.push(recentlyUsedMenu)
  } else {
    submenu.push({
      role: 'recentDocuments',
      submenu: [{
        role: 'clearRecentDocuments'
      }]
    })
  }

  submenu.push({
    type: 'separator'
  }, {
    label: 'Save',
    accelerator: keybindings.getAccelerator('file.save') ?? undefined,
    click: createMenuHandler(actions.save)
  }, {
    label: 'Save As...',
    accelerator: keybindings.getAccelerator('file.save-as') ?? undefined,
    click: createMenuHandler(actions.saveAs)
  }, {
    label: 'Auto Save',
    type: 'checkbox',
    checked: autoSave,
    id: 'autoSaveMenuItem',
    click (menuItem, browserWindow) {
      actions.autoSave(menuItem, browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Move To...',
    accelerator: keybindings.getAccelerator('file.move-file') ?? undefined,
    click: createMenuHandler(actions.moveTo)
  }, {
    label: 'Rename...',
    accelerator: keybindings.getAccelerator('file.rename-file') ?? undefined,
    click: createMenuHandler(actions.rename)
  }, {
    type: 'separator'
  }, {
    label: 'Import...',
    click: createMenuHandler(actions.importFile)
  }, {
    label: 'Export',
    submenu: [{
      label: 'HTML',
      click: createMenuHandler(browserWindow => actions.exportFile(browserWindow, 'styledHtml'))
    }, {
      label: 'PDF',
      click: createMenuHandler(browserWindow => actions.exportFile(browserWindow, 'pdf'))
    }]
  }, {
    label: 'Print',
    accelerator: keybindings.getAccelerator('file.print') ?? undefined,
    click: createMenuHandler(actions.printDocument)
  }, {
    type: 'separator',
    visible: !isOsx
  }, {
    label: 'Preferences...',
    accelerator: keybindings.getAccelerator('file.preferences') ?? undefined,
    visible: !isOsx,
    click () {
      userSetting()
    }
  }, {
    type: 'separator'
  }, {
    label: 'Close Tab',
    accelerator: keybindings.getAccelerator('file.close-tab') ?? undefined,
    click: createMenuHandler(actions.closeTab)
  }, {
    label: 'Close Window',
    accelerator: keybindings.getAccelerator('file.close-window') ?? undefined,
    click: createMenuHandler(actions.closeWindow)
  }, {
    type: 'separator',
    visible: !isOsx
  }, {
    label: 'Quit',
    accelerator: keybindings.getAccelerator('file.quit') ?? undefined,
    visible: !isOsx,
    click: app.quit
  })

  return fileMenu
}
