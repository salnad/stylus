<template>
  <div
    class="editor-container"
  >
    <side-bar v-if="init"></side-bar>
    <div class="editor-middle">
      <title-bar
        :project="projectTree"
        :pathname="pathname"
        :filename="filename"
        :active="windowActive"
        :word-count="wordCount"
        :platform="platform"
        :is-saved="isSaved"
      ></title-bar>
      <div class="editor-placeholder" v-if="!init"></div>
      <recent
        v-if="!hasCurrentFile && init"
      ></recent>
      <editor-with-tabs
        v-if="hasCurrentFile && init"
        :markdown="markdown"
        :cursor="cursor"
        :source-code="sourceCode"
        :show-tab-bar="showTabBar"
        :text-direction="textDirection"
        :platform="platform"
      ></editor-with-tabs>
      <command-palette></command-palette>
      <about-dialog></about-dialog>
      <export-setting-dialog></export-setting-dialog>
      <rename></rename>
      <tweet></tweet>
      <import-modal></import-modal>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { addStyles, addThemeStyle } from '@/util/theme'
import Recent from '@/components/recent/index.vue'
import EditorWithTabs from '@/components/editorWithTabs/index.vue'
import TitleBar from '@/components/titleBar/index.vue'
import SideBar from '@/components/sideBar/index.vue'
import AboutDialog from '@/components/about/index.vue'
import CommandPalette from '@/components/commandPalette/index.vue'
import ExportSettingDialog from '@/components/exportSettings/index.vue'
import Rename from '@/components/rename/index.vue'
import Tweet from '@/components/tweet/index.vue'
import ImportModal from '@/components/import/index.vue'
import { loadingPageMixins } from '@/mixins'
import bus from '@/bus'
import { DEFAULT_STYLE, type DefaultStyle } from '@/config'
import { ipcRenderer } from 'electron'
import type { TextDirection } from 'common/types/preferences'
import type { PreferencesState } from '@/store/preferences'
import type { DocumentState, WordCount } from '@/store/help'
import type { TreeFolderEntry } from '@/store/treeCtrl'

interface AppStoreState {
  layout: {
    showTabBar: boolean
  }
  preferences: Pick<PreferencesState, 'sourceCode' | 'theme' | 'textDirection' | 'zoom'>
  project: {
    projectTree: TreeFolderEntry | null
  }
  editor: {
    currentFile: DocumentState
  }
  windowActive: boolean
  platform: string
  init: boolean
}

interface DispatchableStore {
  dispatch(type: string, payload?: unknown): unknown
  commit(type: string, payload?: unknown): unknown
}

const getInitialStyle = (): DefaultStyle => {
  const initialState = global.marktext.initialState
  return {
    codeFontFamily: initialState?.codeFontFamily || DEFAULT_STYLE.codeFontFamily,
    codeFontSize: initialState?.codeFontSize || DEFAULT_STYLE.codeFontSize,
    hideScrollbar: initialState?.hideScrollbar ?? DEFAULT_STYLE.hideScrollbar,
    theme: initialState?.theme || DEFAULT_STYLE.theme
  }
}

