import { app } from 'electron'
import EnvPaths from 'common/envPaths'
import { ensureDirSync } from 'common/filesystem'
import type { EnvPathsContract } from 'common/types/app'

class AppPaths extends EnvPaths {
  /**
   * Configure and sets all application paths.
   *
   * @param userDataPath The user data path or null.
   */
  constructor (userDataPath = '') {
    if (!userDataPath) {
      // Use default user data path.
      userDataPath = app.getPath('userData')
    }

    // Initialize environment paths
    super(userDataPath)

    // Changing the user data directory is only allowed during application bootstrap.
    app.setPath('userData', this.electronUserDataPath)
  }
}

export const ensureAppDirectoriesSync = (paths: EnvPathsContract): void => {
  ensureDirSync(paths.userDataPath)
  ensureDirSync(paths.logPath)
  // TODO(sessions): enable this...
  // ensureDirSync(paths.electronUserDataPath)
  // ensureDirSync(paths.globalStorage)
  // ensureDirSync(paths.preferencesPath)
  // ensureDirSync(paths.sessionsPath)
}

export default AppPaths
