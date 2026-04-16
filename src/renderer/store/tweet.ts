import { ipcRenderer } from 'electron'
import bus from '../bus'

const state = {}
const getters = {}
const mutations = {}

const actions = {
  LISTEN_FOR_TWEET (): void {
    ipcRenderer.on('mt::tweet', (_event, type: string) => {
      if (type === 'twitter') {
        bus.$emit('tweetDialog')
      }
    })
  }
}

export default { state, getters, mutations, actions }
