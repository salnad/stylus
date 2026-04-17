import { CLASS_OR_ID } from '../../../config'
import { htmlToVNode } from '../snabbdom'
import type {
  BlockLike,
  CursorRangeLike,
  HtmlToVNodeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface HtmlRubyToken extends TokenLike {
  children?: TokenLike[] | string
  raw: string
}

const htmlToVNodeFn = htmlToVNode as unknown as HtmlToVNodeLike

export default function htmlRuby (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: HtmlRubyToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { children } = token
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)
  const vNode = htmlToVNodeFn(token.raw)

  const previewSelector = `span.${CLASS_OR_ID.AG_RUBY_RENDER}`

  if (children) {
    return [
      h(`span.${className}.${CLASS_OR_ID.AG_RUBY}`, [
        h(`span.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_RUBY_TEXT}`, content),
        h(previewSelector, {
          attrs: {
            contenteditable: 'false',
            spellcheck: 'false'
          }
        }, vNode)
      ])
    ]
  }

  return [
    h(`span.${className}.${CLASS_OR_ID.AG_RUBY}`, [
      h(`span.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_RUBY_TEXT}`, content)
    ])
  ]
}
