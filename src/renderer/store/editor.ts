import { clipboard, ipcRenderer, shell, webFrame } from 'electron'
import path from 'path'
import equal from 'fast-deep-equal'
import { isSamePathSync } from 'common/filesystem/paths'
import type { MarkdownDocumentOptions, MarkdownDocumentRaw } from 'common/types/documents'
import bus from '../bus'
import { hasKeys, getUniqueId } from '../util'
import listToTree, { type TreeNode } from '../util/listToTree'
import {
  createDocumentState,
  getOptionsFromState,
  getSingleFileState,
  getBlankFileState,
  type DocumentState,
  type HistoryState,
  type SearchMatches,
  type WordCount
} from './help'
import notice from '../services/notification'
import {
  FileEncodingCommand,
  LineEndingCommand,
  QuickOpenCommand,
  TrailingNewlineCommand
} from '../commands'
import type { PreferencesState } from './preferences'
import type { TreeFolderEntry } from './treeCtrl'

const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

type TocFlatItem = {
  lvl: number
  content: string
  slug: string
}

interface EditorState {
  currentFile: Partial<DocumentState>
  tabs: DocumentState[]
  listToc: TocFlatItem[]
  toc: TreeNode[]
}

interface TabIdMovePayload {
  fromId: string
  toId: string | null
}

interface LoadChangePayload {
  pathname: string
  data: MarkdownDocumentRaw
}

interface PathnameFileInfo {
  filename: string
  pathname: string
  id: string
}

interface SetPathnamePayload {
  tab: DocumentState | undefined
  fileInfo: PathnameFileInfo
}

interface SetSaveStatusByTabPayload {
  tab: Partial<DocumentState>
  status: boolean
}

interface PushTabNotificationPayload {
  tabId: string
  msg: string
  action?: (status: boolean) => void
  showConfirm?: boolean
  style?: string
  exclusiveType?: string
}

interface AffiliationBlock {
  type: string
  functionType?: string
  children?: Array<{ isLooseListItem?: boolean }>
  listType?: string
  listItemType?: string
  isLooseListItem?: boolean
}

interface SelectionBlock {
  key: string
  functionType?: string
  text?: string
}

interface SelectionEndpoint {
  key: string
  type?: string
  block: SelectionBlock
  offset: number
}

interface SelectionChangePayload {
  start: SelectionEndpoint
  end: SelectionEndpoint
  affiliation: AffiliationBlock[]
}

interface EditorRootStateSlice {
  preferences: PreferencesState
  project: { projectTree: TreeFolderEntry | null }
  editor: EditorState
}

type CommitFn = (type: string, payload?: unknown) => void
type DispatchFn = (type: string, payload?: unknown) => void

/** Preserves legacy `console.err` call from the JS module (typo; may be undefined at runtime). */
const logConsoleErr = (message: string): void => {
  const errFn = (console as Console & { err?: (msg: string) => void }).err
  if (typeof errFn === 'function') {
    errFn.call(console, message)
  }
}

interface StoreActionContext {
  commit: CommitFn
  dispatch: DispatchFn
  state: EditorState
  rootState: EditorRootStateSlice
}

const state: EditorState = {
  currentFile: {},
  tabs: [],
  listToc: [],
  toc: []
}

