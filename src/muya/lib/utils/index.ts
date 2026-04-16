import path from 'path'
import runSanitize from './dompurify'
import { IMAGE_EXT_REG } from '../config'
import * as legacyConfig from '../config/index.js'

export { getUniqueId, getLongUniqueId } from './random'

const TIMEOUT = 1500

const HTML_TAG_REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const HTML_TAG_UNESCAPE_REPLACEMENTS: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&#39;': "'",
  '&quot;': '"'
}

type AnyFunction = (...args: unknown[]) => unknown

interface KeyLikeEvent {
  key?: string | null
}

type RangeTuple = [number, number]

interface RangeLike {
  start: number
  end: number
}

interface ActiveRange<T = unknown> extends RangeLike {
  active: T
}

type CloneableRecord = Record<string, unknown>

interface LoadedImage {
  url: string
  width: number
  height: number
}

interface ImageInfo {
  isUnknownType: boolean
  src: string
}

interface WordCountResult {
  word: number
  paragraph: number
  character: number
  all: number
}

interface ParagraphReferenceRect {
  x: number
  y: number
  left: number
  top: number
  bottom: number
  height: number
  width: number
  right: number
}

interface ParagraphReferenceLike {
  getBoundingClientRect(): ParagraphReferenceRect
  clientWidth: number
  clientHeight: number
  id: string
}

interface BlockLike {
  type?: string
  functionType?: string
  children?: Array<{ text: string }>
  [key: string]: unknown
}

interface Deferred<T = unknown> {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
  promise: Promise<T>
}

interface LegacyConfigExports {
  URL_REG: RegExp
  DATA_URL_REG: RegExp
}

type RunSanitize = (html: string, purifyOptions?: unknown) => string

const sanitizeHtml = runSanitize as RunSanitize
const { URL_REG, DATA_URL_REG } = legacyConfig as unknown as LegacyConfigExports

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return deepCopyArray(value) as T
  }

  if (typeof value === 'object' && value !== null) {
    return deepCopy(value as CloneableRecord) as T
  }

  return value
}

export const isMetaKey = ({ key }: KeyLikeEvent): boolean => {
  return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta'
}

export const noop = (): void => {}

export const identity = <T>(i: T): T => i

export const isOdd = (number: number): boolean => Math.abs(number) % 2 === 1

export const isEven = (number: number): boolean => Math.abs(number) % 2 === 0

export const isLengthEven = (str = ''): boolean => str.length % 2 === 0

export const snakeToCamel = (name: string): string => {
  return name.replace(/_([a-z])/g, (_match, capture: string) => capture.toUpperCase())
}

export const camelToSnake = (name: string): string => {
  return name.replace(/([A-Z])/g, (_match, capture: string) => `-${capture.toLowerCase()}`)
}

/**
 *  Are two arrays have intersection
 */
export const conflict = (arr1: RangeTuple, arr2: RangeTuple): boolean => {
  return !(arr1[1] < arr2[0] || arr2[1] < arr1[0])
}

export const union = <T>(
  { start: tStart, end: tEnd }: RangeLike,
  { start: lStart, end: lEnd, active }: ActiveRange<T>
): ActiveRange<T> | null => {
  if (!(tEnd <= lStart || lEnd <= tStart)) {
    if (lStart < tStart) {
      return {
        start: tStart,
        end: tEnd < lEnd ? tEnd : lEnd,
        active
      }
    } else {
      return {
        start: lStart,
        end: tEnd < lEnd ? tEnd : lEnd,
        active
      }
    }
  }
  return null
}

// https://github.com/jashkenas/underscore
export const throttle = <T extends AnyFunction>(func: T, wait = 50) => {
  let pendingCall: { context: ThisParameterType<T>, args: Parameters<T> } | null = null
  let result: ReturnType<T> | undefined
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0
  const later = () => {
    previous = Date.now()
    timeout = null
    if (pendingCall) {
      result = func.apply(pendingCall.context, pendingCall.args) as ReturnType<T>
    }
    if (!timeout) {
      pendingCall = null
    }
  }

  return function (this: ThisParameterType<T>, ...nextArgs: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now()
    const remaining = wait - (now - previous)

    pendingCall = { context: this, args: nextArgs }
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      result = func.apply(pendingCall.context, pendingCall.args) as ReturnType<T>
      if (!timeout) {
        pendingCall = null
      }
    } else if (!timeout) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
}

