import { ipcRenderer, shell } from 'electron'
import notice from '../services/notification'

const state = {}
const getters = {}
const mutations = {}

interface NotificationOptions {
  title?: string
  type?: 'primary' | 'error' | 'warning' | 'info'
  time?: number
  message?: string
  showConfirm?: boolean
}

const actions = {
  LISTEN_FOR_NOTIFICATION (): void {
    const defaultOptions: Required<NotificationOptions> = {
      title: 'Infomation',
      type: 'primary',
      time: 10000,
      message: 'You should never see this message',
      showConfirm: false
    }

    ipcRenderer.on('mt::show-notification', (_event, opts: NotificationOptions) => {
      const options = Object.assign({}, defaultOptions, opts)
      notice.notify(options)
    })

    ipcRenderer.on('mt::pandoc-not-exists', async (_event, opts: NotificationOptions) => {
      const options = Object.assign({}, defaultOptions, opts, { showConfirm: true })
      await notice.notify(options)
      shell.openExternal('http://pandoc.org')
    })
  }
}

export default { state, getters, mutations, actions }
