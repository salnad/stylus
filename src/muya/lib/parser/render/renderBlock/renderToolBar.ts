// used for render table tookbar or others.
import { h } from '../snabbdom'
import { CLASS_OR_ID } from '../../../config'
import TableIcon from '../../../assets/pngicon/table/table@2x.png'
import AlignLeftIcon from '../../../assets/pngicon/algin_left/2.png'
import AlignRightIcon from '../../../assets/pngicon/algin_right/2.png'
import AlignCenterIcon from '../../../assets/pngicon/algin_center/2.png'
import DeleteIcon from '../../../assets/pngicon/table_delete/2.png'
import type {
  BlockLike,
  RenderVNode,
  SnabbdomDataLike,
  SnabbdomHelper
} from './types'

interface ToolLike {
  label: string
  title: string
  icon: string
}

type ToolBarType = 'table'

const createVNode = h as unknown as SnabbdomHelper

export const TABLE_TOOLS = Object.freeze<ToolLike[]>([{
  label: 'table',
  title: 'Resize Table',
  icon: TableIcon
}, {
  label: 'left',
  title: 'Align Left',
  icon: AlignLeftIcon
}, {
  label: 'center',
  title: 'Align Center',
  icon: AlignCenterIcon
}, {
  label: 'right',
  title: 'Align Right',
  icon: AlignRightIcon
}, {
  label: 'delete',
  title: 'Delete Table',
  icon: DeleteIcon
}])

const renderToolBar = (type: ToolBarType, tools: readonly ToolLike[], activeBlocks: BlockLike[]): RenderVNode => {
  const children = tools.map(tool => {
    const { label, title, icon } = tool
    const { align } = activeBlocks[1] as BlockLike
    let selector = 'li'
    if (align && label === align) {
      selector += '.active'
    }
    const iconVnode = createVNode('i.icon', createVNode(`i.icon-${label}`, {
      style: {
        background: `url(${icon}) no-repeat`,
        'background-size': '100%'
      }
    }, ''))
    const data: SnabbdomDataLike = {
      dataset: {
        label,
        tooltip: title
      }
    }

    return createVNode(selector, data, iconVnode)
  })
  const selector = `div.ag-tool-${type}.${CLASS_OR_ID.AG_TOOL_BAR}`

  return createVNode(selector, {
    attrs: {
      contenteditable: false
    }
  }, createVNode('ul', children))
}

export const renderTableTools = (activeBlocks: BlockLike[]): RenderVNode => {
  return renderToolBar('table', TABLE_TOOLS, activeBlocks)
}
