import Vue from 'vue'
import Vuex, { type Module } from 'vuex'
import { ipcRenderer } from 'electron'

import listenForMain from './listenForMain'
import project from './project'
import editor from './editor'
import layout from './layout'
import preferences from './preferences'
import autoUpdates from './autoUpdates'
import notification from './notification'
import tweet from './tweet'
import commandCenter from './commandCenter'

Vue.use(Vuex)

interface RootState {
  platform: NodeJS.Platform
  appVersion: string
  windowActive: boolean
  init: boolean
}

const state: RootState = {
  platform: process.platform,
  appVersion: process.versions.MARKTEXT_VERSION_STRING ?? '',
  windowActive: true,
  init: false
}

const getters = {}

const mutations = {
  SET_WIN_STATUS (currentState: RootState, status: boolean) {
    currentState.windowActive = status
  },
  SET_INITIALIZED (currentState: RootState) {
    currentState.init = true
  }
}

const actions = {
  LINTEN_WIN_STATUS ({ commit }: { commit: (type: string, payload: boolean) => void }) {
    ipcRenderer.on('mt::window-active-status', (_event, { status }: { status: boolean }) => {
      commit('SET_WIN_STATUS', status)
    })
  },

  SEND_INITIALIZED ({ commit }: { commit: (type: string) => void }) {
    commit('SET_INITIALIZED')
  }
}

const store = new Vuex.Store<RootState>({
  state,
  getters,
  mutations,
  actions,
  modules: {
    listenForMain,
    autoUpdates,
    notification,
    tweet,
    project,
    preferences,
    editor,
    layout,
    commandCenter
  } as unknown as Record<string, Module<unknown, RootState>>
})

export default store
