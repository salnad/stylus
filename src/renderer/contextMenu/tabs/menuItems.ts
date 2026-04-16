import type { MenuItem, MenuItemConstructorOptions } from 'electron'
import * as contextMenu from './actions'

export interface TabMenuItemWithTabId extends MenuItem {
  _tabId?: string
}

type MutableMenuItemConstructorOptions = MenuItemConstructorOptions & {
  enabled?: boolean
}

export const SEPARATOR: MutableMenuItemConstructorOptions = {
  type: 'separator'
}

export const CLOSE_THIS: MutableMenuItemConstructorOptions = {
  label: 'Close',
  id: 'closeThisTab',
  click (menuItem) {
    const tabMenuItem = menuItem as TabMenuItemWithTabId
    if (tabMenuItem._tabId) {
      contextMenu.closeThis(tabMenuItem._tabId)
    }
  }
}

export const CLOSE_OTHERS: MutableMenuItemConstructorOptions = {
  label: 'Close others',
  id: 'closeOtherTabs',
  click (menuItem) {
    const tabMenuItem = menuItem as TabMenuItemWithTabId
    if (tabMenuItem._tabId) {
      contextMenu.closeOthers(tabMenuItem._tabId)
    }
  }
}

export const CLOSE_SAVED: MutableMenuItemConstructorOptions = {
  label: 'Close saved tabs',
  id: 'closeSavedTabs',
  click () {
    contextMenu.closeSaved()
  }
}

export const CLOSE_ALL: MutableMenuItemConstructorOptions = {
  label: 'Close all tabs',
  id: 'closeAllTabs',
  click () {
    contextMenu.closeAll()
  }
}

export const RENAME: MutableMenuItemConstructorOptions = {
  label: 'Rename',
  id: 'renameFile',
  click (menuItem) {
    const tabMenuItem = menuItem as TabMenuItemWithTabId
    if (tabMenuItem._tabId) {
      contextMenu.rename(tabMenuItem._tabId)
    }
  }
}

export const COPY_PATH: MutableMenuItemConstructorOptions = {
  label: 'Copy path',
  id: 'copyPath',
  click (menuItem) {
    const tabMenuItem = menuItem as TabMenuItemWithTabId
    if (tabMenuItem._tabId) {
      contextMenu.copyPath(tabMenuItem._tabId)
    }
  }
}

export const SHOW_IN_FOLDER: MutableMenuItemConstructorOptions = {
  label: 'Show in folder',
  id: 'showInFolder',
  click (menuItem) {
    const tabMenuItem = menuItem as TabMenuItemWithTabId
    if (tabMenuItem._tabId) {
      contextMenu.showInFolder(tabMenuItem._tabId)
    }
  }
}
