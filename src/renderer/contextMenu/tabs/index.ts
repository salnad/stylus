import { getCurrentWindow, Menu as RemoteMenu, MenuItem as RemoteMenuItem } from '@electron/remote'
import type { MenuItemConstructorOptions } from 'electron'
import {
  CLOSE_THIS,
  CLOSE_OTHERS,
  CLOSE_SAVED,
  CLOSE_ALL,
  SEPARATOR,
  RENAME,
  COPY_PATH,
  SHOW_IN_FOLDER,
  type TabMenuItemWithTabId
} from './menuItems'

interface ContextMenuEventLike {
  clientX: number
  clientY: number
}

interface TabLike {
  id: string
  pathname?: string
}

const CONTEXT_ITEMS: MenuItemConstructorOptions[] = [
  CLOSE_THIS,
  CLOSE_OTHERS,
  CLOSE_SAVED,
  CLOSE_ALL,
  SEPARATOR,
  RENAME,
  COPY_PATH,
  SHOW_IN_FOLDER
]

const FILE_CONTEXT_ITEMS = [RENAME, COPY_PATH, SHOW_IN_FOLDER]

export const showContextMenu = (event: ContextMenuEventLike, tab: TabLike): void => {
  const menu = new RemoteMenu()
  const win = getCurrentWindow()
  const { pathname } = tab

  FILE_CONTEXT_ITEMS.forEach(item => {
    item.enabled = !!pathname
  })

  CONTEXT_ITEMS.forEach(item => {
    const menuItem = new RemoteMenuItem(item) as TabMenuItemWithTabId
    menuItem._tabId = tab.id
    menu.append(menuItem)
  })
  menu.popup({ window: win, x: event.clientX, y: event.clientY })
}
