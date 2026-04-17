import { h } from '../snabbdom'
import copyIcon from '../../../assets/pngicon/copy/2.png'

import type { RenderVNode, SnabbdomHelper } from './types'

const createVNode = h as unknown as SnabbdomHelper

const renderCopyButton = (): RenderVNode => {
  const selector = 'a.ag-code-copy'
  const iconVnode = createVNode('i.icon', createVNode('i.icon-inner', {
    style: {
      background: `url(${copyIcon}) no-repeat`,
      'background-size': '100%'
    }
  }, ''))

  return createVNode(selector, {
    attrs: {
      title: 'Copy content',
      contenteditable: 'false'
    }
  }, iconVnode)
}

export default renderCopyButton
