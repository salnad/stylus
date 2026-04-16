import path from 'path'
import { ipcRenderer } from 'electron'
import log from 'electron-log'
import RendererPaths from './node/paths'

type ErrorLogger = (error: unknown) => void

interface RendererBootstrapState {
  initialState: {
    codeFontFamily?: string | null
    codeFontSize?: string | null
    hideScrollbar?: boolean
    theme?: string | null
    titleBarStyle?: string | null
  } | null
  env: {
    debug: boolean
    paths: RendererPaths
    windowId: number
    type: string | null
  }
  paths: RendererPaths
}

let exceptionLogger: ErrorLogger = error => console.error(error)

const configureLogger = (): void => {
  const { debug, paths, windowId } = global.marktext.env
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'info' : false
  log.transports.mainConsole = null
  log.transports.file.resolvePath = () => path.join(paths.logPath, `editor-${windowId}.log`)
  log.transports.file.level = debug ? 'debug' : 'info'
  log.transports.file.sync = false
  exceptionLogger = log.error as ErrorLogger
}

const parseUrlArgs = (): RendererBootstrapState => {
  const params = new URLSearchParams(window.location.search)
  const codeFontFamily = params.get('cff')
  const codeFontSize = params.get('cfs')
  const debug = params.get('debug') === '1'
  const hideScrollbar = params.get('hsb') === '1'
  const theme = params.get('theme')
  const titleBarStyle = params.get('tbs')
  const userDataPath = params.get('udp')
  const windowId = Number(params.get('wid'))
  const type = params.get('type')

  if (!userDataPath) {
    throw new Error('Error while parsing URL arguments: userDataPath!')
  }
  if (Number.isNaN(windowId)) {
    throw new Error('Error while parsing URL arguments: windowId!')
  }

  const paths = new RendererPaths(userDataPath)
  return {
    initialState: {
      codeFontFamily,
      codeFontSize,
      hideScrollbar,
      theme,
      titleBarStyle
    },
    env: {
      debug,
      paths,
      windowId,
      type
    },
    paths
  }
}

const bootstrapRenderer = (): void => {
  window.addEventListener('error', event => {
    if (event.error) {
      const { message, name, stack } = event.error as Error
      const copy = {
        message,
        name,
        stack
      }

      exceptionLogger(event.error)
      ipcRenderer.send('mt::handle-renderer-error', copy)
    } else {
      console.error(event)
    }
  })

  global.marktext = parseUrlArgs()
  configureLogger()
}

export default bootstrapRenderer
