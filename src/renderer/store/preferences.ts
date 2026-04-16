import { ipcRenderer } from 'electron'
import bus from '../bus'

export interface PreferencesState {
  autoSave: boolean
  autoSaveDelay: number
  titleBarStyle: string
  openFilesInNewWindow: boolean
  openFolderInNewWindow: boolean
  zoom: number
  hideScrollbar: boolean
  wordWrapInToc: boolean
  fileSortBy: string
  startUpAction: string
  defaultDirectoryToOpen: string
  language: string
  editorFontFamily: string
  fontSize: number
  lineHeight: number
  codeFontSize: number
  codeFontFamily: string
  codeBlockLineNumbers: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  editorLineWidth: string
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  endOfLine: string
  defaultEncoding: string
  autoGuessEncoding: boolean
  trimTrailingNewline: number
  textDirection: string
  hideQuickInsertHint: boolean
  imageInsertAction: string
  imagePreferRelativeDirectory: boolean
  imageRelativeDirectoryName: string
  hideLinkPopup: boolean
  autoCheck: boolean
  preferLooseListItem: boolean
  bulletListMarker: string
  orderListDelimiter: string
  preferHeadingStyle: string
  tabSize: number
  listIndentation: string | number
  frontmatterType: string
  superSubScript: boolean
  footnote: boolean
  isHtmlEnabled: boolean
  isGitlabCompatibilityEnabled: boolean
  sequenceTheme: string
  theme: string
  autoSwitchTheme: number
  spellcheckerEnabled: boolean
  spellcheckerNoUnderline: boolean
  spellcheckerLanguage: string
  sideBarVisibility: boolean
  tabBarVisibility: boolean
  sourceCodeModeEnabled: boolean
  searchExclusions: string[]
  searchMaxFileSize: string
  searchIncludeHidden: boolean
  searchNoIgnore: boolean
  searchFollowSymlinks: boolean
  watcherUsePolling: boolean
  typewriter: boolean
  focus: boolean
  sourceCode: boolean
  imageFolderPath: string
  webImages: unknown[]
  cloudImages: unknown[]
  currentUploader: string
  githubToken: string
  imageBed: {
    github: {
      owner: string
      repo: string
      branch: string
    }
  }
  cliScript: string
}

type PreferenceKey = keyof PreferencesState
type PreferenceMutationPayload = {
  type: 'typewriter' | 'focus' | 'sourceCode'
  checked: boolean
}

const state: PreferencesState = {
  autoSave: false,
  autoSaveDelay: 5000,
  titleBarStyle: 'custom',
  openFilesInNewWindow: false,
  openFolderInNewWindow: false,
  zoom: 1.0,
  hideScrollbar: false,
  wordWrapInToc: false,
  fileSortBy: 'created',
  startUpAction: 'lastState',
  defaultDirectoryToOpen: '',
  language: 'en',
  editorFontFamily: 'Open Sans',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
  codeFontFamily: 'DejaVu Sans Mono',
  codeBlockLineNumbers: true,
  trimUnnecessaryCodeBlockEmptyLines: true,
  editorLineWidth: '',
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  endOfLine: 'default',
  defaultEncoding: 'utf8',
  autoGuessEncoding: true,
  trimTrailingNewline: 2,
  textDirection: 'ltr',
  hideQuickInsertHint: false,
  imageInsertAction: 'folder',
  imagePreferRelativeDirectory: false,
  imageRelativeDirectoryName: 'assets',
  hideLinkPopup: false,
  autoCheck: false,
  preferLooseListItem: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  preferHeadingStyle: 'atx',
  tabSize: 4,
  listIndentation: 1,
  frontmatterType: '-',
  superSubScript: false,
  footnote: false,
  isHtmlEnabled: true,
  isGitlabCompatibilityEnabled: false,
  sequenceTheme: 'hand',
  theme: 'light',
  autoSwitchTheme: 2,
  spellcheckerEnabled: false,
  spellcheckerNoUnderline: false,
  spellcheckerLanguage: 'en-US',
  sideBarVisibility: false,
  tabBarVisibility: false,
  sourceCodeModeEnabled: false,
  searchExclusions: [],
  searchMaxFileSize: '',
  searchIncludeHidden: false,
  searchNoIgnore: false,
  searchFollowSymlinks: true,
  watcherUsePolling: false,
  typewriter: false,
  focus: false,
  sourceCode: false,
  imageFolderPath: '',
  webImages: [],
  cloudImages: [],
  currentUploader: 'none',
  githubToken: '',
  imageBed: {
    github: {
      owner: '',
      repo: '',
      branch: ''
    }
  },
  cliScript: ''
}

