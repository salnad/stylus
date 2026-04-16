import plist from 'plist'
import { clipboard as remoteClipboard } from '@electron/remote'
import { isLinux, isOsx, isWindows } from './index'

const hasClipboardFiles = (): boolean => {
  return remoteClipboard.has('NSFilenamesPboardType')
}

const getClipboardFiles = (): string[] => {
  if (!hasClipboardFiles()) {
    return []
  }
  const parsed = plist.parse(remoteClipboard.read('NSFilenamesPboardType'))
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

export const guessClipboardFilePath = (): string => {
  if (isLinux) return ''
  if (isOsx) {
    const result = getClipboardFiles()
    return result.length ? result[0] : ''
  } else if (isWindows) {
    const rawFilePath = remoteClipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  }
  return ''
}
