// Because the sidebar also use the file icons, So I put this file out of floatBox directory.
import '@marktext/file-icons/build/index.css'
import rawFileIcons from '@marktext/file-icons'

interface FileIconMatch {
  getClass(size?: number, enableColor?: boolean): string
}

interface FileIconsApi {
  matchName(name: string): FileIconMatch | null
  matchLanguage(language: string): FileIconMatch | null
  getClassByName(name: string): string | null
  getClassByLanguage(language: string): string | null
}

const fileIcons = rawFileIcons as FileIconsApi

fileIcons.getClassByName = function (name: string): string | null {
  const icon = fileIcons.matchName(name)

  return icon ? icon.getClass(0, false) : null
}

fileIcons.getClassByLanguage = function (lang: string): string | null {
  const icon = fileIcons.matchLanguage(lang)

  return icon ? icon.getClass(0, false) : null
}

export default fileIcons
