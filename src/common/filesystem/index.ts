import fs from 'fs-extra'
import fsPromises from 'fs/promises'
import path from 'path'

/**
 * Test whether or not the given path exists.
 *
 * @param p The path to the file or directory.
 * @returns Whether the path is accessible.
 */
export const exists = async (p: string): Promise<boolean> => {
  try {
    await fsPromises.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure that a directory exists.
 *
 * @param dirPath The directory path.
 */
export const ensureDirSync = (dirPath: string): void => {
  try {
    fs.ensureDirSync(dirPath)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
}

/**
 * Returns true if the path is a directory with read access.
 *
 * @param dirPath The directory path.
 */
export const isDirectory = (dirPath: string): boolean => {
  try {
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory()
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a directory or a symbolic link to a directory with read access.
 *
 * @param dirPath The directory path.
 */
export const isDirectory2 = (dirPath: string): boolean => {
  try {
    if (!fs.existsSync(dirPath)) {
      return false
    }

    const fi = fs.lstatSync(dirPath)
    if (fi.isDirectory()) {
      return true
    } else if (fi.isSymbolicLink()) {
      const targetPath = path.resolve(path.dirname(dirPath), fs.readlinkSync(dirPath))
      return isDirectory(targetPath)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a file with read access.
 *
 * @param filepath The file path.
 */
export const isFile = (filepath: string): boolean => {
  try {
    return fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a file or a symbolic link to a file with read access.
 *
 * @param filepath The file path.
 */
export const isFile2 = (filepath: string): boolean => {
  try {
    if (!fs.existsSync(filepath)) {
      return false
    }

    const fi = fs.lstatSync(filepath)
    if (fi.isFile()) {
      return true
    } else if (fi.isSymbolicLink()) {
      const targetPath = path.resolve(path.dirname(filepath), fs.readlinkSync(filepath))
      return isFile(targetPath)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a symbolic link with read access.
 *
 * @param filepath The link path.
 */
export const isSymbolicLink = (filepath: string): boolean => {
  try {
    return fs.existsSync(filepath) && fs.lstatSync(filepath).isSymbolicLink()
  } catch {
    return false
  }
}