const mutations = {
  SET_SEARCH (currentState: EditorState, value: SearchMatches): void {
    currentState.currentFile.searchMatches = value
  },
  SET_TOC (currentState: EditorState, toc: TocFlatItem[]): void {
    currentState.listToc = toc
    currentState.toc = listToTree(toc)
  },
  SET_CURRENT_FILE (currentState: EditorState, currentFile: DocumentState): void {
    const oldCurrentFile = currentState.currentFile
    if (!oldCurrentFile.id || oldCurrentFile.id !== currentFile.id) {
      const { id, markdown, cursor, history, pathname } = currentFile
      window.DIRNAME = pathname ? path.dirname(pathname) : ''
      currentState.currentFile = currentFile
      bus.$emit('file-changed', { id, markdown, cursor, renderCursor: true, history })
    }
  },
  ADD_FILE_TO_TABS (currentState: EditorState, currentFile: DocumentState): void {
    currentState.tabs.push(currentFile)
  },
  REMOVE_FILE_WITHIN_TABS (currentState: EditorState, file: DocumentState): void {
    const { tabs, currentFile } = currentState
    const index = tabs.indexOf(file)
    tabs.splice(index, 1)

    if (file.id && autoSaveTimers.has(file.id)) {
      const timer = autoSaveTimers.get(file.id)
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      autoSaveTimers.delete(file.id)
    }

    if (file.id === currentFile.id) {
      const fileState = tabs[index] || tabs[index - 1] || tabs[0] || {}
      currentState.currentFile = fileState
      if (typeof fileState.markdown === 'string') {
        const { id, markdown, cursor, history, pathname } = fileState as DocumentState
        window.DIRNAME = pathname ? path.dirname(pathname) : ''
        bus.$emit('file-changed', { id, markdown, cursor, renderCursor: true, history })
      }
    }

    if (currentState.tabs.length === 0) {
      currentState.listToc = []
      currentState.toc = []
    }
  },
  EXCHANGE_TABS_BY_ID (currentState: EditorState, tabIDs: TabIdMovePayload): void {
    const { fromId } = tabIDs
    const toId = tabIDs.toId

    const { tabs } = currentState
    const moveItem = (arr: DocumentState[], from: number, to: number): boolean => {
      if (from === to) return true
      const len = arr.length
      const item = arr.splice(from, 1)
      if (item.length === 0) return false

      arr.splice(to, 0, item[0])
      return arr.length === len
    }

    const fromIndex = tabs.findIndex(t => t.id === fromId)
    if (!toId) {
      moveItem(tabs, fromIndex, tabs.length - 1)
    } else {
      const toIndex = tabs.findIndex(t => t.id === toId)
      const realToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      moveItem(tabs, fromIndex, realToIndex)
    }
  },
  LOAD_CHANGE (currentState: EditorState, change: LoadChangePayload): void {
    const { tabs, currentFile } = currentState
    const { data, pathname } = change
    const {
      isMixedLineEndings,
      lineEnding,
      adjustLineEndingOnSave,
      trimTrailingNewline,
      encoding,
      markdown,
      filename
    } = data
    const options: MarkdownDocumentOptions = { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline }

    const newFileState = getSingleFileState({ markdown, filename, pathname, options })

    const tab = tabs.find(t => isSamePathSync(t.pathname, pathname))
    if (!tab) {
      console.error('LOAD_CHANGE: Cannot find tab in tab list.')
      notice.notify({
        title: 'Error loading tab',
        message: 'There was an error while loading the file change because the tab cannot be found.',
        type: 'error',
        time: 20000,
        showConfirm: false
      })
      return
    }

    const oldId = tab.id
    const oldNotifications = tab.notifications
    let oldHistory: HistoryState | null = null
    if (tab.history.index >= 0 && tab.history.stack.length >= 1) {
      oldHistory = {
        stack: [tab.history.stack[tab.history.index]],
        index: 0
      }

      tab.history.index--
      tab.history.stack.pop()
    }

    Object.assign(tab, newFileState)
    tab.id = oldId
    tab.notifications = oldNotifications
    if (oldHistory) {
      tab.history = oldHistory
    }

    if (isMixedLineEndings) {
      tab.notifications.push({
        msg: `"${filename}" has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`,
        showConfirm: false,
        style: 'info',
        exclusiveType: '',
        action: () => {}
      })
    }

    if (pathname === currentFile.pathname) {
      currentState.currentFile = tab
      const { id, cursor, history } = tab
      bus.$emit('file-changed', { id, markdown, cursor, renderCursor: true, history })
    }
  },
  SET_PATHNAME (currentState: EditorState, { tab, fileInfo }: SetPathnamePayload): void {
    const { currentFile } = currentState
    const { filename, pathname, id } = fileInfo

    if (id === currentFile.id && pathname) {
      window.DIRNAME = path.dirname(pathname)
    }

    if (tab) {
      Object.assign(tab, { filename, pathname, isSaved: true })
    }
  },
  SET_SAVE_STATUS_BY_TAB (currentState: EditorState, { tab, status }: SetSaveStatusByTabPayload): void {
    if (hasKeys(tab as Record<string, unknown>)) {
      tab.isSaved = status
    }
  },
  SET_SAVE_STATUS (currentState: EditorState, status: boolean): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.isSaved = status
    }
  },
  SET_SAVE_STATUS_WHEN_REMOVE (currentState: EditorState, { pathname }: { pathname: string }): void {
    currentState.tabs.forEach(f => {
      if (f.pathname === pathname) {
        f.isSaved = false
      }
    })
  },
  SET_MARKDOWN (currentState: EditorState, markdown: string): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.markdown = markdown
    }
  },
  SET_DOCUMENT_ENCODING (currentState: EditorState, encoding: DocumentState['encoding']): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.encoding = encoding
    }
  },
  SET_LINE_ENDING (currentState: EditorState, lineEnding: DocumentState['lineEnding']): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.lineEnding = lineEnding
    }
  },
  SET_FILE_ENCODING_BY_NAME (currentState: EditorState, encodingName: string): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      const encodingObj = currentState.currentFile.encoding
      if (encodingObj) {
        encodingObj.encoding = encodingName
        encodingObj.isBom = false
      }
    }
  },
  SET_FINAL_NEWLINE (currentState: EditorState, value: number): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>) && value >= 0 && value <= 3) {
      currentState.currentFile.trimTrailingNewline = value
    }
  },
  SET_ADJUST_LINE_ENDING_ON_SAVE (currentState: EditorState, adjustLineEndingOnSave: boolean): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.adjustLineEndingOnSave = adjustLineEndingOnSave
    }
  },
  SET_WORD_COUNT (currentState: EditorState, wordCount: WordCount): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.wordCount = wordCount
    }
  },
  SET_CURSOR (currentState: EditorState, cursor: unknown): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.cursor = cursor
    }
  },
  SET_HISTORY (currentState: EditorState, history: HistoryState): void {
    if (hasKeys(currentState.currentFile as Record<string, unknown>)) {
      currentState.currentFile.history = history
    }
  },
  CLOSE_TABS (currentState: EditorState, tabIdList: string[]): void {
    if (!tabIdList || tabIdList.length === 0) return

    let tabIndex = 0
    tabIdList.forEach(id => {
      const index = currentState.tabs.findIndex(f => f.id === id)
      const { pathname } = currentState.tabs[index]

      if (pathname) {
        ipcRenderer.send('mt::window-tab-closed', pathname)
      }

      currentState.tabs.splice(index, 1)
      if (currentState.currentFile.id === id) {
        currentState.currentFile = {}
        window.DIRNAME = ''
        if (tabIdList.length === 1) {
          tabIndex = index
        }
      }
    })

    if (!currentState.currentFile.id && currentState.tabs.length) {
      currentState.currentFile = currentState.tabs[tabIndex] || currentState.tabs[tabIndex - 1] || currentState.tabs[0] || {}
      if (typeof currentState.currentFile.markdown === 'string') {
        const { id, markdown, cursor, history, pathname } = currentState.currentFile as DocumentState
        window.DIRNAME = pathname ? path.dirname(pathname) : ''
        bus.$emit('file-changed', { id, markdown, cursor, renderCursor: true, history })
      }
    }

    if (currentState.tabs.length === 0) {
      currentState.listToc = []
      currentState.toc = []
    }
  },
  RENAME_IF_NEEDED (currentState: EditorState, { src, dest }: { src: string; dest: string }): void {
    const { tabs } = currentState
    tabs.forEach(f => {
      if (f.pathname === src) {
        f.pathname = dest
        f.filename = path.basename(dest)
      }
    })
  },

  PUSH_TAB_NOTIFICATION (currentState: EditorState, data: PushTabNotificationPayload): void {
    const defaultAction = (): void => {}
    const { tabId, msg } = data
    const action = data.action ?? defaultAction
    const showConfirm = data.showConfirm ?? false
    const style = data.style ?? 'info'
    const exclusiveType = data.exclusiveType ?? ''

    const { tabs } = currentState
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) {
      console.error('PUSH_TAB_NOTIFICATION: Cannot find tab in tab list.')
      return
    }

    const { notifications } = tab

    if (exclusiveType) {
      const nIndex = notifications.findIndex(n => n.exclusiveType === exclusiveType)
      if (nIndex >= 0) {
        notifications.splice(nIndex, 1)
      }
    }

    notifications.push({
      msg,
      showConfirm,
      style,
      exclusiveType,
      action
    })
  }
}

