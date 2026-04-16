import { ipcRenderer } from 'electron'
import bus from '../bus'

const state = {}
const getters = {}
const mutations = {}

type CommitFn = (type: string, payload?: unknown) => void

const actions = {
  LISTEN_FOR_EDIT ({ commit }: { commit: CommitFn }): void {
    ipcRenderer.on('mt::editor-edit-action', (_event, type: string) => {
      if (type === 'findInFolder') {
        commit('SET_LAYOUT', {
          rightColumn: 'search',
          showSideBar: true
        })
      }
      bus.$emit(type, type)
    })
  },

  LISTEN_FOR_SHOW_DIALOG (): void {
    ipcRenderer.on('mt::about-dialog', () => {
      bus.$emit('aboutDialog')
    })
    ipcRenderer.on('mt::show-export-dialog', (_event, type: string) => {
      bus.$emit('showExportDialog', type)
    })
  },

  LISTEN_FOR_PARAGRAPH_INLINE_STYLE (): void {
    ipcRenderer.on('mt::editor-paragraph-action', (_event, { type }: { type: string }) => {
      bus.$emit('paragraph', type)
    })
    ipcRenderer.on('mt::editor-format-action', (_event, { type }: { type: string }) => {
      bus.$emit('format', type)
    })
  }
}

export default { state, getters, mutations, actions }
