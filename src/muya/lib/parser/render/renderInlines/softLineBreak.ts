import { CLASS_OR_ID } from '../../../config'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface SoftLineBreakToken extends TokenLike {
  lineBreak: string
  isAtEnd: boolean
}

export default function hardLineBreak (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  _block: BlockLike,
  token: SoftLineBreakToken,
  _outerClass?: string
): RenderChildren {
  const { lineBreak, isAtEnd } = token
  let selector = `span.${CLASS_OR_ID.AG_SOFT_LINE_BREAK}`
  if (isAtEnd) {
    selector += `.${CLASS_OR_ID.AG_LINE_END}`
  }

  return [
    h(selector, lineBreak)
  ]
}
