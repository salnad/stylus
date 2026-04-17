import { CLASS_OR_ID } from '../../../config'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface HardLineBreakToken extends TokenLike {
  spaces: string
  lineBreak: string
  isAtEnd: boolean
}

export default function softLineBreak (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  _block: BlockLike,
  token: HardLineBreakToken,
  _outerClass?: string
): RenderChildren {
  const { spaces, lineBreak, isAtEnd } = token
  const className = CLASS_OR_ID.AG_HARD_LINE_BREAK
  const spaceClass = CLASS_OR_ID.AG_HARD_LINE_BREAK_SPACE
  if (isAtEnd) {
    return [
      h(`span.${className}`, h(`span.${spaceClass}`, spaces)),
      h(`span.${CLASS_OR_ID.AG_LINE_END}`, lineBreak)
    ]
  } else {
    return [
      h(`span.${className}`, [h(`span.${spaceClass}`, spaces), lineBreak])
    ]
  }
}
