import path from 'path'
import crypto from 'crypto'
import fs from 'fs-extra'
import { statSync, constants } from 'fs'
import cp from 'child_process'
import { tmpdir } from 'os'
import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'
import { isImageFile } from 'common/filesystem/paths'
import { isWindows } from './index'

type FileSystemEntryType = 'file' | 'directory'
type ClipboardOperationType = 'copy' | 'cut'
type UploaderType = 'none' | 'github' | 'picgo' | 'cliScript'

interface ClipboardFileOperation {
  src: string
  dest: string
  type: ClipboardOperationType
}

interface GitHubImageBed {
  owner: string
  repo: string
  branch: string
}

interface ImageBedConfig {
  github: GitHubImageBed
}

interface ImagePreferences {
  currentUploader: UploaderType
  imageBed: ImageBedConfig
  githubToken?: string | null
  cliScript?: string | null
}

type ImageInput = string | File

export const create = async (pathname: string, type: FileSystemEntryType): Promise<void> => {
  await (type === 'directory'
    ? fs.ensureDir(pathname)
    : fs.outputFile(pathname, ''))
}

export const paste = async ({ src, dest, type }: ClipboardFileOperation): Promise<void> => {
  await (type === 'cut'
    ? fs.move(src, dest)
    : fs.copy(src, dest))
}

export const rename = async (src: string, dest: string): Promise<void> => {
  await fs.move(src, dest)
}

export const getHash = (content: string | Buffer, encoding: crypto.BinaryToTextEncoding | BufferEncoding, type: string): string => {
  const hash = crypto.createHash(type)
  if (typeof content === 'string') {
    hash.update(content, encoding as BufferEncoding)
  } else {
    hash.update(content)
  }
  return hash.digest('hex')
}

export const getContentHash = (content: string): string => {
  return getHash(content, 'utf8', 'sha1')
}

export const moveToRelativeFolder = async (
  cwd: string,
  relativeName: string,
  filePath: string,
  imagePath: string
): Promise<string> => {
  let targetRelativeName = relativeName
  if (!targetRelativeName) {
    targetRelativeName = 'assets'
  } else if (path.isAbsolute(targetRelativeName)) {
    throw new Error('Invalid relative directory name.')
  }

  const absPath = path.resolve(cwd, targetRelativeName)
  const dstPath = path.resolve(absPath, path.basename(imagePath))
  await fs.ensureDir(absPath)
  await fs.move(imagePath, dstPath, { overwrite: true })

  const dstRelPath = path.relative(path.dirname(filePath), dstPath)
  if (isWindows) {
    return dstRelPath.replace(/\\/g, '/')
  }
  return dstRelPath
}

const readFileAsBinaryString = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()
    fileReader.onload = () => {
      resolve(String(fileReader.result ?? ''))
    }
    fileReader.onerror = () => {
      reject(fileReader.error ?? new Error('Unable to read file.'))
    }
    fileReader.readAsBinaryString(file)
  })
}

const readFileAsResult = (file: File, useArrayBuffer: boolean): Promise<ArrayBuffer | string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const { result } = reader
      if (typeof result === 'string' || result instanceof ArrayBuffer) {
        resolve(result)
      } else {
        reject(new Error('Unexpected FileReader result type.'))
      }
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read file.'))
    }
    if (useArrayBuffer) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsDataURL(file)
    }
  })
}

export const moveImageToFolder = async (pathname: string, image: ImageInput, outputDir: string): Promise<string> => {
  await fs.ensureDir(outputDir)
  const isPath = typeof image === 'string'
  if (isPath) {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image)
    const isImage = isImageFile(imagePath)
    if (isImage) {
      const filename = path.basename(imagePath)
      const extname = path.extname(imagePath)
      const noHashPath = path.join(outputDir, filename)
      if (noHashPath === imagePath) {
        return imagePath
      }
      const hash = getContentHash(imagePath)
      const hashFilePath = path.join(outputDir, `${hash}${extname}`)
      await fs.copy(imagePath, hashFilePath)
      return hashFilePath
    }
    return image
  }

  const imagePath = path.join(outputDir, `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-${image.name}`)
  const binaryString = await readFileAsBinaryString(image)
  await fs.writeFile(imagePath, binaryString, 'binary')
  return imagePath
}

