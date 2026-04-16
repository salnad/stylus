import fs from 'fs'
import path from 'path'
import { app, ipcMain, Menu, type BrowserWindow, type MenuItem, type Menu as ElectronMenu } from 'electron'
import log from 'electron-log'
import { ensureDirSync, isDirectory2, isFile2 } from 'common/filesystem'
import { isOsx, isWindows, isLinux } from '../config'
import { updateSidebarMenu } from '../menu/actions/edit'
import { updateFormatMenu } from '../menu/actions/format'
import { updateSelectionMenus } from '../menu/actions/paragraph'
import { viewLayoutChanged } from '../menu/actions/view'
import configureMenu, { configSettingMenu } from '../menu/templates'
import type Preference from '../preferences'
import type Keybindings from '../keyboard/shortcutHandler'

const RECENTLY_USED_DOCUMENTS_FILE_NAME = 'recently-used-documents.json'
const MAX_RECENTLY_USED_DOCUMENTS = 12

export const MenuType = {
  DEFAULT: 0,
  EDITOR: 1,
  SETTINGS: 2
} as const

type MenuTypeValue = typeof MenuType[keyof typeof MenuType]

interface WindowMenuState {
  menu: ElectronMenu | null
  type: MenuTypeValue
}

interface PreferenceLike {
  getAll(): {
    theme?: string
    autoSave?: boolean
  }
}

class AppMenu {
  private readonly _preferences: PreferenceLike
  private readonly _keybindings: Keybindings
  private readonly _userDataPath: string
  public readonly RECENTS_PATH: string
  public readonly isOsxOrWindows: boolean
  public activeWindowId: number
  public readonly windowMenus: Map<number, WindowMenuState>

  constructor (preferences: Preference, keybindings: Keybindings, userDataPath: string) {
    this._preferences = preferences
    this._keybindings = keybindings
    this._userDataPath = userDataPath
    this.RECENTS_PATH = path.join(userDataPath, RECENTLY_USED_DOCUMENTS_FILE_NAME)
    this.isOsxOrWindows = isOsx || isWindows
    this.activeWindowId = -1
    this.windowMenus = new Map()

    this._listenForIpcMain()
  }

  addRecentlyUsedDocument (filePath: string): void {
    const { isOsxOrWindows, RECENTS_PATH } = this

    if (isOsxOrWindows) app.addRecentDocument(filePath)
    if (isOsx) return

    const recentDocuments = this.getRecentlyUsedDocuments()
    const index = recentDocuments.indexOf(filePath)
    let needSave = index !== 0
    if (index > 0) {
      recentDocuments.splice(index, 1)
    }
    if (index !== 0) {
      recentDocuments.unshift(filePath)
    }

    if (recentDocuments.length > MAX_RECENTLY_USED_DOCUMENTS) {
      needSave = true
      recentDocuments.splice(MAX_RECENTLY_USED_DOCUMENTS, recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS)
    }

    this.updateAppMenu(recentDocuments)

    if (needSave) {
      ensureDirSync(this._userDataPath)
      fs.writeFileSync(RECENTS_PATH, JSON.stringify(recentDocuments, null, 2), 'utf-8')
    }
  }

  getRecentlyUsedDocuments (): string[] {
    const { RECENTS_PATH } = this
    if (!isFile2(RECENTS_PATH)) {
      return []
    }

    try {
      const recentDocuments = (JSON.parse(fs.readFileSync(RECENTS_PATH, 'utf-8')) as string[])
        .filter(filePath => filePath && (isFile2(filePath) || isDirectory2(filePath)))

      if (recentDocuments.length > MAX_RECENTLY_USED_DOCUMENTS) {
        recentDocuments.splice(MAX_RECENTLY_USED_DOCUMENTS, recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS)
      }
      return recentDocuments
    } catch (err) {
      log.error('Error while read recently used documents:', err)
      return []
    }
  }

  clearRecentlyUsedDocuments (): void {
    const { isOsxOrWindows, RECENTS_PATH } = this
    if (isOsxOrWindows) app.clearRecentDocuments()
    if (isOsx) return

    const recentDocuments: string[] = []
    this.updateAppMenu(recentDocuments)
    ensureDirSync(this._userDataPath)
    fs.writeFileSync(RECENTS_PATH, JSON.stringify(recentDocuments, null, 2), 'utf-8')
  }

