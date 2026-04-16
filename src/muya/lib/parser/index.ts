import { beginRules, inlineRules, inlineExtensionRules } from './rules'
import { isLengthEven, union } from '../utils'
import { findClosingBracket } from './marked/utils'
import { getAttributes, parseSrcAndTitle, validateEmphasize, lowerPriority } from './utils'

interface Range {
  start: number
  end: number
}

interface HighlightRange extends Range {
  active: boolean | undefined
}

interface TokenizerOptions {
  disableHtml?: boolean
  superSubScript?: boolean
  footnote?: boolean
  [key: string]: unknown
}

interface TokenizerConfig {
  highlights?: HighlightRange[]
  hasBeginRules?: boolean
  labels?: Map<string, unknown>
  options?: TokenizerOptions
}

interface ParsedSrcAndTitle {
  src: string
  title: string
}

type RuleMap = Record<string, RegExp>
type AttributeMap = Record<string, string>

interface Token {
  type: string
  raw: string
  parent: Token[]
  range: Range
  marker?: string
  content?: string
  children?: Token[] | ''
  highlights?: HighlightRange[]
  attrs?: AttributeMap
  backlash?: string | {
    first: string
    second: string
  }
  [key: string]: unknown
}

type RawToken = Pick<Token, 'raw'>

const beginRuleSet = beginRules as RuleMap
const inlineRuleSet = inlineRules as RuleMap
const inlineExtensionRuleSet = inlineExtensionRules as RuleMap
const findClosingBracketFn = findClosingBracket as (str: string, b: string) => number
const getAttributesFn = getAttributes as (html: string) => AttributeMap | null
const parseSrcAndTitleFn = parseSrcAndTitle as (text?: string) => ParsedSrcAndTitle
const validateEmphasizeFn = validateEmphasize as (
  src: string,
  offset: number,
  marker: string,
  pending: string,
  rules: RuleMap
) => boolean
const lowerPriorityFn = lowerPriority as (src: string, offset: number, rules: RuleMap) => boolean

// const CAN_NEST_RULES = ['strong', 'em', 'link', 'del', 'a_link', 'reference_link', 'html_tag']
// disallowed html tags in https://github.github.com/gfm/#raw-html
const disallowedHtmlTag = /(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)/i
const validateRules = Object.assign({}, inlineRuleSet) as RuleMap
delete validateRules.em
delete validateRules.strong
delete validateRules.tail_header
delete validateRules.backlash

const correctUrl = (token: RegExpExecArray | null): void => {
  if (token && typeof token[4] === 'string') {
    const lastParenIndex = findClosingBracketFn(token[4], '()')

    if (lastParenIndex > -1) {
      const len = token[0].length - (token[4].length - lastParenIndex)
      token[0] = token[0].substring(0, len)
      const originSrc = token[4].substring(0, lastParenIndex)
      const match = /(\\+)$/.exec(originSrc)
      if (match) {
        token[4] = originSrc.substring(0, originSrc.length - match[1].length)
        token[5] = match[1]
      } else {
        token[4] = originSrc
        token[5] = ''
      }
    }
  }
}

const matchHtmlTag = (src: string, disableHtml?: boolean): RegExpExecArray | null => {
  const match = inlineRuleSet.html_tag.exec(src) as RegExpExecArray | null
  if (!match) {
    return null
  }

  // Ignore HTML tag when HTML rendering is disabled and import it as plain text.
  // NB: We have to allow img tag to support image resizer and options.
  if (disableHtml && (!match[3] || !/^img$/i.test(match[3]))) {
    return null
  }
  return match
}

