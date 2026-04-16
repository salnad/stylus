import path from 'path'
import { getUniqueId } from '../util'
import { PATH_SEPARATOR } from '../config'

export interface TreeFileEntry {
  id: string
  pathname: string
  name: string
  isDirectory: boolean
  isFile: boolean
  isMarkdown: boolean
  birthTime?: Date
}

export interface TreeFolderEntry extends TreeFileEntry {
  isCollapsed: boolean
  folders: TreeFolderEntry[]
  files: TreeFileEntry[]
}

export interface TreeRoot extends TreeFolderEntry {}

export interface TreeChangeFile {
  pathname: string
  name: string
  isDirectory: boolean
  isFile: boolean
  isMarkdown: boolean
  birthTime?: Date
}

export interface TreeChangeDirectory {
  pathname: string
  name: string
  isCollapsed?: boolean
  isDirectory: boolean
  isFile: boolean
  isMarkdown: boolean
  folders?: TreeFolderEntry[]
  files?: TreeFileEntry[]
}

const getSubdirectoriesFromRoot = (rootPath: string, pathname: string): string[] => {
  if (!path.isAbsolute(pathname)) {
    throw new Error('Invalid path!')
  }
  const relativePath = path.relative(rootPath, pathname)
  return relativePath ? relativePath.split(PATH_SEPARATOR) : []
}

export const addFile = (tree: TreeRoot, file: TreeChangeFile): void => {
  const { pathname, name } = file
  const dirname = path.dirname(pathname)
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dirname)

  let currentPath = tree.pathname
  let currentFolder = tree
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    let childFolder = currentSubFolders.find(folder => folder.name === directoryName)
    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${currentPath}${PATH_SEPARATOR}${directoryName}`,
        name: directoryName,
        isCollapsed: true,
        isDirectory: true,
        isFile: false,
        isMarkdown: false,
        folders: [],
        files: []
      }
      currentSubFolders.push(childFolder)
    }

    currentPath = `${currentPath}${PATH_SEPARATOR}${directoryName}`
    currentFolder = childFolder
    currentSubFolders = childFolder.folders
  }

  if (!currentFolder.files.find(entry => entry.name === name)) {
    const fileCopy: TreeFileEntry = {
      id: getUniqueId(),
      birthTime: file.birthTime,
      isDirectory: file.isDirectory,
      isFile: file.isFile,
      isMarkdown: file.isMarkdown,
      name: file.name,
      pathname: file.pathname
    }

    const index = currentFolder.files.findIndex(entry => entry.name.localeCompare(name) > 0)
    if (index !== -1) {
      currentFolder.files.splice(index, 0, fileCopy)
    } else {
      currentFolder.files.push(fileCopy)
    }
  }
}

export const addDirectory = (tree: TreeRoot, dir: TreeChangeDirectory): void => {
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dir.pathname)

  let currentPath = tree.pathname
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    let childFolder = currentSubFolders.find(folder => folder.name === directoryName)
    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${currentPath}${PATH_SEPARATOR}${directoryName}`,
        name: directoryName,
        isCollapsed: true,
        isDirectory: true,
        isFile: false,
        isMarkdown: false,
        folders: [],
        files: []
      }
      currentSubFolders.push(childFolder)
    }

    currentPath = `${currentPath}${PATH_SEPARATOR}${directoryName}`
    currentSubFolders = childFolder.folders
  }
}

export const unlinkFile = (tree: TreeRoot, file: { pathname: string }): void => {
  const { pathname } = file
  const dirname = path.dirname(pathname)
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dirname)

  let currentFolder = tree
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentSubFolders.find(folder => folder.name === directoryName)
    if (!childFolder) return
    currentFolder = childFolder
    currentSubFolders = childFolder.folders
  }

  const index = currentFolder.files.findIndex(entry => entry.pathname === pathname)
  if (index !== -1) {
    currentFolder.files.splice(index, 1)
  }
}

export const unlinkDirectory = (tree: TreeRoot, dir: { pathname: string }): void => {
  const { pathname } = dir
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, pathname)

  subDirectories.pop()
  let currentFolder = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentFolder.find(folder => folder.name === directoryName)
    if (!childFolder) return
    currentFolder = childFolder.folders
  }

  const index = currentFolder.findIndex(folder => folder.pathname === pathname)
  if (index !== -1) {
    currentFolder.splice(index, 1)
  }
}
