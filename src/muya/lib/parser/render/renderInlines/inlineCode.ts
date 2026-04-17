import { CLASS_OR_ID } from '../../../config'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface InlineCodeToken extends TokenLike {
  marker: string
}

export default function inlineCode (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: InlineCodeToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { marker } = token
  const { start, end } = token.range

  const startMarker = this.highlight(h, block, start, start + marker.length, token)
  const endMarker = this.highlight(h, block, end - marker.length, end, token)
  const content = this.highlight(h, block, start + marker.length, end - marker.length, token)

  return [
    h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, startMarker),
    h(`code.${CLASS_OR_ID.AG_INLINE_RULE}`, {
      attrs: {
        spellcheck: 'false'
      }
    }, content),
    h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, endMarker)
  ]
}
