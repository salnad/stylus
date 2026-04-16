import './globalSetting'
import path from 'path'
import { app, dialog } from 'electron'
import { initialize as remoteInitializeServer } from '@electron/remote/main'
import cli from './cli'
import setupExceptionHandler, { initExceptionLogger } from './exceptionHandler'
import log from 'electron-log'
import App from './app'
import Accessor from './app/accessor'
import setupEnvironment, { type AppEnvironment } from './app/env'
import { getLogLevel } from './utils'
import type { ParsedApplicationArgs } from 'common/types/app'

const initializeLogger = (appEnvironment: AppEnvironment): void => {
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'info' : 'error'
  log.transports.rendererConsole = null
  log.transports.file.resolvePath = () => path.join(appEnvironment.paths.logPath, 'main.log')
  log.transports.file.level = getLogLevel()
  log.transports.file.sync = true
  initExceptionLogger()
}

if (!/^(darwin|win32|linux)$/i.test(process.platform)) {
  process.stdout.write(`Operating system "${process.platform}" is not supported! Please open an issue at "https://github.com/marktext/marktext".\n`)
  process.exit(1)
}

setupExceptionHandler()

const args: ParsedApplicationArgs = cli()
const appEnvironment = setupEnvironment(args)
initializeLogger(appEnvironment)

if (args['--disable-gpu']) {
  app.disableHardwareAcceleration()
}

if (!process.mas && process.env.NODE_ENV !== 'development') {
  const gotSingleInstanceLock = app.requestSingleInstanceLock()
  if (!gotSingleInstanceLock) {
    process.stdout.write('Other MarkText instance detected: exiting...\n')
    app.exit()
  }
}

let accessor: Accessor | null = null
try {
  accessor = new Accessor(appEnvironment)
} catch (err) {
  const error = err as Error
  const msgHint = error.message.includes('Config schema violation')
    ? 'This seems to be an issue with your configuration file(s). '
    : ''
  log.error(`Loading MarkText failed during initialization! ${msgHint}`, error)

  const exitOnError = !!process.env.MARKTEXT_EXIT_ON_ERROR
  const showErrorDialog = !process.env.MARKTEXT_ERROR_INTERACTION
  if (!exitOnError && showErrorDialog) {
    dialog.showErrorBox(
      'There was an error during loading',
      `${msgHint}${error.message}\n\n${error.stack ?? ''}`
    )
  }
  process.exit(1)
}

log.transports.file.sync = false

remoteInitializeServer()

const marktext = new App(accessor, args)
marktext.init()
