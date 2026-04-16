import * as contextMenu from './actions'

export type SidebarMenuItem = {
  label?: string
  id?: string
  type?: 'separator'
  enabled?: boolean
  click?: () => void
}

export const SEPARATOR: SidebarMenuItem = {
  type: 'separator'
}

export const NEW_FILE: SidebarMenuItem = {
  label: 'New File',
  id: 'newFileMenuItem',
  click () {
    contextMenu.newFile()
  }
}

export const NEW_DIRECTORY: SidebarMenuItem = {
  label: 'New Directory',
  id: 'newDirectoryMenuItem',
  click () {
    contextMenu.newDirectory()
  }
}

export const COPY: SidebarMenuItem = {
  label: 'Copy',
  id: 'copyMenuItem',
  click () {
    contextMenu.copy()
  }
}

export const CUT: SidebarMenuItem = {
  label: 'Cut',
  id: 'cutMenuItem',
  click () {
    contextMenu.cut()
  }
}

export const PASTE: SidebarMenuItem = {
  label: 'Paste',
  id: 'pasteMenuItem',
  click () {
    contextMenu.paste()
  }
}

export const RENAME: SidebarMenuItem = {
  label: 'Rename',
  id: 'renameMenuItem',
  click () {
    contextMenu.rename()
  }
}

export const DELETE: SidebarMenuItem = {
  label: 'Move To Trash',
  id: 'deleteMenuItem',
  click () {
    contextMenu.remove()
  }
}

export const SHOW_IN_FOLDER: SidebarMenuItem = {
  label: 'Show In Folder',
  id: 'showInFolderMenuItem',
  click () {
    contextMenu.showInFolder()
  }
}