// simple implementation...
export const debounce = <T extends AnyFunction>(func: T, wait = 50) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: Parameters<T>): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export const deepCopyArray = <T>(array: T[]): T[] => {
  const result: T[] = []
  const len = array.length
  let i
  for (i = 0; i < len; i++) {
    result.push(cloneValue(array[i]))
  }
  return result
}

// TODO: @jocs rewrite deepCopy
export const deepCopy = <T>(object: T): T => {
  if (Array.isArray(object)) {
    return deepCopyArray(object) as T
  }

  if (typeof object !== 'object' || object === null) {
    return object
  }

  const obj: CloneableRecord = {}
  Object.keys(object).forEach(key => {
    obj[key] = cloneValue((object as CloneableRecord)[key])
  })
  return obj as T
}

export const loadImage = async (url: string, detectContentType = false): Promise<LoadedImage> => {
  if (detectContentType) {
    const isImage = await checkImageContentType(url)
    if (!isImage) throw new Error('not an image')
  }
  return new Promise<LoadedImage>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve({
        url,
        width: image.width,
        height: image.height
      })
    }
    image.onerror = error => {
      reject(error)
    }
    image.src = url
  })
}

export const isOnline = (): boolean => {
  return navigator.onLine === true
}

export const getPageTitle = (url: string): string | Promise<string> => {
  // No need to request the title when it's not url.
  if (!url.startsWith('http')) {
    return ''
  }
  // No need to request the title when off line.
  if (!isOnline()) {
    return ''
  }

  const req = new XMLHttpRequest()
  let settle!: (value: string) => void
  const promise = new Promise<string>(resolve => {
    settle = resolve
  })
  const handler = () => {
    if (req.readyState === XMLHttpRequest.DONE) {
      if (req.status === 200) {
        const contentType = req.getResponseHeader('Content-Type') ?? ''
        if (/text\/html/.test(contentType)) {
          const { response } = req
          if (typeof response === 'string') {
            const match = response.match(/<title>(.*)<\/title>/)
            return match && match[1] ? settle(match[1]) : settle('')
          }
          return settle('')
        }
        return settle('')
      } else {
        return settle('')
      }
    }
  }
  const handleError = () => {
    settle('')
  }
  req.open('GET', url)
  req.onreadystatechange = handler
  req.onerror = handleError
  req.send()

  // Resolve empty string when `TIMEOUT` passed.
  const timer = new Promise<string>(resolve => {
    setTimeout(() => {
      resolve('')
    }, TIMEOUT)
  })

  return Promise.race([promise, timer])
}

export const checkImageContentType = (url: string): Promise<boolean> => {
  const req = new XMLHttpRequest()
  let settle!: (value: boolean) => void
  const promise = new Promise<boolean>(resolve => {
    settle = resolve
  })
  const handler = () => {
    if (req.readyState === XMLHttpRequest.DONE) {
      if (req.status === 200) {
        const contentType = req.getResponseHeader('Content-Type') ?? ''
        if (/^image\/(?:jpeg|png|gif|svg\+xml|webp)$/.test(contentType)) {
          settle(true)
        } else {
          settle(false)
        }
      } else if (req.status === 405) { // status 405 means method not allowed, and just return true.(Solve issue#1297)
        settle(true)
      } else {
        settle(false)
      }
    }
  }
  const handleError = () => {
    settle(false)
  }
  req.open('HEAD', url)
  req.onreadystatechange = handler
  req.onerror = handleError
  req.send()

  return promise
}

/**
 * Return image information and correct the relative image path if needed.
 *
 * @param {string} src Image url
 * @param {string} baseUrl Base path; used on desktop to fix the relative image path.
 */
