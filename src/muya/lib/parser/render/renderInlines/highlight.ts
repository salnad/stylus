import { union } from '../../../utils'
import type {
  BlockLike,
  HighlightTokenLike,
  InlineHighlightLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper
} from './types'

interface TextBlockLike extends BlockLike {
  text: string
}

// change text to highlight vdom
export default function highlight (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  block: BlockLike,
  rStart: number,
  rEnd: number,
  token: HighlightTokenLike
): RenderChildren {
  const { text } = block as TextBlockLike
  const { highlights } = token
  let result: RenderChildren = []
  const unions: InlineHighlightLike[] = []
  let pos = rStart

  if (highlights) {
    for (const light of highlights) {
      const un = union({ start: rStart, end: rEnd }, light)
      if (un) {
        unions.push(un)
      }
    }
  }

  if (unions.length) {
    for (const overlap of unions) {
      const { start, end, active } = overlap
      const className = this.getHighlightClassName(active)

      if (pos < start) {
        result.push(text.substring(pos, start))
      }

      result.push(h(`span.${className}`, text.substring(start, end)))
      pos = end
    }
    if (pos < rEnd) {
      result.push(text.substring(pos, rEnd))
    }
  } else {
    result = [text.substring(rStart, rEnd)]
  }

  return result
}