const actions = {
  FORMAT_LINK_CLICK (_ctx: StoreActionContext, { data, dirname }: { data: unknown; dirname: string }): void {
    ipcRenderer.send('mt::format-link-click', { data, dirname })
  },

  LISTEN_SCREEN_SHOT (_ctx: StoreActionContext): void {
    ipcRenderer.on('mt::screenshot-captured', () => {
      bus.$emit('screenshot-captured')
    })
  },

  ASK_FOR_IMAGE_AUTO_PATH ({ state }: StoreActionContext, src: string): Promise<string[]> | string[] {
    const { pathname } = state.currentFile
    if (pathname) {
      let rs: ((files: string[]) => void) | undefined
      const promise = new Promise<string[]>((resolve) => {
        rs = resolve
      })
      const id = getUniqueId()
      ipcRenderer.once(`mt::response-of-image-path-${id}`, (_e, files: string[]) => {
        if (rs) rs(files)
      })
      ipcRenderer.send('mt::ask-for-image-auto-path', { pathname, src, id })
      return promise
    } else {
      return []
    }
  },

  SEARCH ({ commit }: Pick<StoreActionContext, 'commit'>, value: SearchMatches): void {
    commit('SET_SEARCH', value)
  },

  SHOW_IMAGE_DELETION_URL (_ctx: Pick<StoreActionContext, 'commit'>, deletionUrl: string): void {
    notice.notify({
      title: 'Image deletion URL',
      message: `Click to copy the deletion URL of the uploaded image to the clipboard (${deletionUrl}).`,
      showConfirm: true,
      time: 20000
    })
      .then(() => {
        clipboard.writeText(deletionUrl)
      })
  },

  FORCE_CLOSE_TAB ({ commit }: Pick<StoreActionContext, 'commit'>, file: DocumentState): void {
    commit('REMOVE_FILE_WITHIN_TABS', file)
    const { pathname } = file

    if (pathname) {
      ipcRenderer.send('mt::window-tab-closed', pathname)
    }
  },

  EXCHANGE_TABS_BY_ID ({ commit }: Pick<StoreActionContext, 'commit'>, tabIDs: TabIdMovePayload): void {
    commit('EXCHANGE_TABS_BY_ID', tabIDs)
  },

  UPDATE_LINE_ENDING_MENU ({ state }: Pick<StoreActionContext, 'state'>): void {
    const { lineEnding } = state.currentFile
    if (lineEnding) {
      const { windowId } = global.marktext.env
      ipcRenderer.send('mt::update-line-ending-menu', windowId, lineEnding)
    }
  },

  CLOSE_UNSAVED_TAB (_ctx: StoreActionContext, file: DocumentState): void {
    const { id, pathname, filename, markdown } = file
    const options = getOptionsFromState(file)

    ipcRenderer.send('mt::save-and-close-tabs', [{ id, pathname, filename, markdown, options }])
  },

  LISTEN_FOR_SAVE ({ state, rootState }: Pick<StoreActionContext, 'state' | 'rootState'>): void {
    ipcRenderer.on('mt::editor-ask-file-save', () => {
      const { id, filename, pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state.currentFile as DocumentState)
      const defaultPath = getRootFolderFromState(rootState)
      if (id) {
        ipcRenderer.send('mt::response-file-save', {
          id,
          filename,
          pathname,
          markdown,
          options,
          defaultPath
        })
      }
    })
  },

  LISTEN_FOR_SAVE_AS ({ state, rootState }: Pick<StoreActionContext, 'state' | 'rootState'>): void {
    ipcRenderer.on('mt::editor-ask-file-save-as', () => {
      const { id, filename, pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state.currentFile as DocumentState)
      const defaultPath = getRootFolderFromState(rootState)
      if (id) {
        ipcRenderer.send('mt::response-file-save-as', {
          id,
          filename,
          pathname,
          markdown,
          options,
          defaultPath
        })
      }
    })
  },

  LISTEN_FOR_SET_PATHNAME ({ commit, dispatch, state }: Pick<StoreActionContext, 'commit' | 'dispatch' | 'state'>): void {
    ipcRenderer.on('mt::set-pathname', (_e, fileInfo: PathnameFileInfo) => {
      const { tabs } = state
      const { pathname, id } = fileInfo
      const tab = tabs.find(f => f.id === id)
      if (!tab) {
        logConsoleErr('[ERROR] Cannot change file path from unknown tab.')
        return
      }

      const existingTab = tabs.find(t => t.id !== id && isSamePathSync(t.pathname, pathname))
      if (existingTab) {
        dispatch('CLOSE_TAB', existingTab)
      }
      commit('SET_PATHNAME', { tab, fileInfo })
    })

    ipcRenderer.on('mt::tab-saved', (_e, tabId: string) => {
      const { tabs } = state
      const tab = tabs.find(f => f.id === tabId)
      if (tab) {
        Object.assign(tab, { isSaved: true })
      }
    })

    ipcRenderer.on('mt::tab-save-failure', (_e, tabId: string, msg: string) => {
      const { tabs } = state
      const tab = tabs.find(t => t.id === tabId)
      if (!tab) {
        notice.notify({
          title: 'Save failure',
          message: msg,
          type: 'error',
          time: 20000,
          showConfirm: false
        })
        return
      }

      commit('SET_SAVE_STATUS_BY_TAB', { tab, status: false })
      commit('PUSH_TAB_NOTIFICATION', {
        tabId,
        msg: `There was an error while saving: ${msg}`,
        style: 'crit'
      })
    })
  },

  LISTEN_FOR_CLOSE ({ state }: Pick<StoreActionContext, 'state'>): void {
    ipcRenderer.on('mt::ask-for-close', () => {
      const unsavedFiles = state.tabs
        .filter(file => !file.isSaved)
        .map(file => {
          const { id, filename, pathname, markdown } = file
          const options = getOptionsFromState(file)
          return { id, filename, pathname, markdown, options }
        })

      if (unsavedFiles.length) {
        ipcRenderer.send('mt::close-window-confirm', unsavedFiles)
      } else {
        ipcRenderer.send('mt::close-window')
      }
    })
  },

  LISTEN_FOR_SAVE_CLOSE ({ commit }: Pick<StoreActionContext, 'commit'>): void {
    ipcRenderer.on('mt::force-close-tabs-by-id', (_e, tabIdList: string[]) => {
      if (Array.isArray(tabIdList) && tabIdList.length) {
        commit('CLOSE_TABS', tabIdList)
      }
    })
  },

  ASK_FOR_SAVE_ALL ({ commit, state }: Pick<StoreActionContext, 'commit' | 'state'>, closeTabs: boolean): void {
    const { tabs } = state
    const unsavedFiles = tabs
      .filter(file => !(file.isSaved && /[^\n]/.test(file.markdown)))
      .map(file => {
        const { id, filename, pathname, markdown } = file
        const options = getOptionsFromState(file)
        return { id, filename, pathname, markdown, options }
      })

    if (closeTabs) {
      if (unsavedFiles.length) {
        commit('CLOSE_TABS', tabs.filter(f => f.isSaved).map(f => f.id))
        ipcRenderer.send('mt::save-and-close-tabs', unsavedFiles)
      } else {
        commit('CLOSE_TABS', tabs.map(f => f.id))
      }
    } else {
      ipcRenderer.send('mt::save-tabs', unsavedFiles)
    }
  },

  LISTEN_FOR_MOVE_TO ({ state, rootState }: Pick<StoreActionContext, 'state' | 'rootState'>): void {
    ipcRenderer.on('mt::editor-move-file', () => {
      const { id, filename, pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state.currentFile as DocumentState)
      const defaultPath = getRootFolderFromState(rootState)
      if (!id) return
      if (!pathname) {
        ipcRenderer.send('mt::response-file-save', {
          id,
          filename,
          pathname,
          markdown,
          options,
          defaultPath
        })
      } else {
        ipcRenderer.send('mt::response-file-move-to', { id, pathname })
      }
    })
  },

  LISTEN_FOR_RENAME ({ dispatch }: Pick<StoreActionContext, 'dispatch'>): void {
    ipcRenderer.on('mt::editor-rename-file', () => {
      dispatch('RESPONSE_FOR_RENAME')
    })
  },

  RESPONSE_FOR_RENAME ({ state, rootState }: Pick<StoreActionContext, 'state' | 'rootState'>): void {
    const { id, filename, pathname, markdown } = state.currentFile
    const options = getOptionsFromState(state.currentFile as DocumentState)
    const defaultPath = getRootFolderFromState(rootState)
    if (!id) return
    if (!pathname) {
      ipcRenderer.send('mt::response-file-save', {
        id,
        filename,
        pathname,
        markdown,
        options,
        defaultPath
      })
    } else {
      bus.$emit('rename')
    }
  },

  RENAME ({ commit: _commit, state }: Pick<StoreActionContext, 'commit' | 'state'>, newFilename: string): void {
    const { id, pathname, filename } = state.currentFile
    if (typeof filename === 'string' && filename !== newFilename && pathname) {
      const newPathname = path.join(path.dirname(pathname), newFilename)
      ipcRenderer.send('mt::rename', { id, pathname, newPathname })
    }
  },

  UPDATE_CURRENT_FILE ({ commit, state, dispatch }: Pick<StoreActionContext, 'commit' | 'state' | 'dispatch'>, currentFile: DocumentState): void {
    commit('SET_CURRENT_FILE', currentFile)
    const { tabs } = state
    if (!tabs.some(file => file.id === currentFile.id)) {
      commit('ADD_FILE_TO_TABS', currentFile)
    }
    dispatch('UPDATE_LINE_ENDING_MENU')
  },

  LISTEN_FOR_BOOTSTRAP_WINDOW ({ commit, state: _state, dispatch, rootState }: StoreActionContext): void {
    setTimeout(() => {
      bus.$emit('cmd::register-command', new FileEncodingCommand(rootState.editor))
      bus.$emit('cmd::register-command', new QuickOpenCommand(rootState))
      bus.$emit('cmd::register-command', new LineEndingCommand(rootState.editor))
      bus.$emit('cmd::register-command', new TrailingNewlineCommand(rootState.editor))

      setTimeout(() => {
        ipcRenderer.send('mt::request-keybindings')
        bus.$emit('cmd::sort-commands')
      }, 100)
    }, 400)

    ipcRenderer.on('mt::bootstrap-editor', (_e, config: {
      addBlankTab: boolean
      markdownList: string[]
      lineEnding: string
      sideBarVisibility: boolean
      tabBarVisibility: boolean
      sourceCodeModeEnabled: boolean
    }) => {
      const {
        addBlankTab,
        markdownList,
        lineEnding,
        sideBarVisibility,
        tabBarVisibility,
        sourceCodeModeEnabled
      } = config

      dispatch('SEND_INITIALIZED')
      commit('SET_USER_PREFERENCE', { endOfLine: lineEnding })
      commit('SET_LAYOUT', {
        rightColumn: 'files',
        showSideBar: !!sideBarVisibility,
        showTabBar: !!tabBarVisibility
      })
      dispatch('DISPATCH_LAYOUT_MENU_ITEMS')

      commit('SET_MODE', {
        type: 'sourceCode',
        checked: !!sourceCodeModeEnabled
      })

      if (addBlankTab) {
        dispatch('NEW_UNTITLED_TAB', {})
      } else if (markdownList.length) {
        let isFirst = true
        for (const markdown of markdownList) {
          isFirst = false
          dispatch('NEW_UNTITLED_TAB', { markdown, selected: isFirst })
        }
      }
    })
  },

  LISTEN_FOR_NEW_TAB ({ dispatch }: Pick<StoreActionContext, 'dispatch'>): void {
    ipcRenderer.on('mt::open-new-tab', (_e, markdownDocument: MarkdownDocumentRaw | null, options: Partial<MarkdownDocumentRaw> = {}, selected = true) => {
      if (markdownDocument) {
        dispatch('NEW_TAB_WITH_CONTENT', { markdownDocument, options, selected })
      } else {
        dispatch('NEW_UNTITLED_TAB', {})
      }
    })

    ipcRenderer.on('mt::new-untitled-tab', (_e, selected = true, markdown = '') => {
      dispatch('NEW_UNTITLED_TAB', { markdown, selected })
    })
  },

  LISTEN_FOR_CLOSE_TAB ({ state, dispatch }: Pick<StoreActionContext, 'state' | 'dispatch'>): void {
    ipcRenderer.on('mt::editor-close-tab', () => {
      const file = state.currentFile
      if (!hasKeys(file as Record<string, unknown>)) return
      dispatch('CLOSE_TAB', file as DocumentState)
    })
  },

  LISTEN_FOR_TAB_CYCLE ({ dispatch }: Pick<StoreActionContext, 'dispatch'>): void {
    ipcRenderer.on('mt::tabs-cycle-left', () => {
      dispatch('CYCLE_TABS', false)
    })
    ipcRenderer.on('mt::tabs-cycle-right', () => {
      dispatch('CYCLE_TABS', true)
    })
  },

  LISTEN_FOR_SWITCH_TABS ({ dispatch }: Pick<StoreActionContext, 'dispatch'>): void {
    ipcRenderer.on('mt::switch-tab-by-index', (_event, index: number) => {
      dispatch('SWITCH_TAB_BY_INDEX', index)
    })
  },

  CLOSE_TAB ({ dispatch }: Pick<StoreActionContext, 'dispatch'>, file: DocumentState): void {
    const { isSaved } = file
    if (isSaved) {
      dispatch('FORCE_CLOSE_TAB', file)
    } else {
      dispatch('CLOSE_UNSAVED_TAB', file)
    }
  },

  CLOSE_OTHER_TABS ({ state, dispatch }: Pick<StoreActionContext, 'state' | 'dispatch'>, file: DocumentState): void {
    const { tabs } = state
    tabs.filter(f => f.id !== file.id).forEach(tab => {
      dispatch('CLOSE_TAB', tab)
    })
  },

  CLOSE_SAVED_TABS ({ state, dispatch }: Pick<StoreActionContext, 'state' | 'dispatch'>): void {
    const { tabs } = state
    tabs.filter(f => f.isSaved).forEach(tab => {
      dispatch('CLOSE_TAB', tab)
    })
  },

  CLOSE_ALL_TABS ({ state, dispatch }: Pick<StoreActionContext, 'state' | 'dispatch'>): void {
    const { tabs } = state
    tabs.slice().forEach(tab => {
      dispatch('CLOSE_TAB', tab)
    })
  },

  RENAME_FILE ({ commit, dispatch }: Pick<StoreActionContext, 'commit' | 'dispatch'>, file: DocumentState): void {
    commit('SET_CURRENT_FILE', file)
    dispatch('UPDATE_LINE_ENDING_MENU')
    bus.$emit('rename')
  },

  CYCLE_TABS ({ commit, dispatch, state }: Pick<StoreActionContext, 'commit' | 'dispatch' | 'state'>, direction: boolean): void {
    const { tabs, currentFile } = state
    if (tabs.length <= 1) {
      return
    }

    const currentIndex = tabs.findIndex(t => t.id === currentFile.id)
    if (currentIndex === -1) {
      console.error('CYCLE_TABS: Cannot find current tab index.')
      return
    }

    let nextTabIndex = 0
    if (!direction) {
      nextTabIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
    } else {
      nextTabIndex = (currentIndex + 1) % tabs.length
    }

    const nextTab = tabs[nextTabIndex]
    if (!nextTab || !nextTab.id) {
      console.error(`CYCLE_TABS: Cannot find next tab (index="${nextTabIndex}").`)
      return
    }

    commit('SET_CURRENT_FILE', nextTab)
    dispatch('UPDATE_LINE_ENDING_MENU')
  },

  SWITCH_TAB_BY_INDEX ({ commit, dispatch, state }: Pick<StoreActionContext, 'commit' | 'dispatch' | 'state'>, nextTabIndex: number): void {
    const { tabs, currentFile } = state
    if (nextTabIndex < 0 || nextTabIndex >= tabs.length) {
      console.warn('Invalid tab index:', nextTabIndex)
      return
    }

    const currentIndex = tabs.findIndex(t => t.id === currentFile.id)
    if (currentIndex === -1) {
      console.error('Cannot find current tab index.')
      return
    }

    const nextTab = tabs[nextTabIndex]
    if (!nextTab || !nextTab.id) {
      console.error(`Cannot find tab by index="${nextTabIndex}".`)
      return
    }

    commit('SET_CURRENT_FILE', nextTab)
    dispatch('UPDATE_LINE_ENDING_MENU')
  },

  NEW_UNTITLED_TAB ({ commit, state, dispatch, rootState }: StoreActionContext, payload: { markdown?: string; selected?: boolean }): void {
    let { markdown: markdownString, selected } = payload
    if (selected == null) {
      selected = true
    }

    dispatch('SHOW_TAB_VIEW', false)

    const { defaultEncoding, endOfLine } = rootState.preferences
    const { tabs } = state
    const fileState = getBlankFileState(tabs, defaultEncoding, endOfLine as 'lf' | 'crlf', markdownString)

    if (selected) {
      const { id, markdown } = fileState
      dispatch('UPDATE_CURRENT_FILE', fileState)
      bus.$emit('file-loaded', { id, markdown })
    } else {
      commit('ADD_FILE_TO_TABS', fileState)
    }
  },

  NEW_TAB_WITH_CONTENT ({ commit, state, dispatch }: Pick<StoreActionContext, 'commit' | 'state' | 'dispatch'>, payload: {
    markdownDocument: MarkdownDocumentRaw
    options?: Partial<MarkdownDocumentRaw>
    selected?: boolean
  }): void {
    const { markdownDocument, options = {}, selected } = payload
    if (!markdownDocument) {
      console.warn('Cannot create a file tab without a markdown document!')
      dispatch('NEW_UNTITLED_TAB', {})
      return
    }

    let selectedFlag = selected
    if (typeof selectedFlag === 'undefined') {
      selectedFlag = true
    }
    const { currentFile, tabs } = state
    const { pathname } = markdownDocument
    const existingTab = tabs.find(t => isSamePathSync(t.pathname, pathname))
    if (existingTab) {
      dispatch('UPDATE_CURRENT_FILE', existingTab)
      return
    }

    let keepTabBarState = false
    if (currentFile) {
      const { isSaved, pathname: curPath } = currentFile
      if (isSaved && !curPath) {
        keepTabBarState = true
        dispatch('FORCE_CLOSE_TAB', currentFile as DocumentState)
      }
    }

    if (!keepTabBarState) {
      dispatch('SHOW_TAB_VIEW', false)
    }

    const { markdown, isMixedLineEndings } = markdownDocument
    const docState = createDocumentState(Object.assign(markdownDocument, options))
    const { id, cursor } = docState

    if (selectedFlag) {
      dispatch('UPDATE_CURRENT_FILE', docState)
      bus.$emit('file-loaded', { id, markdown, cursor })
    } else {
      commit('ADD_FILE_TO_TABS', docState)
    }

    if (isMixedLineEndings) {
      const { filename, lineEnding } = markdownDocument
      commit('PUSH_TAB_NOTIFICATION', {
        tabId: id,
        msg: `${filename}" has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`
      })
    }
  },

  SHOW_TAB_VIEW ({ commit, state, dispatch }: Pick<StoreActionContext, 'commit' | 'state' | 'dispatch'>, always: boolean): void {
    const { tabs } = state
    if (always || tabs.length === 1) {
      commit('SET_LAYOUT', { showTabBar: true })
      dispatch('DISPATCH_LAYOUT_MENU_ITEMS')
    }
  },

  LISTEN_FOR_CONTENT_CHANGE ({ commit, dispatch, state, rootState }: StoreActionContext, payload: {
    id: string
    markdown: string
    wordCount?: WordCount
    cursor?: unknown
    history?: HistoryState
    toc?: TocFlatItem[]
  }): void {
    let { id, markdown, wordCount, cursor, history, toc } = payload
    const { autoSave } = rootState.preferences
    const {
      id: currentId,
      filename,
      pathname,
      markdown: oldMarkdown,
      trimTrailingNewline
    } = state.currentFile as DocumentState
    const { listToc } = state

    if (!id) {
      throw new Error('Listen for document change but id was not set!')
    } else if (!currentId || state.tabs.length === 0) {
      return
    } else if (id !== 'muya' && currentId !== id) {
      for (const tab of state.tabs) {
        if (tab.id && tab.id === id) {
          tab.markdown = adjustTrailingNewlines(markdown, tab.trimTrailingNewline)
          if (cursor) {
            tab.cursor = cursor
          }
          if (history) {
            tab.history = history
          }
          break
        }
      }
      return
    }

    markdown = adjustTrailingNewlines(markdown, trimTrailingNewline)
    commit('SET_MARKDOWN', markdown)

    if (oldMarkdown.length === 0 && markdown.length === 1 && markdown[0] === '\n') {
      return
    }

    if (wordCount) {
      commit('SET_WORD_COUNT', wordCount)
    }
    if (cursor) {
      commit('SET_CURSOR', cursor)
    }
    if (history) {
      commit('SET_HISTORY', history)
    }
    if (toc && !equal(toc, listToc)) {
      commit('SET_TOC', toc)
    }

    if (markdown !== oldMarkdown) {
      commit('SET_SAVE_STATUS', false)

      if (pathname && autoSave) {
        const options = getOptionsFromState(state.currentFile as DocumentState)
        dispatch('HANDLE_AUTO_SAVE', {
          id: currentId,
          filename,
          pathname,
          markdown,
          options
        })
      }
    }
  },

  HANDLE_AUTO_SAVE ({ commit: _commit, state, rootState }: Pick<StoreActionContext, 'commit' | 'state' | 'rootState'>, payload: {
    id: string
    filename: string
    pathname: string
    markdown: string
    options: MarkdownDocumentOptions
  }): void {
    const { id, filename, pathname, markdown, options } = payload
    if (!id || !pathname) {
      throw new Error('HANDLE_AUTO_SAVE: Invalid tab.')
    }

    const { tabs } = state
    const { autoSaveDelay } = rootState.preferences

    if (autoSaveTimers.has(id)) {
      const timer = autoSaveTimers.get(id)
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      autoSaveTimers.delete(id)
    }

    const timer = setTimeout(() => {
      autoSaveTimers.delete(id)

      const tab = tabs.find(t => t.id === id)
      if (tab && !tab.isSaved) {
        const defaultPath = getRootFolderFromState(rootState)

        ipcRenderer.send('mt::response-file-save', {
          id,
          filename,
          pathname,
          markdown,
          options,
          defaultPath
        })
      }
    }, autoSaveDelay)
    autoSaveTimers.set(id, timer)
  },

  SELECTION_CHANGE ({ commit }: Pick<StoreActionContext, 'commit'>, changes: SelectionChangePayload): void {
    const { start, end } = changes
    if (start.key === end.key && start.block.text) {
      const value = start.block.text.substring(start.offset, end.offset)
      commit('SET_SEARCH', {
        matches: [],
        index: -1,
        value
      })
    }

    const { windowId } = global.marktext.env
    ipcRenderer.send('mt::editor-selection-changed', windowId, createApplicationMenuState(changes))
  },

  SELECTION_FORMATS (_ctx: Pick<StoreActionContext, 'commit'>, formats: Array<{ type: string }>): void {
    const { windowId } = global.marktext.env
    ipcRenderer.send('mt::update-format-menu', windowId, createSelectionFormatState(formats))
  },

  EXPORT ({ state }: Pick<StoreActionContext, 'state'>, payload: { type: string; content: string; pageOptions: unknown }): void {
    if (!hasKeys(state.currentFile as Record<string, unknown>)) return

    let title = ''
    const { listToc } = state
    if (listToc && listToc.length > 0) {
      let headerRef = listToc[0]

      const len = Math.min(listToc.length, 6)
      for (let i = 1; i < len; ++i) {
        if (headerRef.lvl === 1) {
          break
        }

        const header = listToc[i]
        if (headerRef.lvl > header.lvl) {
          headerRef = header
        }
      }
      title = headerRef.content
    }

    const { filename, pathname } = state.currentFile as DocumentState
    const { type, content, pageOptions } = payload
    ipcRenderer.send('mt::response-export', {
      type,
      title,
      content,
      filename,
      pathname,
      pageOptions
    })
  },

  LINTEN_FOR_EXPORT_SUCCESS ({ commit: _commit }: Pick<StoreActionContext, 'commit'>): void {
    ipcRenderer.on('mt::export-success', (_e, payload: { type: string; filePath: string }) => {
      const { filePath } = payload
      notice.notify({
        title: 'Exported successfully',
        message: `Exported "${path.basename(filePath)}" successfully!`,
        showConfirm: true
      })
        .then(() => {
          shell.showItemInFolder(filePath)
        })
    })
  },

  PRINT_RESPONSE (_ctx: Pick<StoreActionContext, 'commit'>): void {
    ipcRenderer.send('mt::response-print')
  },

  LINTEN_FOR_PRINT_SERVICE_CLEARUP ({ commit: _commit }: Pick<StoreActionContext, 'commit'>): void {
    ipcRenderer.on('mt::print-service-clearup', () => {
      bus.$emit('print-service-clearup')
    })
  },

  LINTEN_FOR_SET_LINE_ENDING ({ commit, dispatch, state }: Pick<StoreActionContext, 'commit' | 'dispatch' | 'state'>): void {
    ipcRenderer.on('mt::set-line-ending', (e, lineEnding: DocumentState['lineEnding']) => {
      const { lineEnding: oldLineEnding } = state.currentFile
      if (lineEnding !== oldLineEnding) {
        commit('SET_LINE_ENDING', lineEnding)
        commit('SET_ADJUST_LINE_ENDING_ON_SAVE', lineEnding !== 'lf')
        commit('SET_SAVE_STATUS', true)

        if (!e) {
          dispatch('UPDATE_LINE_ENDING_MENU')
        }
      }
    })
  },

  LINTEN_FOR_SET_ENCODING ({ commit, state }: Pick<StoreActionContext, 'commit' | 'state'>): void {
    ipcRenderer.on('mt::set-file-encoding', (_e, encodingName: string) => {
      const enc = state.currentFile.encoding
      if (enc && enc.encoding !== encodingName) {
        commit('SET_FILE_ENCODING_BY_NAME', encodingName)
        commit('SET_SAVE_STATUS', true)
      }
    })
  },

  LINTEN_FOR_SET_FINAL_NEWLINE ({ commit, state }: Pick<StoreActionContext, 'commit' | 'state'>): void {
    ipcRenderer.on('mt::set-final-newline', (_e, value: number) => {
      const { trimTrailingNewline } = state.currentFile
      if (trimTrailingNewline !== value) {
        commit('SET_FINAL_NEWLINE', value)
        commit('SET_SAVE_STATUS', true)
      }
    })
  },

  LISTEN_FOR_FILE_CHANGE ({ commit, state, rootState }: Pick<StoreActionContext, 'commit' | 'state' | 'rootState'>): void {
    ipcRenderer.on('mt::update-file', (_e, payload: { type: string; change: LoadChangePayload }) => {
      const { type, change } = payload

      const { tabs } = state
      const { pathname } = change
      const tab = tabs.find(t => isSamePathSync(t.pathname, pathname))
      if (tab) {
        const { id, isSaved, filename } = tab
        switch (type) {
          case 'unlink': {
            commit('SET_SAVE_STATUS_BY_TAB', { tab, status: false })
            commit('PUSH_TAB_NOTIFICATION', {
              tabId: id,
              msg: `"${filename}" has been removed on disk.`,
              style: 'warn',
              showConfirm: false,
              exclusiveType: 'file_changed'
            })
            break
          }
          case 'add':
          case 'change': {
            const { autoSave } = rootState.preferences
            if (autoSave) {
              if (autoSaveTimers.has(id)) {
                const timer = autoSaveTimers.get(id)
                if (timer !== undefined) {
                  clearTimeout(timer)
                }
                autoSaveTimers.delete(id)
              }

              if (isSaved) {
                commit('LOAD_CHANGE', change)
                return
              }
            }

            commit('SET_SAVE_STATUS_BY_TAB', { tab, status: false })
            commit('PUSH_TAB_NOTIFICATION', {
              tabId: id,
              msg: `"${filename}" has been changed on disk. Do you want to reload it?`,
              showConfirm: true,
              exclusiveType: 'file_changed',
              action: (status: boolean) => {
                if (status) {
                  commit('LOAD_CHANGE', change)
                }
              }
            })
            break
          }
          default:
            console.error(`LISTEN_FOR_FILE_CHANGE: Invalid type "${type}"`)
        }
      } else {
        console.error(`LISTEN_FOR_FILE_CHANGE: Cannot find tab for path "${pathname}".`)
      }
    })
  },

  ASK_FOR_IMAGE_PATH (_ctx: Pick<StoreActionContext, 'commit'>): string {
    return ipcRenderer.sendSync('mt::ask-for-image-path') as string
  },

  LISTEN_WINDOW_ZOOM ({ dispatch, rootState }: Pick<StoreActionContext, 'dispatch' | 'rootState'>): void {
    ipcRenderer.on('mt::window-zoom', (_e, zoomFactor: number) => {
      const rounded = Number.parseFloat(zoomFactor.toFixed(3))
      const { zoom } = rootState.preferences
      if (zoom !== rounded) {
        dispatch('SET_SINGLE_PREFERENCE', { type: 'zoom', value: rounded })
      }
      webFrame.setZoomFactor(rounded)
    })
  },

  LISTEN_FOR_RELOAD_IMAGES (): void {
    ipcRenderer.on('mt::invalidate-image-cache', () => {
      bus.$emit('invalidate-image-cache')
    })
  },

  LISTEN_FOR_CONTEXT_MENU (): void {
    ipcRenderer.on('mt::cm-copy-as-markdown', () => {
      bus.$emit('copyAsMarkdown', 'copyAsMarkdown')
    })
    ipcRenderer.on('mt::cm-copy-as-html', () => {
      bus.$emit('copyAsHtml', 'copyAsHtml')
    })
    ipcRenderer.on('mt::cm-paste-as-plain-text', () => {
      bus.$emit('pasteAsPlainText', 'pasteAsPlainText')
    })
    ipcRenderer.on('mt::cm-insert-paragraph', (_e, location: unknown) => {
      bus.$emit('insertParagraph', location)
    })

    ipcRenderer.on('mt::spelling-replace-misspelling', (_e, info: unknown) => {
      bus.$emit('replace-misspelling', info)
    })
    ipcRenderer.on('mt::spelling-show-switch-language', () => {
      bus.$emit('open-command-spellchecker-switch-language')
    })
  }
}

