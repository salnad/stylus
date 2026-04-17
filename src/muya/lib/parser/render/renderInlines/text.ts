import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

// render token of text type to vdom.
export default function text (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  block: BlockLike,
  token: TokenLike
): RenderChildren {
  const { start, end } = token.range

  return [
    h('span.ag-plain-text', this.highlight(h, block, start, end, token))
  ]
}
