import fs, { FSWatcher } from 'fs'
import path from 'path'
import { filter } from 'fuzzaldrin'
import log from 'electron-log'
import { isDirectory, isFile } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import { BLACK_LIST } from '../config'

export interface ImagePathEntry {
  file: string
  type: 'directory' | 'image'
}

const IMAGE_PATH = new Map<string, ImagePathEntry[]>()
export const watchers = new Map<string, FSWatcher>()

const filesHandler = (files: string[], directory: string, key?: string): ImagePathEntry[] | undefined => {
  const IMAGE_REG = new RegExp(`(${IMAGE_EXTENSIONS.join('|')})$`, 'i')
  const onlyDirAndImage = files
    .map<ImagePathEntry | null>(file => {
      const fullPath = path.join(directory, file)
      if (isDirectory(fullPath)) {
        return {
          file,
          type: 'directory'
        }
      } else if (isFile(fullPath) && IMAGE_REG.test(file)) {
        return {
          file,
          type: 'image'
        }
      }
      return null
    })
    .filter((item): item is ImagePathEntry => {
      if (!item) {
        return false
      }
      if ((BLACK_LIST as readonly string[]).includes(item.file)) {
        return false
      }
      return item.type === 'directory' || item.type === 'image'
    })

  IMAGE_PATH.set(directory, onlyDirAndImage)
  if (key !== undefined) {
    return filter(onlyDirAndImage, key, {
      key: 'file'
    }) as ImagePathEntry[]
  }
}

const rebuild = (directory: string): void => {
  fs.readdir(directory, (err, files) => {
    if (err) {
      log.error('imagePathAutoComplement::rebuild:', err)
    } else {
      filesHandler(files, directory)
    }
  })
}

const watchDirectory = (directory: string): void => {
  if (watchers.has(directory)) return

  const watcher = fs.watch(directory, (eventType: string) => {
    if (eventType === 'rename') {
      rebuild(directory)
    }
  })
  watchers.set(directory, watcher)
}

export const searchFilesAndDir = async (directory: string, key: string): Promise<ImagePathEntry[]> => {
  if (IMAGE_PATH.has(directory)) {
    return filter(IMAGE_PATH.get(directory) ?? [], key, { key: 'file' }) as ImagePathEntry[]
  }

  return new Promise<ImagePathEntry[]>((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        reject(err)
      } else {
        const result = filesHandler(files, directory, key) ?? []
        watchDirectory(directory)
        resolve(result)
      }
    })
  })
}
