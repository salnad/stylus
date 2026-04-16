import path from 'path'
import { ipcRenderer, shell } from 'electron'
import {
  addFile,
  unlinkFile,
  addDirectory,
  unlinkDirectory,
  type TreeFileEntry,
  type TreeFolderEntry
} from './treeCtrl'
import bus from '../bus'
import { create, paste, rename } from '../util/fileSystem'
import { getUniqueId } from '../util'
import { PATH_SEPARATOR } from '../config'
import notice from '../services/notification'
import { getFileStateFromData } from './help'
import { hasMarkdownExtension } from '../../common/filesystem/paths'

interface ProjectState {
  activeItem: Partial<TreeFileEntry>
  createCache: { dirname?: string, type?: 'file' | 'directory' }
  newFileNameCache: string
  renameCache: string | null
  clipboard: { type?: 'copy' | 'cut', src?: string, dest?: string } | null
  projectTree: TreeFolderEntry | null
}

type CommitFn = (type: string, payload?: unknown) => void
type DispatchFn = (type: string, payload?: unknown) => void

interface ProjectChange {
  pathname: string
  data?: Record<string, unknown>
  isMarkdown?: boolean
}

const state: ProjectState = {
  activeItem: {},
  createCache: {},
  newFileNameCache: '',
  renameCache: null,
  clipboard: null,
  projectTree: null
}

const getters = {}

const mutations = {
  SET_ROOT_DIRECTORY (currentState: ProjectState, pathname: string): void {
    let name = path.basename(pathname)
    if (!name) {
      name = pathname
    }

    currentState.projectTree = {
      id: getUniqueId(),
      pathname: path.normalize(pathname),
      name,
      isDirectory: true,
      isFile: false,
      isMarkdown: false,
      folders: [],
      files: [],
      isCollapsed: false
    }
  },
  SET_NEWFILENAME (currentState: ProjectState, name: string): void {
    currentState.newFileNameCache = name
  },
  ADD_FILE (currentState: ProjectState, change: TreeFileEntry): void {
    if (currentState.projectTree) {
      addFile(currentState.projectTree, change)
    }
  },
  UNLINK_FILE (currentState: ProjectState, change: { pathname: string }): void {
    if (currentState.projectTree) {
      unlinkFile(currentState.projectTree, change)
    }
  },
  ADD_DIRECTORY (currentState: ProjectState, change: TreeFolderEntry): void {
    if (currentState.projectTree) {
      addDirectory(currentState.projectTree, change)
    }
  },
  UNLINK_DIRECTORY (currentState: ProjectState, change: { pathname: string }): void {
    if (currentState.projectTree) {
      unlinkDirectory(currentState.projectTree, change)
    }
  },
  SET_ACTIVE_ITEM (currentState: ProjectState, activeItem: Partial<TreeFileEntry>): void {
    currentState.activeItem = activeItem
  },
  SET_CLIPBOARD (currentState: ProjectState, data: ProjectState['clipboard']): void {
    currentState.clipboard = data
  },
  CREATE_PATH (currentState: ProjectState, cache: ProjectState['createCache']): void {
    currentState.createCache = cache
  },
  SET_RENAME_CACHE (currentState: ProjectState, cache: string | null): void {
    currentState.renameCache = cache
  }
}