  addDefaultMenu (windowId: number): void {
    this.windowMenus.set(windowId, this._buildSettingMenu())
  }

  addSettingMenu (window: BrowserWindow): void {
    this.windowMenus.set(window.id, this._buildSettingMenu())
  }

  addEditorMenu (window: BrowserWindow, options: { sourceCodeModeEnabled?: boolean } = {}): void {
    const isSourceMode = !!options.sourceCodeModeEnabled
    this.windowMenus.set(window.id, this._buildEditorMenu())

    const state = this.windowMenus.get(window.id)
    if (!state?.menu) {
      return
    }

    const sourceCodeModeMenuItem = state.menu.getMenuItemById('sourceCodeModeMenuItem')
    if (sourceCodeModeMenuItem) {
      sourceCodeModeMenuItem.checked = isSourceMode
    }

    if (isSourceMode) {
      const typewriterModeMenuItem = state.menu.getMenuItemById('typewriterModeMenuItem')
      const focusModeMenuItem = state.menu.getMenuItemById('focusModeMenuItem')
      if (typewriterModeMenuItem) {
        typewriterModeMenuItem.enabled = false
      }
      if (focusModeMenuItem) {
        focusModeMenuItem.enabled = false
      }
    }

    this._keybindings.registerEditorKeyHandlers(window)

    if (isWindows) {
      this._keybindings.registerAccelerator(window, 'Alt+F4', win => {
        if (win && !win.isDestroyed()) {
          win.close()
        }
      })
    }
  }

  removeWindowMenu (windowId: number): void {
    this.windowMenus.delete(windowId)
    if (this.activeWindowId === windowId) {
      this.activeWindowId = -1
    }
  }

  getWindowMenuById (windowId: number): ElectronMenu {
    const menu = this.windowMenus.get(windowId)
    if (!menu?.menu) {
      log.error(`getWindowMenuById: Cannot find window menu for window id ${windowId}.`)
      throw new Error(`Cannot find window menu for id ${windowId}.`)
    }
    return menu.menu
  }

  has (windowId: number): boolean {
    return this.windowMenus.has(windowId)
  }

  setActiveWindow (windowId: number): void {
    if (this.activeWindowId !== windowId) {
      this._setApplicationMenu(this.getWindowMenuById(windowId))
      this.activeWindowId = windowId
    }
  }

