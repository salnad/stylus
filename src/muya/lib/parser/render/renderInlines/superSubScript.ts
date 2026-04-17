import { CLASS_OR_ID } from '../../../config'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface SuperSubScriptToken extends TokenLike {
  marker: string
}

export default function superSubScript (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: SuperSubScriptToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { marker } = token
  const { start, end } = token.range

  const startMarker = this.highlight(h, block, start, start + marker.length, token)
  const endMarker = this.highlight(h, block, end - marker.length, end, token)
  const content = this.highlight(h, block, start + marker.length, end - marker.length, token)
  const tagName = marker === '^' ? 'sup' : 'sub'

  return [
    h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, startMarker),
    h(`${tagName}.${CLASS_OR_ID.AG_INLINE_RULE}`, {
      attrs: {
        spellcheck: 'false'
      }
    }, content),
    h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, endMarker)
  ]
}