export default Vue.extend({
  name: 'marktext',
  components: {
    Recent,
    EditorWithTabs,
    TitleBar,
    SideBar,
    AboutDialog,
    ExportSettingDialog,
    Rename,
    Tweet,
    ImportModal,
    CommandPalette
  },
  mixins: [loadingPageMixins],
  data () {
    return {
      timer: null as ReturnType<typeof setTimeout> | null
    }
  },
  computed: {
    showTabBar (): boolean {
      return (this.$store.state as AppStoreState).layout.showTabBar
    },
    sourceCode (): boolean {
      return (this.$store.state as AppStoreState).preferences.sourceCode
    },
    theme (): string {
      return (this.$store.state as AppStoreState).preferences.theme
    },
    textDirection (): TextDirection {
      return (this.$store.state as AppStoreState).preferences.textDirection as TextDirection
    },
    zoom (): number {
      return (this.$store.state as AppStoreState).preferences.zoom
    },
    projectTree (): TreeFolderEntry | null {
      return (this.$store.state as AppStoreState).project.projectTree
    },
    pathname (): string {
      return (this.$store.state as AppStoreState).editor.currentFile.pathname
    },
    filename (): string {
      return (this.$store.state as AppStoreState).editor.currentFile.filename
    },
    isSaved (): boolean {
      return (this.$store.state as AppStoreState).editor.currentFile.isSaved
    },
    markdown (): string {
      return (this.$store.state as AppStoreState).editor.currentFile.markdown
    },
    cursor (): DocumentState['cursor'] {
      return (this.$store.state as AppStoreState).editor.currentFile.cursor
    },
    wordCount (): WordCount {
      return (this.$store.state as AppStoreState).editor.currentFile.wordCount
    },
    windowActive (): boolean {
      return (this.$store.state as AppStoreState).windowActive
    },
    platform (): string {
      return (this.$store.state as AppStoreState).platform
    },
    init (): boolean {
      return (this.$store.state as AppStoreState).init
    },
    hasCurrentFile (): boolean {
      return typeof this.markdown !== 'undefined'
    }
  },
  watch: {
    theme (value: string, oldValue: string) {
      if (value !== oldValue) {
        addThemeStyle(value)
      }
    },
    zoom (zoom: number) {
      ipcRenderer.emit('mt::window-zoom', null, zoom)
    }
  },
  created () {
    const store = this.$store as DispatchableStore
    const { commit, dispatch } = store

    if (global.marktext.initialState) {
      commit('SET_USER_PREFERENCE', global.marktext.initialState)
    }

    dispatch('LINTEN_WIN_STATUS')
    dispatch('LISTEN_COMMAND_CENTER_BUS')
    dispatch('LISTEN_FOR_TWEET')
    dispatch('LISTEN_FOR_LAYOUT')
    dispatch('LISTEN_FOR_EDIT')
    dispatch('LISTEN_FOR_VIEW')
    dispatch('LISTEN_FOR_SHOW_DIALOG')
    dispatch('LISTEN_FOR_PARAGRAPH_INLINE_STYLE')
    dispatch('LISTEN_FOR_UPDATE_PROJECT')
    dispatch('LISTEN_FOR_LOAD_PROJECT')
    dispatch('LISTEN_FOR_SIDEBAR_CONTEXT_MENU')
    dispatch('LISTEN_FOR_UPDATE')
    dispatch('LISTEN_SCREEN_SHOT')
    dispatch('ASK_FOR_USER_PREFERENCE')
    dispatch('LISTEN_TOGGLE_VIEW')
    dispatch('LISTEN_FOR_CLOSE')
    dispatch('LISTEN_FOR_SAVE_AS')
    dispatch('LISTEN_FOR_MOVE_TO')
    dispatch('LISTEN_FOR_SAVE')
    dispatch('LISTEN_FOR_SET_PATHNAME')
    dispatch('LISTEN_FOR_BOOTSTRAP_WINDOW')
    dispatch('LISTEN_FOR_SAVE_CLOSE')
    dispatch('LISTEN_FOR_RENAME')
    dispatch('LINTEN_FOR_SET_LINE_ENDING')
    dispatch('LINTEN_FOR_SET_ENCODING')
    dispatch('LINTEN_FOR_SET_FINAL_NEWLINE')
    dispatch('LISTEN_FOR_NEW_TAB')
    dispatch('LISTEN_FOR_CLOSE_TAB')
    dispatch('LISTEN_FOR_TAB_CYCLE')
    dispatch('LISTEN_FOR_SWITCH_TABS')
    dispatch('LINTEN_FOR_PRINT_SERVICE_CLEARUP')
    dispatch('LINTEN_FOR_EXPORT_SUCCESS')
    dispatch('LISTEN_FOR_FILE_CHANGE')
    dispatch('LISTEN_WINDOW_ZOOM')
    dispatch('LISTEN_FOR_RELOAD_IMAGES')
    dispatch('LISTEN_FOR_CONTEXT_MENU')
    dispatch('LISTEN_FOR_NOTIFICATION')

    window.addEventListener('dragover', (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !dataTransfer.types.length) {
        return
      }

      if (Array.from(dataTransfer.types).indexOf('Files') >= 0) {
        const singleImage = dataTransfer.items.length === 1 && dataTransfer.items[0].type.indexOf('image') > -1
        if (!singleImage) {
          event.preventDefault()
          if (this.timer) {
            clearTimeout(this.timer)
          }
          this.timer = setTimeout(() => {
            bus.$emit('importDialog', false)
          }, 300)
          bus.$emit('importDialog', true)
        }

        dataTransfer.dropEffect = 'copy'
      } else {
        event.stopPropagation()
        dataTransfer.dropEffect = 'none'
      }
    }, false)

    this.$nextTick(() => {
      addStyles(getInitialStyle())
      ;(loadingPageMixins.methods as { hideLoadingPage(this: Vue): void }).hideLoadingPage.call(this)
    })
  }
})
</script>

<style scoped>
  .editor-placeholder,
  .editor-container {
    display: flex;
    flex-direction: row;
    position: absolute;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  .editor-container .hide {
    z-index: -1;
    opacity: 0;
    position: absolute;
    left: -10000px;
  }
  .editor-placeholder {
    background: var(--editorBgColor);
  }
  .editor-middle {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 100vh;
    position: relative;
    & > .editor {
      flex: 1;
    }
  }
</style>
