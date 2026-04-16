import { getCurrentWindow, Menu as RemoteMenu, MenuItem as RemoteMenuItem } from '@electron/remote'
import type { MenuItemConstructorOptions } from 'electron'
import {
  SEPARATOR,
  NEW_FILE,
  NEW_DIRECTORY,
  COPY,
  CUT,
  PASTE,
  RENAME,
  DELETE,
  SHOW_IN_FOLDER
} from './menuItems'

type SideBarEventLike = {
  clientX: number
  clientY: number
}

export const showContextMenu = (event: SideBarEventLike, hasPathCache: boolean): void => {
  const menu = new RemoteMenu()
  const win = getCurrentWindow()
  const contextItems = [
    NEW_FILE,
    NEW_DIRECTORY,
    SEPARATOR,
    COPY,
    CUT,
    PASTE,
    SEPARATOR,
    RENAME,
    DELETE,
    SEPARATOR,
    SHOW_IN_FOLDER
  ]

  PASTE.enabled = hasPathCache

  contextItems.forEach(item => {
    menu.append(new RemoteMenuItem(item as unknown as MenuItemConstructorOptions))
  })
  menu.popup({ window: win, x: event.clientX, y: event.clientY })
}