const getters = {}

const mutations = {
  SET_USER_PREFERENCE (state: PreferencesState, preference: Partial<PreferencesState>): void {
    (Object.keys(preference) as PreferenceKey[]).forEach(key => {
      const value = preference[key]
      if (typeof value !== 'undefined' && typeof state[key] !== 'undefined') {
        state[key] = value as never
      }
    })
  },
  SET_MODE (state: PreferencesState, payload: PreferenceMutationPayload): void {
    state[payload.type] = payload.checked
  },
  TOGGLE_VIEW_MODE (state: PreferencesState, entryName: 'typewriter' | 'focus' | 'sourceCode'): void {
    state[entryName] = !state[entryName]
  }
}

const actions = {
  ASK_FOR_USER_PREFERENCE ({ commit }: { commit: (type: string, payload?: unknown) => void }): void {
    ipcRenderer.send('mt::ask-for-user-preference')
    ipcRenderer.send('mt::ask-for-user-data')

    ipcRenderer.on('mt::user-preference', (_event, preferences: Partial<PreferencesState>) => {
      commit('SET_USER_PREFERENCE', preferences)
    })
  },

  SET_SINGLE_PREFERENCE (_ctx: unknown, { type, value }: { type: PreferenceKey, value: PreferencesState[PreferenceKey] }): void {
    ipcRenderer.send('mt::set-user-preference', { [type]: value })
  },

  SET_USER_DATA (_ctx: unknown, { type, value }: { type: string, value: unknown }): void {
    ipcRenderer.send('mt::set-user-data', { [type]: value })
  },

  SET_IMAGE_FOLDER_PATH (_ctx: unknown, value: string): void {
    ipcRenderer.send('mt::ask-for-modify-image-folder-path', value)
  },

  SELECT_DEFAULT_DIRECTORY_TO_OPEN (): void {
    ipcRenderer.send('mt::select-default-directory-to-open')
  },

  LISTEN_FOR_VIEW (
    { commit, dispatch }: { commit: (type: string, payload?: unknown) => void, dispatch: (type: string, payload?: unknown) => void }
  ): void {
    ipcRenderer.on('mt::show-command-palette', () => {
      bus.$emit('show-command-palette')
    })
    ipcRenderer.on('mt::toggle-view-mode-entry', (_event, entryName: 'typewriter' | 'focus' | 'sourceCode') => {
      commit('TOGGLE_VIEW_MODE', entryName)
      dispatch('DISPATCH_EDITOR_VIEW_STATE', { [entryName]: state[entryName] })
    })
  },

  LISTEN_TOGGLE_VIEW (
    { commit, dispatch }: { commit: (type: string, payload?: unknown) => void, dispatch: (type: string, payload?: unknown) => void }
  ): void {
    bus.$on('view:toggle-view-entry', (entryName: 'typewriter' | 'focus' | 'sourceCode') => {
      commit('TOGGLE_VIEW_MODE', entryName)
      dispatch('DISPATCH_EDITOR_VIEW_STATE', { [entryName]: state[entryName] })
    })
  },

  DISPATCH_EDITOR_VIEW_STATE (_ctx: unknown, viewState: Record<string, boolean>): void {
    const { windowId } = global.marktext.env
    ipcRenderer.send('mt::view-layout-changed', windowId, viewState)
  }
}

export default { state, getters, mutations, actions }
