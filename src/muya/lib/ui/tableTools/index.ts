import BaseFloat, {
  type BaseFloatEventCenterLike,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { toolList } from './config'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface TableBarReference {
  getBoundingClientRect(): DOMRect | ClientRect
}

interface TableToolItem {
  label: string
  action: 'insert' | 'remove'
  location: 'previous' | 'next' | 'current' | 'left' | 'right'
  target: 'row' | 'column'
}

interface TableInfo {
  barType: 'left' | 'bottom'
}

interface TableBarEventPayload {
  reference: TableBarReference | null
  tableInfo?: TableInfo
}

interface TableBarEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-table-bar', listener: (payload: TableBarEventPayload) => void): void
}

interface TableBarContentStateLike {
  editTable(item: TableToolItem): void
}

interface TableBarMuyaLike extends BaseFloatMuyaLike {
  eventCenter: TableBarEventCenterLike
  contentState: TableBarContentStateLike
}

interface PickerMouseEvent {
  preventDefault(): void
  stopPropagation(): void
}

interface SnabbdomDataLike {
  dataset?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper

const defaultOptions: Partial<BaseFloatOptions> = {
  placement: 'right-start',
  modifiers: {
    offset: {
      offset: '0, 5'
    }
  },
  showArrow: false
}

class TableBarTools extends BaseFloat {
  static pluginName = 'tableBarTools'

  oldVnode: RenderVNode | null
  tableInfo: TableInfo | null
  tableBarContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike, options: Partial<BaseFloatOptions> = {}) {
    const name = 'ag-table-bar-tools'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.tableInfo = null
    this.floatBox.classList.add('ag-table-bar-tools')
    const tableBarContainer = this.tableBarContainer = document.createElement('div')
    this.container.appendChild(tableBarContainer)
    this.listen()
  }

  listen (): void {
    super.listen()
    const { eventCenter } = this.muya as TableBarMuyaLike
    eventCenter.subscribe('muya-table-bar', ({ reference, tableInfo }) => {
      if (reference) {
        this.tableInfo = tableInfo as TableInfo
        this.show(reference as unknown as FloatReference)
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render (): void {
    const { oldVnode, tableBarContainer } = this
    const tableInfo = this.tableInfo as TableInfo
    const renderArray = (toolList as Record<TableInfo['barType'], TableToolItem[]>)[tableInfo.barType]
    const children = renderArray.map(item => {
      return createVNode('li.item', {
        dataset: {
          label: item.action
        },
        on: {
          click: event => {
            this.selectItem(event as PickerMouseEvent, item)
          }
        }
      }, item.label)
    })

    const vnode = createVNode('ul', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(tableBarContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event: PickerMouseEvent, item: TableToolItem): void {
    event.preventDefault()
    event.stopPropagation()

    const { contentState } = this.muya as TableBarMuyaLike
    contentState.editTable(item)
    this.hide()
  }
}

export default TableBarTools
