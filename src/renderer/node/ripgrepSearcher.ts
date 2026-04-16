/* eslint-disable no-use-before-define */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'

export interface SearchMatch {
  matchText: string
  lineText: string
  range: [[number, number], [number, number]]
  leadingContextLines?: string[]
  trailingContextLines?: string[]
}

export interface SearchResult {
  filePath: string
  matches: SearchMatch[]
}

interface SearchOptions {
  didMatch?: (result: unknown) => void
  didSearchPaths: (numPathsFound: number) => void
  inclusions: string[]
  exclusions?: string[]
  noIgnore?: boolean
  followSymlinks?: boolean
  isWholeWord?: boolean
  isRegexp?: boolean
  isCaseSensitive?: boolean
  maxFileSize?: number | string
  includeHidden?: boolean
  leadingContextLineCount?: number
  trailingContextLineCount?: number
}

export interface SearchPromise extends Promise<void> {
  cancel(): void
}

type SearchMessage =
  | {
    type: 'begin'
    data: {
      path: TextInput
    }
  }
  | {
    type: 'match'
    data: {
      path: TextInput
      lines: TextInput
      line_number: number
      submatches: Array<{
        match: TextInput
        start: number
        end: number
      }>
    }
  }
  | {
    type: 'end'
    data: Record<string, unknown>
  }

type TextInput = {
  text: string
} | {
  bytes: string
}

const cleanResultLine = (resultLine: TextInput): string => {
  const text = getText(resultLine)
  return text[text.length - 1] === '\n' ? text.slice(0, -1) : text
}

const getPositionFromColumn = (lines: string[], column: number): [number, number] => {
  let currentLength = 0
  let currentLine = 0
  let previousLength = 0

  while (column >= currentLength) {
    previousLength = currentLength
    currentLength += lines[currentLine].length + 1
    currentLine++
  }

  return [currentLine - 1, column - previousLength]
}

const processUnicodeMatch = (match: SearchMessage & { type: 'match' }): void => {
  const text = getText(match.data.lines)

  if (text.length === Buffer.byteLength(text)) {
    return
  }

  let remainingBuffer = Buffer.from(text)
  let currentLength = 0
  let previousPosition = 0

  const convertPosition = (position: number): number => {
    const currentBuffer = remainingBuffer.slice(0, position - previousPosition)
    currentLength = currentBuffer.toString().length + currentLength
    remainingBuffer = remainingBuffer.slice(position - previousPosition)
    previousPosition = position
    return currentLength
  }

  for (const submatch of match.data.submatches) {
    submatch.start = convertPosition(submatch.start)
    submatch.end = convertPosition(submatch.end)
  }
}

const processSubmatch = (
  submatch: { start: number, end: number },
  lineText: string,
  offsetRow: number
): SearchMatch => {
  const lineParts = lineText.split('\n')
  const start = getPositionFromColumn(lineParts, submatch.start)
  const end = getPositionFromColumn(lineParts, submatch.end)

  for (let i = start[0]; i > 0; i--) {
    lineParts.shift()
  }
  while (end[0] < lineParts.length - 1) {
    lineParts.pop()
  }

  start[0] += offsetRow
  end[0] += offsetRow

  return {
    matchText: '',
    range: [start, end],
    lineText: cleanResultLine({ text: lineParts.join('\n') })
  }
}

const getText = (input: TextInput): string => {
  return 'text' in input ? input.text : Buffer.from(input.bytes, 'base64').toString()
}

class RipgrepDirectorySearcher {
  protected readonly rgPath: string

  constructor () {
    this.rgPath = global.marktext.paths.ripgrepBinaryPath
  }

  search (directories: string[], pattern: string, options: SearchOptions): SearchPromise {
    const numPathsFound = { num: 0 }

    const allPromises = directories.map(
      directory => this.searchInDirectory(directory, pattern, options, numPathsFound)
    )

    const promise = Promise.all(allPromises).then(() => undefined) as SearchPromise
    promise.cancel = () => {
      for (const item of allPromises) {
        item.cancel()
      }
    }
    return promise
  }

