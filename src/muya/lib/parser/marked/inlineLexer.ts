import Renderer from './renderer'
import { normal, breaks, gfm, pedantic } from './inlineRules'
import defaultOptions, { type MarkedOptions } from './options'
import { escape, findClosingBracket, getUniqueId, rtrim } from './utils'
import { validateEmphasize, lowerPriority } from '../utils'

type InlineRuleSet = typeof normal
type HighPriorityRuleMap = Record<string, RegExp>

interface FootnoteInfo {
  footnoteId?: string | number | null
  footnoteIdentifierId?: string | number | null
  order?: string | number
}

interface LinkData {
  href: string
  title?: string | null
}

interface InlineRenderer {
  options: unknown
  footnoteIdentifier(identifier: string, footnoteInfo: FootnoteInfo): string
  html(html: string): string
  inlineMath(text: string): string
  emoji(text: string, emoji: string): string
  script(content: string, marker: string): string
  strong(text: string): string
  em(text: string): string
  codespan(text: string): string
  br(): string
  del(text: string): string
  link(href: string, title: string | null, text: string): string
  image(href: string, title: string | null, text: string): string
  text(text: string): string
}

type InlineLexerOptions = MarkedOptions & { renderer?: InlineRenderer | null }
type LinksMap = Record<string, LinkData>
type FootnotesMap = Record<string, FootnoteInfo>

interface InlineLexerInstance {
  options: InlineLexerOptions
  links: LinksMap
  footnotes: FootnotesMap
  rules: InlineRuleSet
  renderer: InlineRenderer
  highPriorityEmpRules: HighPriorityRuleMap
  highPriorityLinkRules: HighPriorityRuleMap
  inLink?: boolean
  inRawBlock?: boolean
  output(src: string): string
  escapes(text: string | null | undefined): string | null | undefined
  outputLink(cap: RegExpExecArray, link: LinkData): string
  smartypants(text: string): string
  mangle(text: string): string
}

type InlineLexerConstructor = {
  new (
    links: LinksMap,
    footnotes: FootnotesMap,
    options?: InlineLexerOptions | null
  ): InlineLexerInstance
  prototype: InlineLexerInstance
}

type ExecutableRule = {
  exec: (src: string) => RegExpExecArray | null | void
}

const execRule = (rule: unknown, src: string): RegExpExecArray | null => {
  const match = (rule as ExecutableRule).exec(src)
  return Array.isArray(match) ? match : null
}

const InlineLexer = function InlineLexer (
  this: InlineLexerInstance,
  links: LinksMap,
  footnotes: FootnotesMap,
  options?: InlineLexerOptions | null
) {
  this.options = (options || defaultOptions) as InlineLexerOptions
  this.links = links
  this.footnotes = footnotes
  this.rules = normal
  this.renderer = (this.options.renderer || new Renderer()) as InlineRenderer
  this.renderer.options = this.options

  if (!this.links) {
    throw new Error('Tokens array requires a `links` property.')
  }

  if (this.options.pedantic) {
    this.rules = pedantic
  } else if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = breaks
    } else {
      this.rules = gfm
    }
  }
  this.highPriorityEmpRules = {}
  this.highPriorityLinkRules = {}
  for (const key of Object.keys(this.rules)) {
    const rule = this.rules[key as keyof InlineRuleSet]
    if (/^(?:autolink|link|code|tag)$/.test(key) && rule instanceof RegExp) {
      this.highPriorityEmpRules[key] = rule
    }
  }
  for (const key of Object.keys(this.rules)) {
    const rule = this.rules[key as keyof InlineRuleSet]
    if (/^(?:autolink|code|tag)$/.test(key) && rule instanceof RegExp) {
      this.highPriorityLinkRules[key] = rule
    }
  }
} as unknown as InlineLexerConstructor

