import { h } from '../snabbdom'
import { CLASS_OR_ID } from '../../../config'
import htmlIcon from '../../../assets/pngicon/html/2.png'

import type { RenderVNode, SnabbdomHelper } from './types'

const createVNode = h as unknown as SnabbdomHelper

export const renderEditIcon = (): RenderVNode => {
  const selector = `a.${CLASS_OR_ID.AG_CONTAINER_ICON}`
  const iconVnode = createVNode('i.icon', createVNode('i.icon-inner', {
    style: {
      background: `url(${htmlIcon}) no-repeat`,
      'background-size': '100%'
    }
  }, ''))

  return createVNode(selector, {
    attrs: {
      contenteditable: 'false'
    }
  }, iconVnode)
}