const getRootFolderFromState = (rootState: EditorRootStateSlice): string => {
  const openedFolder = rootState.project.projectTree
  if (openedFolder) {
    return openedFolder.pathname
  }
  return ''
}

const adjustTrailingNewlines = (markdown: string, trimTrailingNewlineOption: number | undefined): string => {
  if (!markdown) {
    return ''
  }

  switch (trimTrailingNewlineOption) {
    case 0: {
      return trimTrailingNewlines(markdown)
    }
    case 1: {
      const lastIndex = markdown.length - 1
      if (markdown[lastIndex] === '\n') {
        if (markdown.length === 1) {
          return ''
        } else if (markdown[lastIndex - 1] !== '\n') {
          return markdown
        }
      }

      const adjusted = trimTrailingNewlines(markdown)
      if (adjusted.length === 0) {
        return ''
      }
      return adjusted + '\n'
    }
    default:
      return markdown
  }
}

const trimTrailingNewlines = (text: string): string => {
  return text.replace(/[\r?\n]+$/, '')
}

interface ApplicationMenuState {
  isDisabled: boolean
  isMultiline: boolean
  isLooseListItem: boolean
  isTaskList: boolean
  isCodeFences: boolean
  isCodeContent: boolean
  isTable: boolean
  affiliation: Record<string, boolean>
}