InlineLexer.prototype.output = function (this: InlineLexerInstance, src: string): string {
  // src = src
  // .replace(/\u00a0/g, ' ')
  const { disableInline, emoji, math, superSubScript, footnote } = this.options
  if (disableInline) {
    return escape(src)
  }

  let out = ''
  let text = ''
  let href = ''
  let title = ''
  let prevCapZero = ''
  let lastChar = ''

  while (src) {
    // escape
    let cap = execRule(this.rules.escape, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += escape(cap[1])
      continue
    }

    // footnote identifier
    if (footnote) {
      cap = execRule(this.rules.footnoteIdentifier, src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        const identifier = cap[1]

        const footnoteInfo = this.footnotes[identifier] || {}
        if (footnoteInfo.footnoteIdentifierId === undefined) {
          footnoteInfo.footnoteIdentifierId = getUniqueId()
        }

        out += this.renderer.footnoteIdentifier(identifier, footnoteInfo)
      }
    }

    // tag
    cap = execRule(this.rules.tag, src)
    if (cap) {
      if (!this.inLink && /^<a /i.test(cap[0])) {
        this.inLink = true
      } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
        this.inLink = false
      }
      if (!this.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
        this.inRawBlock = true
      } else if (this.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
        this.inRawBlock = false
      }

      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.html(this.options.sanitize
        ? (this.options.sanitizer
          ? this.options.sanitizer(cap[0])
          : escape(cap[0]))
        : cap[0])
      continue
    }

    // link
    cap = execRule(this.rules.link, src)
    if (cap && lowerPriority(src, cap[0].length, this.highPriorityLinkRules)) {
      const trimmedUrl = cap[2].trim()
      if (!this.options.pedantic && trimmedUrl.startsWith('<')) {
        // commonmark requires matching angle brackets
        if (!trimmedUrl.endsWith('>')) {
          return undefined as unknown as string
        }

        // ending angle bracket cannot be escaped
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), '\\')
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return undefined as unknown as string
        }
      } else {
        // find closing parenthesis
        const lastParenIndex = findClosingBracket(cap[2], '()')
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf('!') === 0 ? 5 : 4
          const linkLen = start + cap[1].length + lastParenIndex
          cap[2] = cap[2].substring(0, lastParenIndex)
          cap[0] = cap[0].substring(0, linkLen).trim()
          cap[3] = ''
        }
      }
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      href = cap[2]
      if (this.options.pedantic) {
        // split pedantic href and title
        const linkMatch = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href)

        if (linkMatch) {
          href = linkMatch[1]
          title = linkMatch[3]
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : ''
      }
      href = href.trim()
      if (href.startsWith('<')) {
        if (this.options.pedantic && !trimmedUrl.endsWith('>')) {
          // pedantic allows starting angle bracket without ending angle bracket
          href = href.slice(1)
        } else {
          href = href.slice(1, -1)
        }
      }

      this.inLink = true
      out += this.outputLink(cap, {
        href: this.escapes(href) as string,
        title: this.escapes(title)
      })
      this.inLink = false
      continue
    }

    // reflink, nolink
    cap = execRule(this.rules.reflink, src) || execRule(this.rules.nolink, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      const linkKey = (cap[2] || cap[1]).replace(/\s+/g, ' ')
      const link = this.links[linkKey.toLowerCase()]
      if (!link || !link.href) {
        out += cap[0].charAt(0)
        src = cap[0].substring(1) + src
        continue
      }
      this.inLink = true
      out += this.outputLink(cap, link)
      this.inLink = false
      continue
    }

    // math
    if (math) {
      cap = execRule(this.rules.math, src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        text = cap[1]
        out += this.renderer.inlineMath(text)
      }
    }

    // emoji
    if (emoji) {
      cap = execRule(this.rules.emoji, src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        text = cap[0]
        out += this.renderer.emoji(text, cap[2])
      }
    }

    // superSubScript
    if (superSubScript) {
      cap = execRule(this.rules.superscript, src) || execRule(this.rules.subscript, src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        const content = cap[2]
        const marker = cap[1]
        out += this.renderer.script(content, marker)
      }
    }

    // strong
    cap = execRule(this.rules.strong, src)
    if (cap) {
      const marker = cap[0].match(/^(?:_{1,2}|\*{1,2})/)?.[0] || ''
      const isValid = validateEmphasize(src, cap[0].length, marker, lastChar, this.highPriorityEmpRules)
      if (isValid) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        out += this.renderer.strong(this.output(cap[4] || cap[3] || cap[2] || cap[1]))
        continue
      }
    }

    // em
    cap = execRule(this.rules.em, src)
    if (cap) {
      const marker = cap[0].match(/^(?:_{1,2}|\*{1,2})/)?.[0] || ''
      const isValid = validateEmphasize(src, cap[0].length, marker, lastChar, this.highPriorityEmpRules)
      if (isValid) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        out += this.renderer.em(this.output(cap[6] || cap[5] || cap[4] || cap[3] || cap[2] || cap[1]))
        continue
      }
    }

    // code
    cap = execRule(this.rules.code, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)

      let codeText = cap[2].replace(/\n/g, ' ')
      const hasNonSpaceChars = /[^ ]/.test(codeText)
      const hasSpaceCharsOnBothEnds = codeText.startsWith(' ') && codeText.endsWith(' ')
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        codeText = codeText.substring(1, codeText.length - 1)
      }
      codeText = escape(codeText, true)
      out += this.renderer.codespan(codeText)
      continue
    }

    // br
    cap = execRule(this.rules.br, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.br()
      continue
    }

    // del (gfm)
    cap = execRule(this.rules.del, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.del(this.output(cap[2]))
      continue
    }

    // autolink
    cap = execRule(this.rules.autolink, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      if (cap[2] === '@') {
        text = escape(this.mangle(cap[1]))
        href = 'mailto:' + text
      } else {
        text = escape(cap[1])
        href = text
      }
      out += this.renderer.link(href, null, text)
      continue
    }

    // url (gfm)
    cap = execRule(this.rules.url, src)
    if (!this.inLink && cap) {
      if (cap[2] === '@') {
        text = escape(cap[0])
        href = 'mailto:' + text
      } else {
        // do extended autolink path validation
        do {
          prevCapZero = cap[0]
          cap[0] = execRule(this.rules._backpedal, cap[0])?.[0] || cap[0]
        } while (prevCapZero !== cap[0])
        text = escape(cap[0])
        if (cap[1] === 'www.') {
          href = 'http://' + text
        } else {
          href = text
        }
      }
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.link(href, null, text)
      continue
    }

    // text
    cap = execRule(this.rules.text, src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      if (this.inRawBlock) {
        out += this.renderer.text(this.options.sanitize ? (this.options.sanitizer ? this.options.sanitizer(cap[0]) : escape(cap[0])) : cap[0])
      } else {
        out += this.renderer.text(escape(this.smartypants(cap[0])))
      }
      continue
    }

    if (src) {
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }

  return out
}

