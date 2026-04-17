import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

export default function del (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: TokenLike,
  outerClass?: string
): RenderChildren {
  return this.delEmStrongFac('del', h, cursor, block, token, outerClass)
}