const tokenizerFac = (
  src: string,
  beginRuleMap: RuleMap | null | undefined,
  inlineRuleMap: RuleMap,
  pos = 0,
  top: boolean | undefined,
  labels: Map<string, unknown>,
  options: TokenizerOptions = {}
): Token[] => {
  const originSrc = src
  const tokens: Token[] = []
  let pending = ''
  let pendingStartPos = pos
  const { disableHtml, superSubScript, footnote } = options
  const pushPending = (): void => {
    if (pending) {
      tokens.push({
        type: 'text',
        raw: pending,
        content: pending,
        parent: tokens,
        range: {
          start: pendingStartPos,
          end: pos
        }
      })
    }

    pendingStartPos = pos
    pending = ''
  }

  if (beginRuleMap && pos === 0) {
    const beginRuleList = ['header', 'hr', 'code_fense', 'multiple_math']

    for (const ruleName of beginRuleList) {
      const to = beginRuleMap[ruleName].exec(src) as RegExpExecArray | null

      if (to) {
        const token: Token = {
          type: ruleName,
          raw: to[0],
          parent: tokens,
          marker: to[1],
          content: to[2] || '',
          backlash: to[3] || '',
          range: {
            start: pos,
            end: pos + to[0].length
          }
        }
        tokens.push(token)
        src = src.substring(to[0].length)
        pos = pos + to[0].length
        break
      }
    }
    const def = beginRuleMap.reference_definition.exec(src) as RegExpExecArray | null
    if (def && isLengthEven(def[3])) {
      const token: Token = {
        type: 'reference_definition',
        parent: tokens,
        leftBracket: def[1],
        label: def[2],
        backlash: def[3] || '',
        rightBracket: def[4],
        leftHrefMarker: def[5] || '',
        href: def[6],
        rightHrefMarker: def[7] || '',
        leftTitlespace: def[8],
        titleMarker: def[9] || '',
        title: def[10] || '',
        rightTitleSpace: def[11] || '',
        raw: def[0],
        range: {
          start: pos,
          end: pos + def[0].length
        }
      }
      tokens.push(token)
      src = src.substring(def[0].length)
      pos = pos + def[0].length
    }
  }

  while (src.length) {
    // backlash
    const backTo = inlineRuleMap.backlash.exec(src) as RegExpExecArray | null
    if (backTo) {
      pushPending()
      tokens.push({
        type: 'backlash',
        raw: backTo[1],
        marker: backTo[1],
        parent: tokens,
        content: '',
        range: {
          start: pos,
          end: pos + backTo[1].length
        }
      })
      pending += pending + backTo[2]
      pendingStartPos = pos + backTo[1].length
      src = src.substring(backTo[0].length)
      pos = pos + backTo[0].length
      continue
    }
    // strong | em
    const emRules = ['strong', 'em']
    let inChunk = false
    for (const rule of emRules) {
      const to = inlineRuleMap[rule].exec(src) as RegExpExecArray | null
      if (to && isLengthEven(to[3])) {
        const isValid = validateEmphasizeFn(src, to[0].length, to[1], pending, validateRules)
        if (isValid) {
          inChunk = true
          pushPending()
          const range = {
            start: pos,
            end: pos + to[0].length
          }
          const marker = to[1]
          tokens.push({
            type: rule,
            raw: to[0],
            range,
            marker,
            parent: tokens,
            children: tokenizerFac(to[2], undefined, inlineRuleMap, pos + to[1].length, false, labels, options),
            backlash: to[3]
          })
          src = src.substring(to[0].length)
          pos = pos + to[0].length
        }
        break
      }
    }
    if (inChunk) continue

    // strong | em | emoji | inline_code | del | inline_math
    const chunks = ['inline_code', 'del', 'emoji', 'inline_math']
    for (const rule of chunks) {
      const to = inlineRuleMap[rule].exec(src) as RegExpExecArray | null
      if (to && isLengthEven(to[3])) {
        if (rule === 'emoji' && !lowerPriorityFn(src, to[0].length, validateRules)) break
        inChunk = true
        pushPending()
        const range = {
          start: pos,
          end: pos + to[0].length
        }
        const marker = to[1]
        if (rule === 'inline_code' || rule === 'emoji' || rule === 'inline_math') {
          tokens.push({
            type: rule,
            raw: to[0],
            range,
            marker,
            parent: tokens,
            content: to[2],
            backlash: to[3]
          })
        } else {
          tokens.push({
            type: rule,
            raw: to[0],
            range,
            marker,
            parent: tokens,
            children: tokenizerFac(to[2], undefined, inlineRuleMap, pos + to[1].length, false, labels, options),
            backlash: to[3]
          })
        }
        src = src.substring(to[0].length)
        pos = pos + to[0].length
        break
      }
    }
    if (inChunk) continue
    // superscript and subscript
    if (superSubScript) {
      const superSubTo = (inlineRuleMap.superscript.exec(src) || inlineRuleMap.subscript.exec(src)) as RegExpExecArray | null
      if (superSubTo) {
        pushPending()
        tokens.push({
          type: 'super_sub_script',
          raw: superSubTo[0],
          marker: superSubTo[1],
          range: {
            start: pos,
            end: pos + superSubTo[0].length
          },
          parent: tokens,
          content: superSubTo[2]
        })
        src = src.substring(superSubTo[0].length)
        pos = pos + superSubTo[0].length
        continue
      }
    }

    // footnote identifier
    if (pos !== 0 && footnote) {
      const footnoteTo = inlineRuleMap.footnote_identifier.exec(src) as RegExpExecArray | null
      if (footnoteTo) {
        pushPending()
        tokens.push({
          type: 'footnote_identifier',
          raw: footnoteTo[0],
          marker: footnoteTo[1],
          range: {
            start: pos,
            end: pos + footnoteTo[0].length
          },
          parent: tokens,
          content: footnoteTo[2]
        })
        src = src.substring(footnoteTo[0].length)
        pos = pos + footnoteTo[0].length
        continue
      }
    }
    // image
    const imageTo = inlineRuleMap.image.exec(src) as RegExpExecArray | null
    correctUrl(imageTo)
    if (imageTo && isLengthEven(imageTo[3]) && isLengthEven(imageTo[5])) {
      const { src: imageSrc, title } = parseSrcAndTitleFn(imageTo[4])
      pushPending()
      tokens.push({
        type: 'image',
        raw: imageTo[0],
        marker: imageTo[1],
        srcAndTitle: imageTo[4],
        // This `attrs` used for render image.
        attrs: {
          src: imageSrc + encodeURI(imageTo[5]),
          title,
          alt: imageTo[2] + encodeURI(imageTo[3])
        },
        src: imageSrc,
        title,
        parent: tokens,
        range: {
          start: pos,
          end: pos + imageTo[0].length
        },
        alt: imageTo[2],
        backlash: {
          first: imageTo[3],
          second: imageTo[5]
        }
      })
      src = src.substring(imageTo[0].length)
      pos = pos + imageTo[0].length
      continue
    }
    // link
    const linkTo = inlineRuleMap.link.exec(src) as RegExpExecArray | null
    correctUrl(linkTo)
    if (linkTo && isLengthEven(linkTo[3]) && isLengthEven(linkTo[5])) {
      const { src: href, title } = parseSrcAndTitleFn(linkTo[4])
      pushPending()
      tokens.push({
        type: 'link',
        raw: linkTo[0],
        marker: linkTo[1],
        hrefAndTitle: linkTo[4],
        href,
        title,
        parent: tokens,
        anchor: linkTo[2],
        range: {
          start: pos,
          end: pos + linkTo[0].length
        },
        children: tokenizerFac(linkTo[2], undefined, inlineRuleMap, pos + linkTo[1].length, false, labels, options),
        backlash: {
          first: linkTo[3],
          second: linkTo[5]
        }
      })

      src = src.substring(linkTo[0].length)
      pos = pos + linkTo[0].length
      continue
    }

    const rLinkTo = inlineRuleMap.reference_link.exec(src) as RegExpExecArray | null
    if (rLinkTo && labels.has(rLinkTo[3] || rLinkTo[1]) && isLengthEven(rLinkTo[2]) && isLengthEven(rLinkTo[4])) {
      pushPending()
      tokens.push({
        type: 'reference_link',
        raw: rLinkTo[0],
        isFullLink: !!rLinkTo[3],
        parent: tokens,
        anchor: rLinkTo[1],
        backlash: {
          first: rLinkTo[2],
          second: rLinkTo[4] || ''
        },
        label: rLinkTo[3] || rLinkTo[1],
        range: {
          start: pos,
          end: pos + rLinkTo[0].length
        },
        children: tokenizerFac(rLinkTo[1], undefined, inlineRuleMap, pos + 1, false, labels, options)
      })

      src = src.substring(rLinkTo[0].length)
      pos = pos + rLinkTo[0].length
      continue
    }

    const rImageTo = inlineRuleMap.reference_image.exec(src) as RegExpExecArray | null
    if (rImageTo && labels.has(rImageTo[3] || rImageTo[1]) && isLengthEven(rImageTo[2]) && isLengthEven(rImageTo[4])) {
      pushPending()

      tokens.push({
        type: 'reference_image',
        raw: rImageTo[0],
        isFullLink: !!rImageTo[3],
        parent: tokens,
        alt: rImageTo[1],
        backlash: {
          first: rImageTo[2],
          second: rImageTo[4] || ''
        },
        label: rImageTo[3] || rImageTo[1],
        range: {
          start: pos,
          end: pos + rImageTo[0].length
        }
      })

      src = src.substring(rImageTo[0].length)
      pos = pos + rImageTo[0].length
      continue
    }

    // html escape
    const htmlEscapeTo = inlineRuleMap.html_escape.exec(src) as RegExpExecArray | null
    if (htmlEscapeTo) {
      const len = htmlEscapeTo[0].length
      pushPending()
      tokens.push({
        type: 'html_escape',
        raw: htmlEscapeTo[0],
        escapeCharacter: htmlEscapeTo[1],
        parent: tokens,
        range: {
          start: pos,
          end: pos + len
        }
      })
      src = src.substring(len)
      pos = pos + len
      continue
    }

    // auto link extension
    const autoLinkExtTo = inlineRuleMap.auto_link_extension.exec(src) as RegExpExecArray | null
    if (autoLinkExtTo && top && (pos === 0 || /[* _~(]{1}/.test(originSrc[pos - 1]))) {
      pushPending()
      tokens.push({
        type: 'auto_link_extension',
        raw: autoLinkExtTo[0],
        www: autoLinkExtTo[1],
        url: autoLinkExtTo[2],
        email: autoLinkExtTo[3],
        linkType: autoLinkExtTo[1] ? 'www' : (autoLinkExtTo[2] ? 'url' : 'email'),
        parent: tokens,
        range: {
          start: pos,
          end: pos + autoLinkExtTo[0].length
        }
      })
      src = src.substring(autoLinkExtTo[0].length)
      pos = pos + autoLinkExtTo[0].length
      continue
    }

    // auto link
    const autoLTo = inlineRuleMap.auto_link.exec(src) as RegExpExecArray | null
    if (autoLTo) {
      pushPending()
      tokens.push({
        type: 'auto_link',
        raw: autoLTo[0],
        href: autoLTo[1],
        email: autoLTo[2],
        isLink: !!autoLTo[1], // It is a link or email.
        marker: '<',
        parent: tokens,
        range: {
          start: pos,
          end: pos + autoLTo[0].length
        }
      })
      src = src.substring(autoLTo[0].length)
      pos = pos + autoLTo[0].length
      continue
    }

    // html-tag
    const htmlTo = matchHtmlTag(src, disableHtml)
    // handle comment
    if (htmlTo && htmlTo[1] && !htmlTo[3]) {
      const len = htmlTo[0].length
      pushPending()
      tokens.push({
        type: 'html_tag',
        raw: htmlTo[0],
        tag: '<!---->',
        openTag: htmlTo[1],
        parent: tokens,
        attrs: {},
        range: {
          start: pos,
          end: pos + len
        }
      })
      src = src.substring(len)
      pos = pos + len
      continue
    }

    if (htmlTo && !disallowedHtmlTag.test(htmlTo[3])) {
      const attrs = getAttributesFn(htmlTo[0])
      if (attrs) {
        const tag = htmlTo[3]
        const html = htmlTo[0]
        const len = htmlTo[0].length

        pushPending()
        tokens.push({
          type: 'html_tag',
          raw: html,
          tag,
          openTag: htmlTo[2],
          closeTag: htmlTo[5],
          parent: tokens,
          attrs,
          content: htmlTo[4],
          children: htmlTo[4] ? tokenizerFac(htmlTo[4], undefined, inlineRuleMap, pos + htmlTo[2].length, false, labels, options) : '',
          range: {
            start: pos,
            end: pos + len
          }
        })
        src = src.substring(len)
        pos = pos + len
        continue
      }
    }

    // soft line break
    const softTo = inlineRuleMap.soft_line_break.exec(src) as RegExpExecArray | null
    if (softTo) {
      const len = softTo[0].length
      pushPending()
      tokens.push({
        type: 'soft_line_break',
        raw: softTo[0],
        lineBreak: softTo[1],
        isAtEnd: softTo.input.length === softTo[0].length,
        parent: tokens,
        range: {
          start: pos,
          end: pos + len
        }
      })
      src = src.substring(len)
      pos += len
      continue
    }
    // hard line break
    const hardTo = inlineRuleMap.hard_line_break.exec(src) as RegExpExecArray | null
    if (hardTo) {
      const len = hardTo[0].length
      pushPending()
      tokens.push({
        type: 'hard_line_break',
        raw: hardTo[0],
        spaces: hardTo[1], // The space in hard line break
        lineBreak: hardTo[2], // \n
        isAtEnd: hardTo.input.length === hardTo[0].length,
        parent: tokens,
        range: {
          start: pos,
          end: pos + len
        }
      })
      src = src.substring(len)
      pos += len
      continue
    }

    // tail header
    const tailTo = inlineRuleMap.tail_header.exec(src) as RegExpExecArray | null
    if (tailTo && top) {
      pushPending()
      tokens.push({
        type: 'tail_header',
        raw: tailTo[1],
        marker: tailTo[1],
        parent: tokens,
        range: {
          start: pos,
          end: pos + tailTo[1].length
        }
      })
      src = src.substring(tailTo[1].length)
      pos += tailTo[1].length
      continue
    }

    if (!pending) pendingStartPos = pos
    pending += src[0]
    src = src.substring(1)
    pos++
  }

  pushPending()
  return tokens
}

export const tokenizer = (
  src: string,
  {
    highlights = [],
    hasBeginRules = true,
    labels = new Map<string, unknown>(),
    options = {}
  }: TokenizerConfig = {}
): Token[] => {
  const rules = Object.assign({}, inlineRuleSet, inlineExtensionRuleSet) as RuleMap
  const tokens = tokenizerFac(src, hasBeginRules ? beginRuleSet : null, rules, 0, true, labels, options)

  const postTokenizer = (nestedTokens: Token[]): void => {
    for (const token of nestedTokens) {
      for (const light of highlights) {
        const highlight = union(token.range, light)
        if (highlight) {
          if (token.highlights && Array.isArray(token.highlights)) {
            token.highlights.push(highlight)
          } else {
            token.highlights = [highlight]
          }
        }
      }
      if (token.children && Array.isArray(token.children)) {
        postTokenizer(token.children)
      }
    }
  }
  if (highlights.length) {
    postTokenizer(tokens)
  }

  return tokens
}

// transform `tokens` to text ignore the range of token
// the opposite of tokenizer
export const generator = (tokens: RawToken[]): string => {
  let result = ''
  for (const token of tokens) {
    result += token.raw
  }
  return result
}
