export interface EnvPathsContract {
  electronUserDataPath: string
  userDataPath: string
  logPath: string
  preferencesPath: string
  dataCenterPath: string
  preferencesFilePath: string
}

export interface AppEnvironmentOptions {
  debug?: boolean
  isDevMode?: boolean
  verbose?: number
  safeMode?: boolean
  userDataPath?: string
  disableSpellcheck?: boolean
}

export interface ParsedApplicationArgs {
  _: string[]
  '--debug'?: boolean
  '--safe'?: boolean
  '--new-window'?: boolean
  '--disable-gpu'?: boolean
  '--verbose'?: number
  '--user-data-dir'?: string
  '--disable-spellcheck'?: boolean
  '--help'?: boolean
  '--version'?: boolean
}

export type ArgSpecification = Record<string, unknown>