InlineLexer.prototype.escapes = function (this: InlineLexerInstance, text: string | null | undefined): string | null | undefined {
  return text ? text.replace(this.rules._escapes, '$1') : text
}

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function (this: InlineLexerInstance, cap: RegExpExecArray, link: LinkData): string {
  const href = link.href
  const title = link.title ? escape(link.title) : null
  const text = cap[1].replace(/\\([\[\]])/g, '$1') // eslint-disable-line no-useless-escape

  return cap[0].charAt(0) !== '!'
    ? this.renderer.link(href, title, this.output(text))
    : this.renderer.image(href, title, escape(text))
}

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function (this: InlineLexerInstance, text: string): string {
  /* eslint-disable no-useless-escape */
  if (!this.options.smartypants) return text
  return text
    // em-dashes
    .replace(/---/g, '\u2014')
    // en-dashes
    .replace(/--/g, '\u2013')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026')
  /* eslint-ensable no-useless-escape */
}

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function (this: InlineLexerInstance, text: string): string {
  if (!this.options.mangle) return text
  const l = text.length
  let out = ''
  let ch: number | string

  for (let i = 0; i < l; i++) {
    ch = text.charCodeAt(i)
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16)
    }
    out += '&#' + ch + ';'
  }

  return out
}

export default InlineLexer