  searchInDirectory (
    directoryPath: string,
    pattern: string,
    options: SearchOptions,
    numPathsFound: { num: number }
  ): SearchPromise {
    let regexpStr: string | null = null
    let textPattern: string | null = null
    const args: string[] = ['--json']

    if (options.isRegexp) {
      regexpStr = this.prepareRegexp(pattern)
      args.push('--regexp', regexpStr)
    } else {
      args.push('--fixed-strings')
      textPattern = pattern
    }

    if (regexpStr && this.isMultilineRegexp(regexpStr)) {
      args.push('--multiline')
    }

    if (options.isCaseSensitive) {
      args.push('--case-sensitive')
    } else {
      args.push('--ignore-case')
    }
    if (options.isWholeWord) {
      args.push('--word-regexp')
    }
    if (options.followSymlinks) {
      args.push('--follow')
    }
    if (options.maxFileSize) {
      args.push('--max-filesize', String(options.maxFileSize))
    }
    if (options.includeHidden) {
      args.push('--hidden')
    }
    if (options.noIgnore) {
      args.push('--no-ignore')
    }

    if (options.leadingContextLineCount) {
      args.push('--before-context', String(options.leadingContextLineCount))
    }
    if (options.trailingContextLineCount) {
      args.push('--after-context', String(options.trailingContextLineCount))
    }
    for (const inclusion of this.prepareGlobs(options.inclusions, directoryPath)) {
      args.push('--iglob', inclusion)
    }
    for (const exclusion of this.prepareGlobs(options.exclusions ?? [], directoryPath)) {
      args.push('--iglob', `!${exclusion}`)
    }

    args.push('--')

    if (textPattern) {
      args.push(textPattern)
    }

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
      let pendingEvent: SearchResult | null = null
      let pendingLeadingContext: string[] = []

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
          const message = JSON.parse(line) as SearchMessage
          if (message.type === 'begin') {
            pendingEvent = {
              filePath: getText(message.data.path),
              matches: []
            }
            pendingLeadingContext = []
          } else if (message.type === 'match' && pendingEvent) {
            processUnicodeMatch(message)
            for (const submatch of message.data.submatches) {
              const processedMatch = processSubmatch(
                submatch,
                getText(message.data.lines),
                message.data.line_number - 1
              )
              processedMatch.matchText = getText(submatch.match)
              processedMatch.leadingContextLines = [...pendingLeadingContext]
              processedMatch.trailingContextLines = []
              pendingEvent.matches.push(processedMatch)
            }
          } else if (message.type === 'end' && pendingEvent) {
            options.didSearchPaths(++numPathsFound.num)
            didMatch(pendingEvent)
            pendingEvent = null
          }
        }
      })
    }) as SearchPromise

    returnedPromise.cancel = () => {
      child?.kill()
      cancelled = true
    }

    return returnedPromise
  }

  prepareGlobs (globs: string[], projectRootPath: string): string[] {
    const output: string[] = []

    for (let pattern of globs) {
      pattern = pattern.replace(new RegExp(`\\${path.sep}`, 'g'), '/')

      if (pattern.length === 0) {
        continue
      }

      const projectName = path.basename(projectRootPath)

      if (pattern === projectName) {
        output.push('**/*')
        continue
      }

      if (pattern.startsWith(`${projectName}/`)) {
        pattern = pattern.slice(projectName.length + 1)
      }

      if (pattern.endsWith('/')) {
        pattern = pattern.slice(0, -1)
      }

      pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
      output.push(pattern)
      output.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
    }

    return output
  }

  prepareRegexp (regexpStr: string): string {
    if (regexpStr === '--') {
      return '\\-\\-'
    }

    return regexpStr.replace(/\\\//g, '/')
  }

  isMultilineRegexp (regexpStr: string): boolean {
    return regexpStr.includes('\\n')
  }
}

export default RipgrepDirectorySearcher
