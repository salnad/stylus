import { app, clipboard, crashReporter, dialog, ipcMain } from 'electron'
import os from 'os'
import log from 'electron-log'
import { createAndOpenGitHubIssueUrl } from './utils/createGitHubIssue'

const EXIT_ON_ERROR = !!process.env.MARKTEXT_EXIT_ON_ERROR
const SHOW_ERROR_DIALOG = !process.env.MARKTEXT_ERROR_INTERACTION
const ERROR_MSG_MAIN = 'An unexpected error occurred in the main process'
const ERROR_MSG_RENDERER = 'An unexpected error occurred in the renderer process'

interface ErrorLike {
  message?: string
  stack?: string
}

let logger: (message: string) => void = s => console.error(s)

const getOSInformation = (): string => {
  return `${os.type()} ${os.arch()} ${os.release()} (${os.platform()})`
}

const exceptionToString = (error: ErrorLike, type: 'main' | 'renderer'): string => {
  const message = error.message ?? 'Unknown error'
  const stack = error.stack ?? message
  return `Version: ${global.MARKTEXT_VERSION_STRING || app.getVersion()}\n` +
    `OS: ${getOSInformation()}\n` +
    `Type: ${type}\n` +
    `Date: ${new Date().toUTCString()}\n` +
    `Message: ${message}\n` +
    `Stack: ${stack}\n`
}

const handleError = async (title: string, error: ErrorLike, type: 'main' | 'renderer'): Promise<void> => {
  const message = error.message ?? title
  const stack = error.stack ?? message

  if (type === 'main') {
    logger(exceptionToString(error, type))
  }

  if (EXIT_ON_ERROR) {
    console.log('MarkText was terminated due to an unexpected error (MARKTEXT_EXIT_ON_ERROR variable was set)!')
    process.exit(1)
    return
  } else if (!SHOW_ERROR_DIALOG || (global.MARKTEXT_IS_STABLE && type === 'renderer')) {
    return
  }

  if (app.isReady()) {
    const { response } = await dialog.showMessageBox({
      type: 'error',
      buttons: [
        'OK',
        'Copy Error',
        'Report...'
      ],
      defaultId: 0,
      noLink: true,
      message: title,
      detail: stack
    })

    switch (response) {
      case 1:
        clipboard.writeText(`${title}\n${stack}`)
        break
      case 2: {
        const issueTitle = message ? `Unexpected error: ${message}` : title
        createAndOpenGitHubIssueUrl(
          issueTitle,
          `### Description

${title}.

<!-- Please describe, how the bug occurred -->

### Stack Trace

\`\`\`\n${stack}\n\`\`\`

### Version

MarkText: ${global.MARKTEXT_VERSION_STRING}
Operating system: ${getOSInformation()}`
        )
        break
      }
      default:
        break
    }
  } else {
    dialog.showErrorBox(title, stack)
    process.exit(1)
  }
}

const setupExceptionHandler = (): void => {
  process.on('uncaughtException', error => {
    handleError(ERROR_MSG_MAIN, error, 'main').catch(err => {
      console.error(err)
    })
  })

  ipcMain.on('mt::handle-renderer-error', (_event, error: ErrorLike) => {
    handleError(ERROR_MSG_RENDERER, error, 'renderer').catch(err => {
      console.error(err)
    })
  })

  crashReporter.start({
    companyName: 'marktext',
    productName: 'marktext',
    submitURL: 'http://0.0.0.0/',
    uploadToServer: false,
    compress: true
  })
}

export const initExceptionLogger = (): void => {
  logger = log.error as (message: string) => void
}

export default setupExceptionHandler
