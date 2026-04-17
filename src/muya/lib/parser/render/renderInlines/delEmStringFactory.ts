import { CLASS_OR_ID } from '../../../config'
import { snakeToCamel } from '../../../utils'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  InlineRenderChunk,
  InlineRenderer,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface DelEmStrongToken extends TokenLike {
  marker: string
  backlash: string
  children: TokenLike[]
}

const flattenInlineChunk = (chunk: InlineRenderChunk): RenderChildren => {
  return Array.isArray(chunk) ? chunk : [chunk]
}

// render factory of `del`,`em`,`strong`
export default function delEmStrongFac (
  this: InlineRenderContextLike,
  type: 'del' | 'em' | 'strong',
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: DelEmStrongToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const commonMarker = `span.${className}.${CLASS_OR_ID.AG_REMOVE}`
  const { marker } = token
  const { start, end } = token.range
  const backlashStart = end - marker.length - token.backlash.length
  const content = [
    ...token.children.reduce<RenderChildren>((accumulator, childToken) => {
      const renderInline = this[snakeToCamel(childToken.type)] as InlineRenderer
      const chunk = renderInline.call(this, h, cursor, block, childToken, className)
      return [...accumulator, ...flattenInlineChunk(chunk)]
    }, []),
    ...this.backlashInToken(h, token.backlash, className, backlashStart, token)
  ]
  const startMarker = this.highlight(h, block, start, start + marker.length, token)
  const endMarker = this.highlight(h, block, end - marker.length, end, token)

  return [
    h(commonMarker, startMarker),
    h(`${type}.${CLASS_OR_ID.AG_INLINE_RULE}`, content),
    h(commonMarker, endMarker)
  ]
}