export const uploadImage = async (pathname: string, image: ImageInput, preferences: ImagePreferences): Promise<string> => {
  const {
    currentUploader,
    imageBed,
    githubToken: auth,
    cliScript
  } = preferences
  const { owner, repo, branch } = imageBed.github
  const isPath = typeof image === 'string'
  const MAX_SIZE = 5 * 1024 * 1024

  const promise = new Promise<string>((resolve, reject) => {
    if (currentUploader === 'none') {
      reject(new Error('No image uploader provided.'))
      return
    }

    const uploadByGithub = (content: string, filename: string): void => {
      const octokit = new Octokit({ auth })
      const targetPath = dayjs().format('YYYY/MM') + `/${dayjs().format('DD-HH-mm-ss')}-${filename}`
      const message = `Upload by MarkText at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
      const payload: {
        owner: string
        repo: string
        path: string
        branch?: string
        message: string
        content: string
      } = {
        owner,
        repo,
        path: targetPath,
        branch,
        message,
        content
      }
      if (!branch) {
        delete payload.branch
      }
      octokit.repos.createOrUpdateFileContents(payload)
        .then(result => {
          resolve(result.data.content?.download_url ?? '')
        })
        .catch(() => {
          reject(new Error('Upload failed, the image will be copied to the image folder'))
        })
    }

    const uploadByCommand = async (uploader: Extract<UploaderType, 'picgo' | 'cliScript'>, filePathInput: string | ArrayBuffer): Promise<void> => {
      let shouldDeleteTempFile = false
      let resolvedFilePath = filePathInput
      if (typeof resolvedFilePath !== 'string') {
        shouldDeleteTempFile = true
        const data = new Uint8Array(resolvedFilePath)
        resolvedFilePath = path.join(tmpdir(), String(+new Date()))
        await fs.writeFile(resolvedFilePath, data)
      }

      const cleanupTempFile = async (): Promise<void> => {
        if (shouldDeleteTempFile && typeof resolvedFilePath === 'string') {
          await fs.unlink(resolvedFilePath)
        }
      }

      if (uploader === 'picgo') {
        cp.execFile('picgo', ['u', resolvedFilePath], async (err, data) => {
          await cleanupTempFile()
          if (err) {
            reject(err)
            return
          }
          const parts = data.split('[PicGo SUCCESS]:')
          if (parts.length === 2) {
            resolve(parts[1].trim())
          } else {
            reject(new Error('PicGo upload error'))
          }
        })
      } else {
        if (!cliScript) {
          reject(new Error('No CLI script configured.'))
          return
        }
        cp.execFile(cliScript, [resolvedFilePath], async (err, data) => {
          await cleanupTempFile()
          if (err) {
            reject(err)
            return
          }
          resolve(data.trim())
        })
      }
    }

    const rejectForLargeFile = (): void => {
      reject(new Error('Cannot upload more than 5M image, the image will be copied to the image folder'))
    }

    const run = async (): Promise<void> => {
      if (isPath) {
        const dirname = path.dirname(pathname)
        const imagePath = path.resolve(dirname, image)
        const isImage = isImageFile(imagePath)
        if (isImage) {
          const { size } = await fs.stat(imagePath)
          if (size > MAX_SIZE) {
            rejectForLargeFile()
          } else {
            switch (currentUploader) {
              case 'cliScript':
              case 'picgo':
                await uploadByCommand(currentUploader, imagePath)
                break
              case 'github': {
                const imageFile = await fs.readFile(imagePath)
                const base64 = Buffer.from(imageFile).toString('base64')
                uploadByGithub(base64, path.basename(imagePath))
                break
              }
              default:
                reject(new Error('Unsupported uploader type.'))
            }
          }
        } else {
          resolve(image)
        }
        return
      }

      const { size } = image
      if (size > MAX_SIZE) {
        rejectForLargeFile()
        return
      }

      const readerResult = await readFileAsResult(image, currentUploader !== 'github')
      switch (currentUploader) {
        case 'picgo':
        case 'cliScript':
          await uploadByCommand(currentUploader, readerResult)
          break
        case 'github':
          if (typeof readerResult !== 'string') {
            reject(new Error('Unexpected binary result for GitHub upload.'))
            return
          }
          uploadByGithub(readerResult, image.name)
          break
        default:
          reject(new Error('Unsupported uploader type.'))
      }
    }

    run().catch(reject)
  })

  return promise
}

export const isFileExecutableSync = (filepath: string): boolean => {
  try {
    const stat = statSync(filepath)
    return stat.isFile() && (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
  } catch {
    return false
  }
}
