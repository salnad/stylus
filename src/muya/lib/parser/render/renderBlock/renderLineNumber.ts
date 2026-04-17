import { h } from '../snabbdom'
import type { BlockLike, RenderVNode, SnabbdomDataLike, SnabbdomHelper } from './types'

interface CodeContentBlockLike extends BlockLike {
  text?: string
}

const createVNode = h as unknown as SnabbdomHelper
const NEW_LINE_EXP = /\n(?!$)/g

const renderLineNumberRows = (codeContent: CodeContentBlockLike): RenderVNode => {
  const text = typeof codeContent.text === 'string' ? codeContent.text : ''
  const match = text.match(NEW_LINE_EXP)
  let linesNum = match ? match.length + 1 : 1
  if (text.endsWith('\n')) {
    linesNum++
  }
  const data: SnabbdomDataLike = {
    attrs: {
      'aria-hidden': true
    }
  }
  const children = [...new Array(linesNum)].map(() => createVNode('span'))

  return createVNode('span.line-numbers-rows', data, children)
}

export default renderLineNumberRows
