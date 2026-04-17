/**
 * Helpers
 */

let uniqueIdCounter = 0

export const getUniqueId = (): number => ++uniqueIdCounter

type EscapeFn = ((html: string, encode?: boolean) => string) & {
  escapeTest: RegExp
  escapeReplace: RegExp
  replacements: Record<string, string>
  escapeTestNoEncode: RegExp
  escapeReplaceNoEncode: RegExp
}

export const escape: EscapeFn = function escape (html: string, encode = false): string {
  if (encode) {
    if (escape.escapeTest.test(html)) {
      return html.replace(escape.escapeReplace, ch => escape.replacements[ch])
    }
  } else if (escape.escapeTestNoEncode.test(html)) {
    return html.replace(escape.escapeReplaceNoEncode, ch => escape.replacements[ch])
  }

  return html
} as EscapeFn

escape.escapeTest = /[&<>"']/
escape.escapeReplace = /[&<>"']/g
escape.replacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

escape.escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/
escape.escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g

export const unescape = (html: string): string => {
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, (_match, rawName: string) => {
    const name = rawName.toLowerCase()
    if (name === 'colon') return ':'
    if (name.charAt(0) === '#') {
      return name.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(name.substring(2), 16))
        : String.fromCharCode(+name.substring(1))
    }
    return ''
  })
}

interface EditableRegex {
  replace(name: string | RegExp, value: string | RegExp): EditableRegex
  getRegex(): RegExp
}

export const edit = (regex: string | RegExp, opt = ''): EditableRegex => {
  let source = typeof regex === 'string' ? regex : regex.source
  return {
    replace (name: string | RegExp, value: string | RegExp) {
      const pattern = typeof name === 'string' ? name : name.source
      let nextValue = typeof value === 'string' ? value : value.source
      nextValue = nextValue.replace(/(^|[^\[])\^/g, '$1')
      source = source.replace(pattern, nextValue)
      return this
    },
    getRegex () {
      return new RegExp(source, opt)
    }
  }
}

const baseUrls: Record<string, string> = {}
const originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i

const resolveUrl = (base: string, href: string): string => {
  const cacheKey = ` ${base}`
  if (!baseUrls[cacheKey]) {
    if (/^[^:]+:\/*[^/]*$/.test(base)) {
      baseUrls[cacheKey] = `${base}/`
    } else {
      baseUrls[cacheKey] = rtrim(base, '/', true)
    }
  }

  const normalizedBase = baseUrls[cacheKey]
  const relativeBase = normalizedBase.indexOf(':') === -1

  if (href.slice(0, 2) === '//') {
    if (relativeBase) {
      return href
    }
    return normalizedBase.replace(/^([^:]+:)[\s\S]*$/, '$1') + href
  } else if (href.charAt(0) === '/') {
    if (relativeBase) {
      return href
    }
    return normalizedBase.replace(/^([^:]+:\/*[^/]*)[\s\S]*$/, '$1') + href
  }

  return normalizedBase + href
}

export const cleanUrl = (sanitizeInput: boolean, base: string | null, href: string): string | null => {
  if (sanitizeInput) {
    let prot = ''
    try {
      prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase()
    } catch (_) {
      return null
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
      return null
    }
  }

  let nextHref = href
  if (base && !originIndependentUrl.test(nextHref)) {
    nextHref = resolveUrl(base, nextHref)
  }
  try {
    nextHref = encodeURI(nextHref).replace(/%25/g, '%')
  } catch (_) {
    return null
  }
  return nextHref
}

export const noop = (() => {}) as (() => void) & { exec: () => void }
noop.exec = noop

export const splitCells = (tableRow: string, count: number): string[] => {
  const row = tableRow.replace(/\|/g, (match, offset, str) => {
    let escaped = false
    let current = offset
    while (--current >= 0 && str[current] === '\\') escaped = !escaped
    return escaped ? '|' : ' |'
  })

  const cells = row.split(/ \|/)
  if (cells.length > count) {
    cells.splice(count)
  } else {
    while (cells.length < count) {
      cells.push('')
    }
  }

  for (let i = 0; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(/\\\|/g, '|')
  }
  return cells
}

export const rtrim = (str: string, c: string, invert = false): string => {
  if (str.length === 0) {
    return ''
  }

  let suffixLength = 0
  while (suffixLength < str.length) {
    const currentChar = str.charAt(str.length - suffixLength - 1)
    if (currentChar === c && !invert) {
      suffixLength++
    } else if (currentChar !== c && invert) {
      suffixLength++
    } else {
      break
    }
  }

  return str.substr(0, str.length - suffixLength)
}

export const findClosingBracket = (str: string, brackets: string): number => {
  if (str.indexOf(brackets[1]) === -1) {
    return -1
  }

  let level = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') {
      i++
    } else if (str[i] === brackets[0]) {
      level++
    } else if (str[i] === brackets[1]) {
      level--
      if (level < 0) {
        return i
      }
    }
  }
  return -1
}
