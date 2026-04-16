import { app } from 'electron'

const ID_PREFIX = 'mt-'
let id = 0

interface HeaderInfo {
  level: number
  content: string
}

export const getUniqueId = (): string => {
  return `${ID_PREFIX}${id++}`
}

export const getRecommendTitleFromMarkdownString = (markdown: string): string => {
  const tokens = markdown.match(/#{1,6} {1,}(.*\S.*)(?:\n|$)/g)
  if (!tokens) return ''

  const headers = tokens
    .map<HeaderInfo | null>(token => {
      const matches = token.trim().match(/(#{1,6}) {1,}(.+)/)
      if (!matches) {
        return null
      }

      return {
        level: matches[1].length,
        content: matches[2].trim()
      }
    })
    .filter((header): header is HeaderInfo => header !== null)

  if (headers.length === 0) {
    return ''
  }

  return headers.sort((a, b) => a.level - b.level)[0].content
}

export const getPath = (name: Parameters<typeof app.getPath>[0]): string => {
  if (name === 'userData') {
    throw new Error('Do not use "getPath" for user data path!')
  }

  return app.getPath(name)
}

export const hasSameKeys = <T extends Record<string, unknown>, U extends Record<string, unknown>>(a: T, b: U): boolean => {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  return JSON.stringify(aKeys) === JSON.stringify(bKeys)
}

export const getLogLevel = (): 'debug' | 'info' | 'verbose' | 'silly' => {
  if (!globalThis.MARKTEXT_DEBUG_VERBOSE || typeof globalThis.MARKTEXT_DEBUG_VERBOSE !== 'number' ||
    globalThis.MARKTEXT_DEBUG_VERBOSE <= 0) {
    return process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  } else if (globalThis.MARKTEXT_DEBUG_VERBOSE === 1) {
    return 'verbose'
  } else if (globalThis.MARKTEXT_DEBUG_VERBOSE === 2) {
    return 'debug'
  }

  return 'silly'
}
