import { CLASS_OR_ID } from '../../../config'
import { snakeToCamel } from '../../../utils'
import { sanitizeHyperlink } from '../../../utils/url'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderChunk,
  InlineRenderContextLike,
  InlineRenderer,
  LabelValue,
  RenderChildren,
  SnabbdomDataLike,
  SnabbdomHelper,
  TokenLike
} from './types'

interface ReferenceLinkToken extends TokenLike {
  anchor: string
  children: TokenLike[]
  backlash: {
    first: string
    second: string
  }
  isFullLink: boolean
  label: string
  raw: string
}

const flattenInlineChunk = (chunk: InlineRenderChunk): RenderChildren => {
  return Array.isArray(chunk) ? chunk : [chunk]
}

export default function referenceLink (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: ReferenceLinkToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const labelClass = className === CLASS_OR_ID.AG_GRAY
    ? CLASS_OR_ID.AG_REFERENCE_LABEL
    : className

  const { start, end } = token.range
  const {
    anchor,
    children,
    backlash,
    isFullLink,
    label
  } = token
  const marker = '['
  const key = (label + backlash.second).toLowerCase()
  const backlashStart = start + marker.length + anchor.length
  const content = [
    ...children.reduce<RenderChildren>((accumulator, childToken) => {
      const renderInline = this[snakeToCamel(childToken.type)] as InlineRenderer
      const chunk = renderInline.call(this, h, cursor, block, childToken, className)
      return [...accumulator, ...flattenInlineChunk(chunk)]
    }, []),
    ...this.backlashInToken(h, backlash.first, className, backlashStart, token)
  ]

  const labelValue = this.labels.get(key) as LabelValue | undefined
  const href = labelValue?.href
  const title = labelValue?.title
  const startMarker = this.highlight(
    h,
    block,
    start,
    start + marker.length,
    token
  )
  const endMarker = this.highlight(
    h,
    block,
    start + marker.length + anchor.length + backlash.first.length,
    end,
    token
  )
  const anchorSelector = href ? `a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_REFERENCE_LINK}` : `span.${CLASS_OR_ID.AG_REFERENCE_LINK}`
  const data: SnabbdomDataLike = {
    attrs: {
      spellcheck: 'false'
    },
    props: {},
    dataset: {
      start,
      end,
      raw: token.raw
    }
  }
  if (title) {
    Object.assign(data.props as Record<string, unknown>, { title })
  }
  if (href) {
    Object.assign(data.props ?? {}, { href: sanitizeHyperlink(href) })
  }

  if (isFullLink) {
    const labelContent = this.highlight(
      h,
      block,
      start + 3 * marker.length + anchor.length + backlash.first.length,
      end - marker.length - backlash.second.length,
      token
    )
    const middleMarker = this.highlight(
      h,
      block,
      start + marker.length + anchor.length + backlash.first.length,
      start + 3 * marker.length + anchor.length + backlash.first.length,
      token
    )
    const lastMarker = this.highlight(
      h,
      block,
      end - marker.length,
      end,
      token
    )
    const secondBacklashStart = end - marker.length - backlash.second.length

    return [
      h(`span.${className}`, startMarker),
      h(anchorSelector, data, content),
      h(`span.${className}`, middleMarker),
      h(`span.${labelClass}`, labelContent),
      ...this.backlashInToken(h, backlash.second, className, secondBacklashStart, token),
      h(`span.${className}`, lastMarker)
    ]
  }

  return [
    h(`span.${className}`, startMarker),
    h(anchorSelector, data, content),
    h(`span.${className}`, endMarker)
  ]
}
