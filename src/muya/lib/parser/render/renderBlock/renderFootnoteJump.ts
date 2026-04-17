import { h } from '../snabbdom'
import type { RenderVNode } from './types'

export const footnoteJumpIcon = (): RenderVNode => {
  return h('i.ag-footnote-backlink', '↩︎') as RenderVNode
}
