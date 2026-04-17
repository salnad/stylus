import { CLASS_OR_ID, BLOCK_TYPE6 } from '../../../config'
import { snakeToCamel, sanitize } from '../../../utils'
import { isValidAttribute } from '../../../utils/dompurify'
import type {
  BlockLike,
  CursorRangeLike,
  HtmlAttrs,
  InlineRenderChunk,
  InlineRenderContextLike,
  InlineRenderer,
  RenderChildren,
  SnabbdomDataLike,
  SnabbdomHelper,
  TokenLike
} from './types'

interface HtmlTagToken extends TokenLike {
  tag: string
  openTag: string
  closeTag?: string
  attrs: HtmlAttrs
  raw: string
}

const flattenInlineChunk = (chunk: InlineRenderChunk): RenderChildren => {
  return Array.isArray(chunk) ? chunk : [chunk]
}

export default function htmlTag (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: HtmlTagToken,
  outerClass?: string
): RenderChildren {
  const { tag, openTag, closeTag, children, attrs } = token
  const className = children ? this.getClassName(outerClass, block, token, cursor) : CLASS_OR_ID.AG_GRAY
  const tagClassName = className === CLASS_OR_ID.AG_HIDE ? className : CLASS_OR_ID.AG_HTML_TAG
  const { start, end } = token.range
  const openContent = this.highlight(h, block, start, start + openTag.length, token)
  const closeContent = closeTag
    ? this.highlight(h, block, end - closeTag.length, end, token)
    : ''

  const anchor = Array.isArray(children) && tag !== 'ruby'
    ? children.reduce<RenderChildren>((accumulator, childToken) => {
      const renderInline = this[snakeToCamel(childToken.type)] as InlineRenderer
      const chunk = renderInline.call(this, h, cursor, block, childToken, className)
      return [...accumulator, ...flattenInlineChunk(chunk)]
    }, [])
    : ''

  switch (tag) {
    case 'img':
      return this.image(h, cursor, block, token, outerClass)
    case 'br':
      return [h(`span.${CLASS_OR_ID.AG_HTML_TAG}`, [...openContent, h(tag)])]
    default: {
      if (!closeTag) {
        return [h(`span.${CLASS_OR_ID.AG_HTML_TAG}`, openContent)]
      }

      if (tag === 'ruby') {
        return this.htmlRuby(h, cursor, block, token, outerClass)
      }

      let selector = BLOCK_TYPE6.includes(tag) || !sanitize(`<${tag}>`) ? 'span' : tag
      selector += `.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_RAW_HTML}`
      const data: SnabbdomDataLike = {
        attrs: {},
        dataset: {
          start,
          end,
          raw: token.raw
        }
      }

      if (tag === 'code' || tag === 'kbd') {
        Object.assign(data.attrs as Record<string, unknown>, { spellcheck: 'false' })
      }

      if (attrs.id) {
        selector += `#${attrs.id}`
      }
      if (attrs.class && /\S/.test(attrs.class)) {
        const classNames = attrs.class.split(/\s+/)
        for (const classNamePart of classNames) {
          selector += `.${classNamePart}`
        }
      }

      for (const attr of Object.keys(attrs)) {
        if (attr !== 'id' && attr !== 'class') {
          const attrData = attrs[attr]
          const attrValue = typeof attrData === 'string'
            ? attrData
            : attrData === undefined
              ? ''
              : String(attrData)
          if (isValidAttribute(tag, attr, attrValue)) {
            (data.attrs as Record<string, unknown>)[attr] = attrData
          }
        }
      }

      return [
        h(`span.${tagClassName}.${CLASS_OR_ID.AG_OUTPUT_REMOVE}`, {
          attrs: {
            spellcheck: 'false'
          }
        }, openContent),
        h(selector, data, anchor),
        h(`span.${tagClassName}.${CLASS_OR_ID.AG_OUTPUT_REMOVE}`, {
          attrs: {
            spellcheck: 'false'
          }
        }, closeContent)
      ]
    }
  }
}
