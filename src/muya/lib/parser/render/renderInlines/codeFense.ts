import { CLASS_OR_ID } from '../../../config'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface CodeFenceToken extends TokenLike {
  marker: string
}

export default function codeFense (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  block: BlockLike,
  token: CodeFenceToken,
  _outerClass?: string
): RenderChildren {
  const { start, end } = token.range
  const { marker } = token

  const markerContent = this.highlight(h, block, start, start + marker.length, token)
  const content = this.highlight(h, block, start + marker.length, end, token)

  return [
    h(`span.${CLASS_OR_ID.AG_GRAY}`, markerContent),
    h(`span.${CLASS_OR_ID.AG_LANGUAGE}`, {
      attrs: {
        spellcheck: 'false'
      }
    }, content)
  ]
}