  updateAppMenu (recentUsedDocuments: string[] | null = null): void {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    this.windowMenus.forEach((value, key) => {
      const { menu: oldMenu, type } = value
      if (type !== MenuType.EDITOR || !oldMenu) {
        return
      }

      const { menu: newMenu } = this._buildEditorMenu(recentUsedDocuments ?? [])
      if (!newMenu) {
        return
      }

      updateMenuItem(oldMenu, newMenu, 'sourceCodeModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'typewriterModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'focusModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'sideBarMenuItem')
      updateMenuItem(oldMenu, newMenu, 'tabBarMenuItem')

      value.menu = newMenu
      if (this.activeWindowId === key) {
        this._setApplicationMenu(newMenu)
      }
    })
  }

  updateLineEndingMenu (windowId: number, lineEnding: string): void {
    const menus = this.getWindowMenuById(windowId)
    if (lineEnding === 'crlf') {
      const crlfMenu = menus.getMenuItemById('crlfLineEndingMenuEntry')
      if (crlfMenu) {
        crlfMenu.checked = true
      }
    } else {
      const lfMenu = menus.getMenuItemById('lfLineEndingMenuEntry')
      if (lfMenu) {
        lfMenu.checked = true
      }
    }
  }

  updateAlwaysOnTopMenu (windowId: number, flag: boolean): void {
    const menuItem = this.getWindowMenuById(windowId).getMenuItemById('alwaysOnTopMenuItem')
    if (menuItem) {
      menuItem.checked = flag
    }
  }

  updateThemeMenu = (theme: string): void => {
    this.windowMenus.forEach(value => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR || !menu) {
        return
      }

      const themeMenus = menu.getMenuItemById('themeMenu')
      if (!themeMenus?.submenu) {
        return
      }

      themeMenus.submenu.items.forEach(item => {
        item.checked = false
      })
      themeMenus.submenu.items.forEach(item => {
        if (item.id && item.id === theme) {
          item.checked = true
        }
      })
    })
  }

  updateAutoSaveMenu = (autoSave: boolean): void => {
    this.windowMenus.forEach(value => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR || !menu) {
        return
      }

      const autoSaveMenu = menu.getMenuItemById('autoSaveMenuItem')
      if (autoSaveMenu) {
        autoSaveMenu.checked = autoSave
      }
    })
  }

  private _buildEditorMenu (recentUsedDocuments: string[] | null = null): WindowMenuState {
    const normalizedRecentDocuments = recentUsedDocuments ?? this.getRecentlyUsedDocuments()
    const menuTemplate = configureMenu(
      this._keybindings,
      this._preferences as never,
      normalizedRecentDocuments
    ) as Electron.MenuItemConstructorOptions[]
    const menu = Menu.buildFromTemplate(menuTemplate)
    return { menu, type: MenuType.EDITOR }
  }

  private _buildSettingMenu (): WindowMenuState {
    if (isOsx) {
      const menuTemplate = configSettingMenu(this._keybindings) as Electron.MenuItemConstructorOptions[]
      return { menu: Menu.buildFromTemplate(menuTemplate), type: MenuType.SETTINGS }
    }
    return { menu: null, type: MenuType.SETTINGS }
  }

  private _setApplicationMenu (menu: ElectronMenu | null): void {
    if (isLinux && !menu) {
      Menu.setApplicationMenu(Menu.buildFromTemplate([]))
    } else {
      Menu.setApplicationMenu(menu)
    }
  }

  private _listenForIpcMain (): void {
    ipcMain.on('mt::add-recently-used-document', (_event, pathname: string) => {
      this.addRecentlyUsedDocument(pathname)
    })
    ipcMain.on('mt::update-line-ending-menu', (_event, windowId: number, lineEnding: string) => {
      this.updateLineEndingMenu(windowId, lineEnding)
    })
    ipcMain.on('mt::update-format-menu', (_event, windowId: number, formats: Record<string, boolean>) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateFormatMenu(this.getWindowMenuById(windowId) as never, formats)
    })
    ipcMain.on('mt::update-sidebar-menu', (_event, windowId: number, value: boolean) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateSidebarMenu(this.getWindowMenuById(windowId), value)
    })
    ipcMain.on('mt::view-layout-changed', (_event, windowId: number, viewSettings: Record<string, boolean>) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      viewLayoutChanged(this.getWindowMenuById(windowId), viewSettings)
    })
    ipcMain.on('mt::editor-selection-changed', (_event, windowId: number, changes: Record<string, unknown>) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateSelectionMenus(this.getWindowMenuById(windowId) as never, changes)
    })

    ipcMain.on('menu-add-recently-used', (_event, pathname: string) => {
      this.addRecentlyUsedDocument(pathname)
    })
    ipcMain.on('menu-clear-recently-used', () => {
      this.clearRecentlyUsedDocuments()
    })

    ipcMain.on('broadcast-preferences-changed', (_event, prefs: { theme?: string, autoSave?: boolean }) => {
      if (prefs.theme !== undefined) {
        this.updateThemeMenu(prefs.theme)
      }
      if (prefs.autoSave !== undefined) {
        this.updateAutoSaveMenu(prefs.autoSave)
      }
    })
  }
}

const updateMenuItem = (oldMenus: ElectronMenu, newMenus: ElectronMenu, id: string): void => {
  const oldItem = oldMenus.getMenuItemById(id)
  const newItem = newMenus.getMenuItemById(id)
  if (oldItem && newItem) {
    newItem.checked = oldItem.checked
  }
}

export const getMenuItemById = (menuId: string): MenuItem => {
  const menus = Menu.getApplicationMenu()
  if (!menus) {
    throw new Error('No application menu is available.')
  }
  const item = menus.getMenuItemById(menuId)
  if (!item) {
    throw new Error(`Cannot find application menu item with id "${menuId}".`)
  }
  return item
}

export default AppMenu
