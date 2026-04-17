import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

export default function tailHeader (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: TokenLike,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)

  if (/^h\d$/.test(block.type)) {
    return [
      h(`span.${className}`, content)
    ]
  }

  return content
}
