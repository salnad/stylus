import fs from 'fs-extra'
import path from 'path'

import { isDirectory, isFile, isSymbolicLink } from 'common/filesystem'

export const normalizeAndResolvePath = (pathname: string): string => {
  if (isSymbolicLink(pathname)) {
    const absPath = path.dirname(pathname)
    const targetPath = path.resolve(absPath, fs.readlinkSync(pathname))
    if (isFile(targetPath) || isDirectory(targetPath)) {
      return path.resolve(targetPath)
    }
    console.error(`Cannot resolve link target "${pathname}" (${targetPath}).`)
    return ''
  }
  return path.resolve(pathname)
}

export const writeFile = (
  pathname: string,
  content: string | Buffer,
  extension?: string,
  options: string | fs.WriteFileOptions = 'utf-8'
): Promise<void> => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  const resolvedPath = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  return fs.outputFile(resolvedPath, content, options)
}
