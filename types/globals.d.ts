interface MarkTextRendererPaths {
  electronUserDataPath: string
  userDataPath: string
  logPath: string
  preferencesPath: string
  dataCenterPath: string
  preferencesFilePath: string
  ripgrepBinaryPath: string
}

interface MarkTextInitialState {
  codeFontFamily?: string | null
  codeFontSize?: string | null
  hideScrollbar?: boolean
  theme?: string | null
  titleBarStyle?: string | null
}

interface MarkTextEnvironmentState {
  debug: boolean
  paths: MarkTextRendererPaths
  windowId: number
  type: string | null
}

interface MarkTextGlobalState {
  initialState: MarkTextInitialState | null
  env: MarkTextEnvironmentState
  paths: MarkTextRendererPaths
}

declare global {
  interface Window {
    DIRNAME: string
  }

  namespace NodeJS {
    interface Global {
      __static?: string
      marktext: MarkTextGlobalState
      MARKTEXT_GIT_SHORT_HASH?: string
      MARKTEXT_GIT_HASH?: string
      MARKTEXT_VERSION?: string
      MARKTEXT_VERSION_STRING?: string
      MARKTEXT_IS_STABLE?: boolean
      MARKTEXT_DEBUG?: boolean
      MARKTEXT_DEBUG_VERBOSE?: number
      MARKTEXT_SAFE_MODE?: boolean
    }

    interface ProcessVersions {
      MARKTEXT_VERSION?: string
      MARKTEXT_VERSION_STRING?: string
    }
  }
}

export {}
