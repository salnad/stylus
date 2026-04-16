import fs from 'fs'
import path from 'path'
import { isFile, isFile2, isSymbolicLink } from './index'

const isOsx = process.platform === 'darwin'

export const MARKDOWN_EXTENSIONS = Object.freeze([
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
] as const)

export const MARKDOWN_INCLUSIONS = Object.freeze(
  MARKDOWN_EXTENSIONS.map(x => `*.${x}`)
) as ReadonlyArray<string>

export const IMAGE_EXTENSIONS = Object.freeze([
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
] as const)

/**
 * Returns true if the filename matches one of the markdown extensions.
 */
export const hasMarkdownExtension = (filename: string | null | undefined): boolean => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(`.${ext}`))
}

/**
 * Returns true if the path is an image file.
 */
export const isImageFile = (filepath: string): boolean => {
  const extname = path.extname(filepath)
  return isFile(filepath) && IMAGE_EXTENSIONS.some(ext => {
    const extensionRegExp = new RegExp(ext, 'i')
    return extensionRegExp.test(extname)
  })
}

/**
 * Returns true if the path is a markdown file or symbolic link to a markdown file.
 */
export const isMarkdownFile = (filepath: string): boolean => {
  if (!isFile2(filepath)) return false

  if (isSymbolicLink(filepath)) {
    const targetPath = path.resolve(path.dirname(filepath), fs.readlinkSync(filepath))
    return isFile(targetPath) && hasMarkdownExtension(targetPath)
  }
  return hasMarkdownExtension(filepath)
}

/**
 * Check if both paths point to the same file.
 */
export const isSamePathSync = (
  pathA: string | null | undefined,
  pathB: string | null | undefined,
  isNormalized = false
): boolean => {
  if (!pathA || !pathB) return false

  const a = isNormalized ? pathA : path.normalize(pathA)
  const b = isNormalized ? pathB : path.normalize(pathB)

  if (a.length !== b.length) {
    return false
  } else if (a === b) {
    return true
  } else if (a.toLowerCase() === b.toLowerCase()) {
    try {
      const fileInfoA = fs.statSync(a)
      const fileInfoB = fs.statSync(b)
      return fileInfoA.ino === fileInfoB.ino
    } catch (_) {
      return false
    }
  }

  return false
}

/**
 * Check whether a file or directory is a child of the given directory.
 */
export const isChildOfDirectory = (dir: string | null | undefined, child: string | null | undefined): boolean => {
  if (!dir || !child) return false
  const relative = path.relative(dir, child)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const getResourcesPath = (): string => {
  let resourcesPath = process.resourcesPath
  if (process.env.NODE_ENV === 'development') {
    if (isOsx) {
      resourcesPath = path.join(resourcesPath, '../..')
    }
    resourcesPath = path.join(resourcesPath, '../../../../resources')
  }
  return resourcesPath
}
