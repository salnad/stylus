export interface CancelablePromise<T> extends Promise<T> {
  cancel: () => void
}

export interface CodeMirrorCursorLike {
  line: number
  ch: number
}

export const delay = (time: number): CancelablePromise<void> => {
  let timerId: NodeJS.Timeout | null = null
  let rejectFn: ((reason?: unknown) => void) | null = null
  let cancel = (): void => {}

  const promise = new Promise<void>((resolve, reject) => {
    rejectFn = reject
    timerId = setTimeout(() => {
      cancel = (): void => {}
      rejectFn = null
      resolve()
    }, time)
  }) as CancelablePromise<void>

  cancel = (): void => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
    if (rejectFn) {
      rejectFn(new Error('Cancelled'))
      rejectFn = null
    }
  }

  promise.cancel = cancel
  return promise
}

const ID_PREFIX = 'mt-'
let id = 0

export const serialize = (params: Record<string, string | number | boolean>): string => {
  return Object.keys(params).map(key => `${key}=${encodeURI(String(params[key]))}`).join('&')
}

export const merge = <T extends Record<string, unknown>> (...args: Partial<T>[]): T => {
  return Object.assign({}, ...args) as T
}

export const dataURItoBlob = (dataURI: string): Blob => {
  const data = dataURI.split(';base64,')
  const byte = window.atob(data[1])
  const mime = data[0].split(':')[1]
  const ab = new ArrayBuffer(byte.length)
  const ia = new Uint8Array(ab)
  const len = byte.length
  for (let i = 0; i < len; i++) {
    ia[i] = byte.charCodeAt(i)
  }
  return new window.Blob([ab], { type: mime })
}

export const adjustCursor = (
  cursor: CodeMirrorCursorLike,
  preline?: string,
  line = '',
  nextline?: string
): CodeMirrorCursorLike | null => {
  let newCursor: CodeMirrorCursorLike | null = {
    line: cursor.line,
    ch: cursor.ch
  }

  if (/\|[^|]+\|.+\|\s*$/.test(line)) {
    if (/\|\s*:?-+:?\s*\|[:-\s|]+\|\s*$/.test(line)) {
      if (typeof nextline === 'string') {
        newCursor.line += 1
        newCursor.ch = nextline.indexOf('|') + 1
      }
    } else {
      if (cursor.ch <= line.indexOf('|')) newCursor.ch = line.indexOf('|') + 1
      if (cursor.ch >= line.lastIndexOf('|')) newCursor.ch = line.lastIndexOf('|') - 1
    }
  }

  if (/```[\S]*/.test(line) || /^\$\$$/.test(line)) {
    if (typeof nextline === 'string' && /\S/.test(nextline)) {
      newCursor.line += 1
      newCursor.ch = 0
    } else if (typeof preline === 'string' && /\S/.test(preline)) {
      newCursor.line -= 1
      newCursor.ch = preline.length
    }
  }

  if (/[*+-]\s.+/.test(line) && newCursor.ch <= 1) {
    newCursor.ch = 2
  }

  if (!/\S/.test(line) || /<\/?([a-zA-Z\d-]+)(?=\s|>).*>/.test(line)) {
    newCursor = null
  }
  return newCursor
}

export const animatedScrollTo = (
  element: HTMLElement,
  to: number,
  duration: number,
  callback?: () => void
): void => {
  const start = element.scrollTop
  const change = to - start
  const animationStart = +new Date()

  if (Math.abs(change) <= 6 || duration === 0) {
    element.scrollTop = to
    return
  }

  const easeInOutQuad = (t: number, b: number, c: number, d: number): number => {
    t /= d / 2
    if (t < 1) return (c / 2) * t * t + b
    t--
    return (-c / 2) * (t * (t - 2) - 1) + b
  }

  const animateScroll = (): void => {
    const now = +new Date()
    const val = Math.floor(easeInOutQuad(now - animationStart, start, change, duration))

    element.scrollTop = val

    if (now > animationStart + duration) {
      element.scrollTop = to
      if (callback) {
        callback()
      }
    } else {
      requestAnimationFrame(animateScroll)
    }
  }

  requestAnimationFrame(animateScroll)
}

export const getUniqueId = (): string => {
  return `${ID_PREFIX}${id++}`
}

export const hasKeys = (obj: Record<string, unknown>): boolean => Object.keys(obj).length > 0

/**
 * @deprecated Use cloneObject or deepClone.
 */
export const cloneObj = <T> (obj: T, deepCopy = true): T => {
  return deepCopy ? JSON.parse(JSON.stringify(obj)) as T : Object.assign({}, obj)
}

export const cloneObject = <T extends object> (obj: T, inheritFromObject = true): T => {
  return Object.assign(inheritFromObject ? {} : Object.create(null), obj)
}

export const deepClone = <T> (obj: T): T => {
  return JSON.parse(JSON.stringify(obj)) as T
}

export const isOsx = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'
