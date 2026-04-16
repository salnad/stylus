import path from 'path'
import type { AppEnvironmentOptions, ParsedApplicationArgs } from 'common/types/app'
import AppPaths, { ensureAppDirectoriesSync } from './paths'

let envId = 0

const patchEnvPath = (): void => {
  if (process.platform === 'darwin') {
    const currentPath = process.env.PATH ?? ''
    process.env.PATH = currentPath + (currentPath.endsWith(path.delimiter) ? '' : path.delimiter) + '/Library/TeX/texbin'
  }
}

export class AppEnvironment {
  private readonly _id: number
  private readonly _appPaths: AppPaths
  private readonly _debug: boolean
  private readonly _isDevMode: boolean
  private readonly _verbose: number
  private readonly _safeMode: boolean
  private readonly _disableSpellcheck: boolean

  constructor (options: AppEnvironmentOptions) {
    this._id = envId++
    this._appPaths = new AppPaths(options.userDataPath)
    this._debug = !!options.debug
    this._isDevMode = !!options.isDevMode
    this._verbose = options.verbose ?? 0
    this._safeMode = !!options.safeMode
    this._disableSpellcheck = !!options.disableSpellcheck
  }

  get id (): number {
    return this._id
  }

  get paths (): AppPaths {
    return this._appPaths
  }

  get debug (): boolean {
    return this._debug
  }

  get isDevMode (): boolean {
    return this._isDevMode
  }

  get verbose (): number {
    return this._verbose
  }

  get safeMode (): boolean {
    return this._safeMode
  }

  get disableSpellcheck (): boolean {
    return this._disableSpellcheck
  }
}

const setupEnvironment = (args: ParsedApplicationArgs): AppEnvironment => {
  patchEnvPath()

  const isDevMode = process.env.NODE_ENV !== 'production'
  const debug = !!args['--debug'] || !!process.env.MARKTEXT_DEBUG || isDevMode
  const verbose = args['--verbose'] || 0
  const safeMode = !!args['--safe']
  const userDataPath = args['--user-data-dir']
  const disableSpellcheck = !!args['--disable-spellcheck']

  const appEnvironment = new AppEnvironment({
    debug,
    isDevMode,
    verbose,
    safeMode,
    userDataPath,
    disableSpellcheck
  })

  ensureAppDirectoriesSync(appEnvironment.paths)

  const markTextGlobal = globalThis as typeof globalThis & {
    MARKTEXT_DEBUG?: boolean
    MARKTEXT_DEBUG_VERBOSE?: number
    MARKTEXT_SAFE_MODE?: boolean
  }
  markTextGlobal.MARKTEXT_DEBUG = debug
  markTextGlobal.MARKTEXT_DEBUG_VERBOSE = verbose
  markTextGlobal.MARKTEXT_SAFE_MODE = safeMode

  return appEnvironment
}

export default setupEnvironment
