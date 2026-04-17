import { filter } from 'fuzzaldrin'
import type {
  BaseFloatCallback,
  BaseFloatEventCenterLike,
  FloatReference,
  MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import BaseScrollFloat from '../baseScrollFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { deepCopy } from '../../utils'
import { quickInsertObj } from './config'
import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface QuickInsertItem {
  title: string
  subTitle: string
  label: string
  shortCut?: string
  icon: string
}

type QuickInsertRenderMap = Record<string, QuickInsertItem[]>

interface QuickInsertBlock {
  key: string
  text: string
  type?: string
  functionType?: string
  preSibling?: string | null
  nextSibling?: string | null
  parent?: string | null
  [key: string]: unknown
}

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRange {
  start: CursorPosition
  end: CursorPosition
}

interface QuickInsertContentStateLike {
  cursor: CursorRange
  canInserFrontMatter(block: QuickInsertBlock | null): boolean
  partialRender(): void
  updateParagraph(type: string, insertMode?: boolean): void
}

interface QuickInsertEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(
    event: 'muya-quick-insert',
    listener: (reference: FloatReference, block: QuickInsertBlock, status: boolean) => void
  ): void
}

interface QuickInsertMuyaLike extends BaseFloatMuyaLike {
  eventCenter: QuickInsertEventCenterLike
  contentState: QuickInsertContentStateLike
}

interface SnabbdomDataLike {
  dataset?: Record<string, string>
  style?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper
const noopCallback = (() => {}) as BaseFloatCallback

class QuickInsert extends BaseScrollFloat<QuickInsertItem> {
  static pluginName = 'quickInsert'

  oldVnode: RenderVNode | null
  _renderObj: QuickInsertRenderMap
  block: QuickInsertBlock | null

  constructor (muya: BaseFloatMuyaLike) {
    const name = 'ag-quick-insert'
    super(muya, name)
    this.reference = null
    this.oldVnode = null
    this._renderObj = {}
    this.renderArray = []
    this.activeItem = null
    this.block = null
    this.renderObj = quickInsertObj
    this.render()
    this.listen()
  }

  get renderObj (): QuickInsertRenderMap {
    return this._renderObj
  }

  set renderObj (obj: QuickInsertRenderMap) {
    this._renderObj = obj
    const renderArray: QuickInsertItem[] = []
    Object.keys(obj).forEach(key => {
      renderArray.push(...obj[key])
    })
    this.renderArray = renderArray
    if (this.renderArray.length > 0) {
      this.activeItem = this.renderArray[0]
      const activeElement = this.getItemElement(this.activeItem)
      this.activeEleScrollIntoView(activeElement)
    }
  }

  render (): void {
    const { scrollElement, activeItem, _renderObj, oldVnode } = this
    let children: RenderVNode[] | RenderVNode = Object.keys(_renderObj)
      .filter(key => {
        return _renderObj[key].length !== 0
      })
      .map(key => {
        const titleVnode = createVNode('div.title', key.toUpperCase())
        const items: RenderVNode[] = []
        for (const item of _renderObj[key]) {
          const { title, subTitle, label, icon, shortCut } = item
          const iconSelector = `i.icon-${label.replace(/\s/g, '-')}`
          const iconVnode = createVNode('div.icon-container', createVNode('i.icon', createVNode(iconSelector, {
            style: {
              background: `url(${icon}) no-repeat`,
              'background-size': '100%'
            }
          }, '')))
          const description = createVNode('div.description', [
            createVNode('div.big-title', title),
            createVNode('div.sub-title', subTitle)
          ])
          const shortCutVnode = createVNode('div.short-cut', [
            createVNode('span', shortCut)
          ])
          const selector = activeItem?.label === label ? 'div.item.active' : 'div.item'
          items.push(createVNode(selector, {
            dataset: { label },
            on: {
              click: () => {
                this.selectItem(item)
              }
            }
          }, [iconVnode, description, shortCutVnode]))
        }

        return createVNode('section', [titleVnode, ...items])
      })

    if (Array.isArray(children) && children.length === 0) {
      children = createVNode('div.no-result', 'No result')
    }
    const vnode = createVNode('div', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(scrollElement as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  listen (): void {
    super.listen()
    const { eventCenter } = this.muya as QuickInsertMuyaLike
    eventCenter.subscribe('muya-quick-insert', (reference, block, status) => {
      if (status) {
        this.block = block
        this.show(reference, noopCallback)
        this.search(block.text.substring(1)) // remove `@` char
      } else {
        this.hide()
      }
    })
  }

  search (text: string): void {
    const { contentState } = this.muya as QuickInsertMuyaLike
    const canInserFrontMatter = contentState.canInserFrontMatter(this.block)
    const obj = deepCopy(quickInsertObj) as QuickInsertRenderMap
    if (!canInserFrontMatter) {
      obj['basic block'].splice(2, 1)
    }
    let result: QuickInsertRenderMap = obj
    if (text !== '') {
      result = {}
      Object.keys(obj).forEach(key => {
        result[key] = filter(obj[key], text, { key: 'title' }) as QuickInsertItem[]
      })
    }
    this.renderObj = result
    this.render()
  }

  selectItem (item: QuickInsertItem | null): void {
    if (!item) {
      return
    }

    const { contentState } = this.muya as QuickInsertMuyaLike
    const block = this.block as QuickInsertBlock
    block.text = ''
    const { key } = block
    const offset = 0
    contentState.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    switch (item.label) {
      case 'paragraph':
        contentState.partialRender()
        break
      default:
        contentState.updateParagraph(item.label, true)
        break
    }
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }

  getItemElement (item: QuickInsertItem | null): Element | null {
    const label = item?.label
    if (!label) {
      return null
    }

    return this.scrollElement.querySelector(`[data-label="${label}"]`)
  }
}

export default QuickInsert
