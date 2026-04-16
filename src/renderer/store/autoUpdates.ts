import { ipcRenderer } from 'electron'
import notice from '../services/notification'

const state = {}
const getters = {}
const mutations = {}

const actions = {
  LISTEN_FOR_UPDATE (): void {
    ipcRenderer.on('mt::UPDATE_ERROR', (_event, message: string) => {
      notice.notify({
        title: 'Update',
        type: 'error',
        time: 10000,
        message
      })
    })

    ipcRenderer.on('mt::UPDATE_NOT_AVAILABLE', (_event, message: string) => {
      notice.notify({
        title: 'Update not Available',
        type: 'primary',
        message
      })
    })

    ipcRenderer.on('mt::UPDATE_DOWNLOADED', (_event, message: string) => {
      notice.notify({
        title: 'Update Downloaded',
        type: 'info',
        message
      })
    })

    ipcRenderer.on('mt::UPDATE_AVAILABLE', (_event, message: string) => {
      notice.notify({
        title: 'Update Available',
        type: 'primary',
        message,
        showConfirm: true
      })
        .then(() => {
          ipcRenderer.send('mt::NEED_UPDATE', { needUpdate: true })
        })
        .catch(() => {
          ipcRenderer.send('mt::NEED_UPDATE', { needUpdate: false })
        })
    })
  }
}

export default { state, getters, mutations, actions }