export const getImageInfo = (src: string, baseUrl = window.DIRNAME): ImageInfo => {
  const imageExtension = IMAGE_EXT_REG.test(src)
  const isUrl = URL_REG.test(src) || (imageExtension && /^file:\/\/.+/.test(src))

  // Treat an URL with valid extension as image.
  if (imageExtension) {
    // NOTE: Check both "C:\" and "C:/" because we're using "file:///C:/".
    const isAbsoluteLocal = /^(?:\/|\\\\|[a-zA-Z]:\\|[a-zA-Z]:\/).+/.test(src)

    if (isUrl || (!isAbsoluteLocal && !baseUrl)) {
      if (!isUrl && !baseUrl) {
        console.warn('"baseUrl" is not defined!')
      }

      return {
        isUnknownType: false,
        src
      }
    } else {
      // Correct relative path on desktop. If we resolve a absolute path "path.resolve" doesn't do anything.
      // NOTE: We don't need to convert Windows styled path to UNIX style because Chromium handels this internal.
      return {
        isUnknownType: false,
        src: 'file://' + path.resolve(baseUrl, src)
      }
    }
  } else if (isUrl && !imageExtension) {
    // Assume it's a valid image and make a http request later
    return {
      isUnknownType: true,
      src
    }
  }

  // Data url
  if (DATA_URL_REG.test(src)) {
    return {
      isUnknownType: false,
      src
    }
  }

  // Url type is unknown
  return {
    isUnknownType: false,
    src: ''
  }
}

export const escapeHTML = (str: string): string =>
  str.replace(/[&<>'"]/g, tag => HTML_TAG_REPLACEMENTS[tag] || tag)

export const unescapeHTML = (str: string): string =>
  str.replace(/(?:&amp;|&lt;|&gt;|&quot;|&#39;)/g, tag => HTML_TAG_UNESCAPE_REPLACEMENTS[tag] || tag)

export const escapeInBlockHtml = (html: string): string => {
  return html
    .replace(/(<(style|script|title)[^<>]*>)([\s\S]*?)(<\/\2>)/g, (_match, p1: string, _p2: string, p3: string, p4: string) => {
      return `${escapeHTML(p1)}${p3}${escapeHTML(p4)}`
    })
}

export const escapeHtmlTags = (html: string): string => {
  return html.replace(/[&<>"']/g, x => { return HTML_TAG_REPLACEMENTS[x] })
}

export const wordCount = (markdown: string): WordCountResult => {
  const paragraph = markdown.split(/\n{2,}/).filter(line => line).length
  let word = 0
  let character = 0
  let all = 0

  const removedChinese = markdown.replace(/[\u4e00-\u9fa5]/g, '')
  const tokens = removedChinese.split(/[\s\n]+/).filter(t => t)
  const chineseWordLength = markdown.length - removedChinese.length
  word += chineseWordLength + tokens.length
  character += tokens.reduce((acc, t) => acc + t.length, 0) + chineseWordLength
  all += markdown.length

  return { word, paragraph, character, all }
}

// mixins
export const mixins = (constructor: { prototype: object }, ...object: object[]): object => {
  return Object.assign(constructor.prototype, ...object)
}

export const sanitize = (html: string, purifyOptions?: unknown, disableHtml?: boolean): string => {
  if (disableHtml) {
    return sanitizeHtml(escapeHtmlTags(html), purifyOptions)
  } else {
    return sanitizeHtml(escapeInBlockHtml(html), purifyOptions)
  }
}

export const getParagraphReference = (ele: Element, id: string): ParagraphReferenceLike => {
  const { x, y, left, top, bottom, height } = ele.getBoundingClientRect()
  return {
    getBoundingClientRect () {
      return { x, y, left, top, bottom, height, width: 0, right: left }
    },
    clientWidth: 0,
    clientHeight: height,
    id
  }
}

export const verticalPositionInRect = (
  event: Pick<MouseEvent, 'clientY'>,
  rect: Pick<DOMRect, 'top' | 'height'>
): 'down' | 'up' => {
  const { clientY } = event
  const { top, height } = rect
  return (clientY - top) > (height / 2) ? 'down' : 'up'
}

export const collectFootnotes = <T extends BlockLike>(blocks: Iterable<T>): Map<string, T> => {
  const map = new Map<string, T>()
  for (const block of blocks) {
    if (block.type === 'figure' && block.functionType === 'footnote') {
      const footnoteBlock = block as T & { children: Array<{ text: string }> }
      const identifier = footnoteBlock.children[0].text
      map.set(identifier, block)
    }
  }

  return map
}

export const getDefer = <T = unknown> (): Deferred<T> => {
  const defer = {} as Deferred<T>
  const promise = new Promise<T>((resolve, reject) => {
    defer.resolve = resolve
    defer.reject = reject
  })
  defer.promise = promise

  return defer
}

/**
 * Deep clone the given object.
 *
 * @param {*} obj Object to clone
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj)) as T
}
