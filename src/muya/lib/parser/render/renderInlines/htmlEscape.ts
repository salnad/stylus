import { CLASS_OR_ID } from '../../../config'
import escapeCharactersMap from '../../escapeCharacter'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface HtmlEscapeToken extends TokenLike {
  escapeCharacter: keyof typeof escapeCharactersMap
}

export default function htmlEscape (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: HtmlEscapeToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { escapeCharacter } = token
  const { start, end } = token.range

  const content = this.highlight(h, block, start, end, token)

  return [
    h(`span.${className}.${CLASS_OR_ID.AG_HTML_ESCAPE}`, {
      dataset: {
        character: escapeCharactersMap[escapeCharacter]
      }
    }, content)
  ]
}
