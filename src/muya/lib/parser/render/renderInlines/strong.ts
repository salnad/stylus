import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

export default function strong (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: TokenLike,
  outerClass?: string
): RenderChildren {
  return this.delEmStrongFac('strong', h, cursor, block, token, outerClass)
}
