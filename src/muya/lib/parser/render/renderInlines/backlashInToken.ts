import { union, isEven } from '../../../utils'
import { CLASS_OR_ID } from '../../../config'
import type {
  HighlightTokenLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper
} from './types'

// TODO HIGHLIGHT
export default function backlashInToken (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  backlashes: string,
  outerClass: string,
  start: number,
  token: HighlightTokenLike
): RenderChildren {
  const { highlights = [] } = token
  const chunks = backlashes.split('')
  const len = chunks.length
  const result: RenderChildren = []

  for (let i = 0; i < len; i++) {
    const chunk = chunks[i]
    const light = highlights.filter(highlight => union({ start: start + i, end: start + i + 1 }, highlight))
    let selector = 'span'
    if (light.length) {
      const className = this.getHighlightClassName(light[0].active)
      selector += `.${className}`
    }
    if (isEven(i)) {
      result.push(
        h(`${selector}.${outerClass}`, chunk)
      )
    } else {
      result.push(
        h(`${selector}.${CLASS_OR_ID.AG_BACKLASH}`, chunk)
      )
    }
  }

  return result
}
