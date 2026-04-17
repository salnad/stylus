import { h } from '../snabbdom'
import type { RenderVNode, SnabbdomHelper } from './types'

const createVNode = h as unknown as SnabbdomHelper

export const renderLeftBar = (): RenderVNode => {
  return createVNode('span.ag-drag-handler.left', {
    attrs: { contenteditable: 'false' }
  })
}

export const renderBottomBar = (): RenderVNode => {
  return createVNode('span.ag-drag-handler.bottom', {
    attrs: { contenteditable: 'false' }
  })
}
