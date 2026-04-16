import { ipcRenderer } from 'electron'
import { isSamePathSync } from 'common/filesystem/paths'
import bus from '../bus'

interface FileLike {
  id?: string
  isSaved?: boolean
  pathname?: string
  markdown?: string
  cursor?: unknown
  history?: unknown
}

interface SearchMatchLike {
  range: [[number, number], [number, number]]
}

interface SearchResultLike {
  filePath: string
}

interface StoreLike {
  dispatch(type: string, payload?: unknown): unknown
  commit(type: string, payload?: unknown): unknown
}

interface VueLike {
  $store: StoreLike
  currentFile: FileLike
  tabs: FileLike[]
  searchResult: SearchResultLike
  file: {
    isMarkdown?: boolean
    pathname?: string
  }
  folder?: {
    isCollapsed: boolean
  }
  $refs: {
    input?: {
      focus(): void
    }
  }
  createName: string
  $nextTick(callback: () => void): void
}

export const tabsMixins = {
  methods: {
    selectFile (this: VueLike, file: FileLike): void {
      if (file.id !== this.currentFile.id) {
        this.$store.dispatch('UPDATE_CURRENT_FILE', file)
      }
    },
    removeFileInTab (this: VueLike, file: FileLike): void {
      if (file.isSaved) {
        this.$store.dispatch('FORCE_CLOSE_TAB', file)
      } else {
        this.$store.dispatch('CLOSE_UNSAVED_TAB', file)
      }
    }
  }
}

export const loadingPageMixins = {
  methods: {
    hideLoadingPage (): void {
      const loadingPage = document.querySelector('#loading-page')
      if (loadingPage) {
        loadingPage.remove()
      }
    }
  }
}

export const fileMixins = {
  methods: {
    handleSearchResultClick (this: VueLike, searchMatch: SearchMatchLike): void {
      const { range } = searchMatch
      const { filePath } = this.searchResult

      const openedTab = this.tabs.find(file => isSamePathSync(file.pathname, filePath))
      const cursor = {
        isCollapsed: range[0][0] !== range[1][0],
        anchor: {
          line: range[0][0],
          ch: range[0][1]
        },
        focus: {
          line: range[1][0],
          ch: range[1][1]
        }
      }

      if (openedTab) {
        openedTab.cursor = cursor
        if (this.currentFile !== openedTab) {
          this.$store.dispatch('UPDATE_CURRENT_FILE', openedTab)
        } else {
          const { id, markdown, history } = this.currentFile
          bus.$emit('file-changed', { id, markdown, cursor, renderCursor: true, history })
        }
      } else {
        ipcRenderer.send('mt::open-file', filePath, {
          cursor
        })
      }
    },
    handleFileClick (this: VueLike): void {
      const { isMarkdown, pathname } = this.file
      if (!isMarkdown || !pathname) return

      const openedTab = this.tabs.find(file => isSamePathSync(file.pathname, pathname))
      if (openedTab) {
        if (this.currentFile === openedTab) {
          return
        }
        this.$store.dispatch('UPDATE_CURRENT_FILE', openedTab)
      } else {
        ipcRenderer.send('mt::open-file', pathname, {})
      }
    }
  }
}

export const createFileOrDirectoryMixins = {
  methods: {
    handleInputFocus (this: VueLike): void {
      this.$nextTick(() => {
        this.$refs.input?.focus()
        this.createName = ''
        if (this.folder) {
          this.folder.isCollapsed = false
        }
      })
    },
    handleInputEnter (this: VueLike): void {
      this.$store.dispatch('CREATE_FILE_DIRECTORY', this.createName)
    }
  }
}
