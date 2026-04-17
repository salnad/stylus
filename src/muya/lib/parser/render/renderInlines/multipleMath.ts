import { CLASS_OR_ID } from '../../../config'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

export default function multipleMath (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  block: BlockLike,
  token: TokenLike,
  _outerClass?: string
): RenderChildren {
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)

  return [
    h(`span.${CLASS_OR_ID.AG_GRAY}.${CLASS_OR_ID.AG_REMOVE}`, content)
  ]
}
