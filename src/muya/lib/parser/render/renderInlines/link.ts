import { CLASS_OR_ID } from '../../../config'
import { isLengthEven, snakeToCamel } from '../../../utils'
import { sanitizeHyperlink } from '../../../utils/url'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderChunk,
  InlineRenderContextLike,
  InlineRenderer,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface LinkTokenBacklash {
  first: string
  second: string
}

interface LinkToken extends TokenLike {
  anchor: string
  href: string
  title?: string
  raw: string
  hrefAndTitle: string
  backlash: LinkTokenBacklash
  children: TokenLike[]
}

const flattenInlineChunk = (chunk: InlineRenderChunk): RenderChildren => {
  return Array.isArray(chunk) ? chunk : [chunk]
}

// 'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
export default function link (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: LinkToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const linkClassName = className === CLASS_OR_ID.AG_HIDE ? className : CLASS_OR_ID.AG_LINK_IN_BRACKET
  const { start, end } = token.range
  const firstMiddleBracket = this.highlight(h, block, start, start + 3, token)

  const firstBracket = this.highlight(h, block, start, start + 1, token)
  const middleBracket = this.highlight(
    h,
    block,
    start + 1 + token.anchor.length + token.backlash.first.length,
    start + 1 + token.anchor.length + token.backlash.first.length + 2,
    token
  )
  const hrefContent = this.highlight(
    h,
    block,
    start + 1 + token.anchor.length + token.backlash.first.length + 2,
    start + 1 + token.anchor.length + token.backlash.first.length + 2 + token.hrefAndTitle.length,
    token
  )
  const middleHref = this.highlight(
    h,
    block,
    start + 1 + token.anchor.length + token.backlash.first.length,
    start + 1 + token.anchor.length + token.backlash.first.length + 2 + token.hrefAndTitle.length,
    token
  )

  const lastBracket = this.highlight(h, block, end - 1, end, token)
  const firstBacklashStart = start + 1 + token.anchor.length
  const secondBacklashStart = end - 1 - token.backlash.second.length

  if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
    if (!token.children.length && !token.backlash.first) { // no-text-link
      return [
        h(`span.${CLASS_OR_ID.AG_GRAY}.${CLASS_OR_ID.AG_REMOVE}`, firstMiddleBracket),
        h(`a.${CLASS_OR_ID.AG_NOTEXT_LINK}.${CLASS_OR_ID.AG_INLINE_RULE}`, {
          props: {
            href: sanitizeHyperlink(token.href + encodeURI(token.backlash.second)),
            target: '_blank',
            title: token.title ?? ''
          }
        }, [
          ...hrefContent,
          ...this.backlashInToken(h, token.backlash.second, className, secondBacklashStart, token)
        ]),
        h(`span.${CLASS_OR_ID.AG_GRAY}.${CLASS_OR_ID.AG_REMOVE}`, lastBracket)
      ]
    } else { // has children
      return [
        h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, firstBracket),
        h(`a.${CLASS_OR_ID.AG_INLINE_RULE}`, {
          props: {
            href: sanitizeHyperlink(token.href + encodeURI(token.backlash.second)),
            target: '_blank',
            title: token.title ?? ''
          },
          dataset: {
            start,
            end,
            raw: token.raw
          }
        }, [
          ...token.children.reduce<RenderChildren>((accumulator, childToken) => {
            const renderInline = this[snakeToCamel(childToken.type)] as InlineRenderer
            const chunk = renderInline.call(this, h, cursor, block, childToken, className)
            return [...accumulator, ...flattenInlineChunk(chunk)]
          }, []),
          ...this.backlashInToken(h, token.backlash.first, className, firstBacklashStart, token)
        ]),
        h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, middleBracket),
        h(`span.${linkClassName}.${CLASS_OR_ID.AG_REMOVE}`, {
          attrs: { spellcheck: 'false' }
        }, [
          ...hrefContent,
          ...this.backlashInToken(h, token.backlash.second, className, secondBacklashStart, token)
        ]),
        h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, lastBracket)
      ]
    }
  } else {
    return [
      ...firstBracket,
      ...token.children.reduce<RenderChildren>((accumulator, childToken) => {
        const renderInline = this[snakeToCamel(childToken.type)] as InlineRenderer
        const chunk = renderInline.call(this, h, cursor, block, childToken, className)
        return [...accumulator, ...flattenInlineChunk(chunk)]
      }, []),
      ...this.backlashInToken(h, token.backlash.first, className, firstBacklashStart, token),
      ...middleHref,
      ...this.backlashInToken(h, token.backlash.second, className, secondBacklashStart, token),
      ...lastBracket
    ]
  }
}