const actions = {
  LISTEN_FOR_LOAD_PROJECT ({ commit, dispatch }: { commit: CommitFn, dispatch: DispatchFn }): void {
    ipcRenderer.on('mt::open-directory', (_event, pathname: string) => {
      commit('SET_ROOT_DIRECTORY', pathname)
      commit('SET_LAYOUT', {
        rightColumn: 'files',
        showSideBar: true,
        showTabBar: true
      })
      dispatch('DISPATCH_LAYOUT_MENU_ITEMS')
    })
  },
  LISTEN_FOR_UPDATE_PROJECT ({ commit, state: currentState, dispatch }: { commit: CommitFn, state: ProjectState, dispatch: DispatchFn }): void {
    ipcRenderer.on('mt::update-object-tree', (_event, { type, change }: { type: string, change: ProjectChange & Record<string, unknown> }) => {
      switch (type) {
        case 'add': {
          const { pathname, data, isMarkdown } = change
          commit('ADD_FILE', change)
          if (isMarkdown && currentState.newFileNameCache && pathname === currentState.newFileNameCache && data) {
            const fileState = getFileStateFromData(data as never)
            dispatch('UPDATE_CURRENT_FILE', fileState)
            commit('SET_NEWFILENAME', '')
          }
          break
        }
        case 'unlink':
          commit('UNLINK_FILE', change)
          commit('SET_SAVE_STATUS_WHEN_REMOVE', change)
          break
        case 'addDir':
          commit('ADD_DIRECTORY', change)
          break
        case 'unlinkDir':
          commit('UNLINK_DIRECTORY', change)
          break
        case 'change':
          break
        default:
          if (process.env.NODE_ENV === 'development') {
            console.log(`Unknown directory watch type: "${type}"`)
          }
          break
      }
    })
  },
  CHANGE_ACTIVE_ITEM ({ commit }: { commit: CommitFn }, activeItem: Partial<TreeFileEntry>): void {
    commit('SET_ACTIVE_ITEM', activeItem)
  },
  CHANGE_CLIPBOARD ({ commit }: { commit: CommitFn }, data: ProjectState['clipboard']): void {
    commit('SET_CLIPBOARD', data)
  },
  ASK_FOR_OPEN_PROJECT (): void {
    ipcRenderer.send('mt::ask-for-open-project-in-sidebar')
  },
  LISTEN_FOR_SIDEBAR_CONTEXT_MENU ({ commit, state: currentState }: { commit: CommitFn, state: ProjectState }): void {
    bus.$on('SIDEBAR::show-in-folder', () => {
      const { pathname } = currentState.activeItem
      if (pathname) {
        shell.showItemInFolder(pathname)
      }
    })
    bus.$on('SIDEBAR::new', (type: 'file' | 'directory') => {
      const { pathname, isDirectory } = currentState.activeItem
      if (!pathname) {
        return
      }
      const dirname = isDirectory ? pathname : path.dirname(pathname)
      commit('CREATE_PATH', { dirname, type })
      bus.$emit('SIDEBAR::show-new-input')
    })
    bus.$on('SIDEBAR::remove', () => {
      const { pathname } = currentState.activeItem
      if (!pathname) {
        return
      }
      ipcRenderer.invoke('mt::fs-trash-item', pathname).catch((err: Error) => {
        notice.notify({
          title: 'Error while deleting',
          type: 'error',
          message: err.message
        })
      })
    })
    bus.$on('SIDEBAR::copy-cut', (type: 'copy' | 'cut') => {
      const { pathname: src } = currentState.activeItem
      commit('SET_CLIPBOARD', { type, src })
    })
    bus.$on('SIDEBAR::paste', () => {
      const { clipboard } = currentState
      const { pathname, isDirectory } = currentState.activeItem
      if (!pathname || !clipboard || !clipboard.src) {
        return
      }
      const dirname = isDirectory ? pathname : path.dirname(pathname)
      clipboard.dest = dirname + PATH_SEPARATOR + path.basename(clipboard.src)

      if (path.normalize(clipboard.src) === path.normalize(clipboard.dest)) {
        notice.notify({
          title: 'Paste Forbidden',
          type: 'warning',
          message: 'Source and destination must not be the same.'
        })
        return
      }

      paste(clipboard as { src: string, dest: string, type: 'copy' | 'cut' })
        .then(() => {
          commit('SET_CLIPBOARD', null)
        })
        .catch((err: Error) => {
          notice.notify({
            title: 'Error while pasting',
            type: 'error',
            message: err.message
          })
        })
    })
    bus.$on('SIDEBAR::rename', () => {
      const { pathname } = currentState.activeItem
      if (!pathname) {
        return
      }
      commit('SET_RENAME_CACHE', pathname)
      bus.$emit('SIDEBAR::show-rename-input')
    })
  },

  CREATE_FILE_DIRECTORY ({ commit, state: currentState }: { commit: CommitFn, state: ProjectState }, name: string): void {
    const { dirname, type } = currentState.createCache
    if (!dirname || !type) {
      return
    }

    let resolvedName = name
    if (type === 'file' && !hasMarkdownExtension(resolvedName)) {
      resolvedName += '.md'
    }

    const fullName = `${dirname}/${resolvedName}`

    create(fullName, type)
      .then(() => {
        commit('CREATE_PATH', {})
        if (type === 'file') {
          commit('SET_NEWFILENAME', fullName)
        }
      })
      .catch((err: Error) => {
        notice.notify({
          title: 'Error in Side Bar',
          type: 'error',
          message: err.message
        })
      })
  },

  RENAME_IN_SIDEBAR ({ commit, state: currentState }: { commit: CommitFn, state: ProjectState }, name: string): void {
    const src = currentState.renameCache
    if (!src) {
      return
    }
    const dirname = path.dirname(src)
    const dest = dirname + PATH_SEPARATOR + name
    rename(src, dest)
      .then(() => {
        commit('RENAME_IF_NEEDED', { src, dest })
      })
  },

  OPEN_SETTING_WINDOW (): void {
    ipcRenderer.send('mt::open-setting-window')
  }
}

export default { state, getters, mutations, actions }
