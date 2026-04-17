// @ts-expect-error -- `katex` is bundled at runtime but does not ship repo-local TypeScript declarations here.
import katex from 'katex'
import 'katex/dist/contrib/mhchem.min.js'
import { CLASS_OR_ID } from '../../../config'
import { htmlToVNode } from '../snabbdom'

import 'katex/dist/katex.min.css'

import type {
  BlockLike,
  CursorRangeLike,
  HtmlToVNodeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface KatexLike {
  renderToString(math: string, options: { displayMode: boolean }): string
}

interface InlineMathToken extends TokenLike {
  marker: string
  content: string
}

const katexRenderer = katex as unknown as KatexLike
const htmlToVNodeFn = htmlToVNode as unknown as HtmlToVNodeLike

export default function displayMath (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: InlineMathToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const mathSelector = className === CLASS_OR_ID.AG_HIDE
    ? `span.${className}.${CLASS_OR_ID.AG_MATH}`
    : `span.${CLASS_OR_ID.AG_MATH}`

  const { start, end } = token.range
  const { marker } = token

  const startMarker = this.highlight(h, block, start, start + marker.length, token)
  const endMarker = this.highlight(h, block, end - marker.length, end, token)
  const content = this.highlight(h, block, start + marker.length, end - marker.length, token)

  const { content: math, type } = token

  const { loadMathMap } = this

  const displayMode = false
  const key = `${math}_${type}`
  let mathVnode: RenderChildren | string = loadMathMap.get(key) ?? ''
  let previewSelector = `span.${CLASS_OR_ID.AG_MATH_RENDER}`
  if (!loadMathMap.has(key)) {
    try {
      const html = katexRenderer.renderToString(math, {
        displayMode
      })
      mathVnode = htmlToVNodeFn(html)
      loadMathMap.set(key, mathVnode)
    } catch (_err) {
      mathVnode = '< Invalid Mathematical Formula >'
      previewSelector += `.${CLASS_OR_ID.AG_MATH_ERROR}`
    }
  }

  return [
    h(`span.${className}.${CLASS_OR_ID.AG_MATH_MARKER}`, startMarker),
    h(mathSelector, [
      h(`span.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_MATH_TEXT}`, {
        attrs: { spellcheck: 'false' }
      }, content),
      h(previewSelector, {
        attrs: { contenteditable: 'false' }
      }, mathVnode)
    ]),
    h(`span.${className}.${CLASS_OR_ID.AG_MATH_MARKER}`, endMarker)
  ]
}
