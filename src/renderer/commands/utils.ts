import path from 'path'
import { isFile } from 'common/filesystem'

export const isUpdatable = (): boolean => {
  const resFile = isFile(path.join(process.resourcesPath, 'app-update.yml'))
  if (!resFile) {
    return false
  } else if (process.env.APPIMAGE) {
    return true
  } else if (process.platform === 'win32' && isFile(path.join(process.resourcesPath, 'md.ico'))) {
    return true
  }

  return false
}
