import Renderer from './renderer'
import Lexer from './lexer'
import Parser from './parser'
import options from './options'

interface MarkedOptions {
  silent?: boolean
  [key: string]: unknown
}

type MarkedError = Error & {
  message: string
}

const escapeHtml = (value: string): string => {
  return value.replace(/[&<>"']/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[tag] ?? tag))
}

function marked (src: string, opt: MarkedOptions = {}): string {
  if (typeof src === 'undefined' || src === null) {
    throw new Error('marked(): input parameter is undefined or null')
  }
  if (typeof src !== 'string') {
    throw new Error(`marked(): input parameter is of type ${Object.prototype.toString.call(src)}, string expected`)
  }

  try {
    const mergedOptions = Object.assign({}, options, opt) as MarkedOptions
    return new Parser(mergedOptions).parse(new Lexer(mergedOptions).lex(src))
  } catch (error) {
    const markedError = error as MarkedError
    markedError.message += '\nPlease report this to https://github.com/marktext/marktext/issues.'
    if (opt.silent) {
      return `<p>An error occurred:</p><pre>${escapeHtml(String(markedError.message))}</pre>`
    }
    throw markedError
  }
}

export {
  Renderer, Lexer, Parser
}

export default marked
