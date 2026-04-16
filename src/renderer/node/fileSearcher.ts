import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import RipgrepDirectorySearcher from './ripgrepSearcher'

interface FileSearchOptions {
  followSymlinks?: boolean
  includeHidden?: boolean
  noIgnore?: boolean
  inclusions: string[]
  didMatch?: (resultLine: string) => void
  didSearchPaths: (numPathsFound: number) => void
}

interface SearchPromise extends Promise<void> {
  cancel(): void
}

class FileSearcher extends RipgrepDirectorySearcher {
  searchInDirectory (
    directoryPath: string,
    _pattern: string,
    options: FileSearchOptions,
    numPathsFound: { num: number }
  ): SearchPromise {
    const args = ['--files']

    if (options.followSymlinks) {
      args.push('--follow')
    }
    if (options.includeHidden) {
      args.push('--hidden')
    }
    if (options.noIgnore) {
      args.push('--no-ignore')
    }

    for (const inclusion of this.prepareGlobs(options.inclusions, directoryPath)) {
      args.push('--iglob', inclusion)
    }

    args.push('--')
    args.push(directoryPath)

    let child: ChildProcessWithoutNullStreams | null = null
    try {
      child = spawn(this.rgPath, args, {
        cwd: directoryPath,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (err) {
      return Promise.reject(err) as SearchPromise
    }

    const didMatch = options.didMatch ?? (() => {})
    let cancelled = false

    const returnedPromise = new Promise<void>((resolve, reject) => {
      let buffer = ''
      let bufferError = ''

      child?.on('close', code => {
        if (code !== null && code > 1) {
          reject(new Error(bufferError))
        } else {
          resolve()
        }
      })
      child?.on('error', err => {
        reject(err)
      })

      child?.stderr.on('data', chunk => {
        bufferError += chunk
      })

      child?.stdout.on('data', chunk => {
        if (cancelled) {
          return
        }

        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          options.didSearchPaths(++numPathsFound.num)
          didMatch(line)
        }
      })
    }) as SearchPromise

    returnedPromise.cancel = () => {
      child?.kill()
      cancelled = true
    }

    return returnedPromise
  }
}

export default FileSearcher