const createApplicationMenuState = ({ start, end, affiliation }: SelectionChangePayload): ApplicationMenuState => {
  const menuState: ApplicationMenuState = {
    isDisabled: false,
    isMultiline: start.key !== end.key,
    isLooseListItem: false,
    isTaskList: false,
    isCodeFences: false,
    isCodeContent: false,
    isTable: false,
    affiliation: {}
  }
  const { isMultiline } = menuState

  if (
    (start.block.functionType === 'cellContent' && end.block.functionType === 'cellContent') ||
    (start.type === 'span' && start.block.functionType === 'codeContent') ||
    (end.type === 'span' && end.block.functionType === 'codeContent')
  ) {
    menuState.isCodeFences = true

    if (start.block.functionType === 'codeContent' || end.block.functionType === 'codeContent') {
      menuState.isCodeContent = true
    }
  }

  if (affiliation.length >= 1 && /ul|ol/.test(affiliation[0].type)) {
    const listBlock = affiliation[0]
    menuState.affiliation[listBlock.type] = true
    const firstChild = listBlock.children?.[0]
    menuState.isLooseListItem = !!firstChild?.isLooseListItem
    menuState.isTaskList = listBlock.listType === 'task'
  } else if (affiliation.length >= 3 && affiliation[1].type === 'li') {
    const listItem = affiliation[1]
    const listType = listItem.listItemType === 'order' ? 'ol' : 'ul'
    menuState.affiliation[listType] = true
    menuState.isLooseListItem = !!listItem.isLooseListItem
    menuState.isTaskList = listItem.listItemType === 'task'
  }

  for (const b of affiliation.slice(0, 3)) {
    if (b.type === 'pre' && b.functionType) {
      if (/frontmatter|html|multiplemath|code$/.test(b.functionType)) {
        menuState.isCodeFences = true
        menuState.affiliation[b.functionType] = true
      }
      break
    } else if (b.type === 'figure' && b.functionType) {
      if (b.functionType === 'table') {
        menuState.isTable = true
        menuState.isDisabled = true
      }
      break
    } else if (isMultiline && /^h{1,6}$/.test(b.type)) {
      menuState.affiliation = {}
      break
    } else {
      if (!menuState.affiliation[b.type]) {
        menuState.affiliation[b.type] = true
      }
    }
  }

  if (Object.getOwnPropertyNames(menuState.affiliation).length >= 2 && menuState.affiliation.p) {
    delete menuState.affiliation.p
  }
  if ((menuState.affiliation.ul || menuState.affiliation.ol) && menuState.affiliation.li) {
    delete menuState.affiliation.li
  }
  return menuState
}

const createSelectionFormatState = (formats: Array<{ type: string }>): Record<string, boolean> => {
  const formatState: Record<string, boolean> = {}
  for (const item of formats) {
    formatState[item.type] = true
  }
  return formatState
}

export default { state, mutations, actions }
