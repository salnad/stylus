import BaseFloat, {
  type BaseFloatEventCenterLike,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { menu, getSubMenu, getLabel } from './config'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface FrontMenuItem {
  icon: string
  label: string
  text: string
  shortCut?: string
}

interface FrontMenuSubMenuItem {
  icon: string
  title: string
  label: string
  shortCut?: string
}

interface FrontMenuBlock {
  key: string
  type: string
  functionType?: string
  listType?: string
  [key: string]: unknown
}

interface FrontMenuBlockKey {
  key: string
}

interface FrontMenuEventPayload {
  reference: FloatReference | null
  outmostBlock: FrontMenuBlock
  startBlock: FrontMenuBlockKey
  endBlock: FrontMenuBlockKey
}

interface FrontMenuContentStateLike {
  selectedBlock: FrontMenuBlock | null
  duplicate(): unknown
  deleteParagraph(): unknown
  insertParagraph(location: string, text?: string, outMost?: boolean): void
  updateParagraph(type: string): void
}

interface FrontMenuEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-front-menu', listener: (payload: FrontMenuEventPayload) => void): void
}

interface FrontMenuMuyaLike extends BaseFloatMuyaLike {
  eventCenter: FrontMenuEventCenterLike
  contentState: FrontMenuContentStateLike
}

interface FrontMenuMouseEvent {
  preventDefault(): void
  stopPropagation(): void
}

interface SnabbdomDataLike {
  style?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper

const MAX_SUBMENU_HEIGHT = 400
const ITEM_HEIGHT = 28
const PADDING = 10

const defaultOptions: BaseFloatOptions = {
  placement: 'bottom',
  modifiers: {
    offset: {
      offset: '0, 10'
    }
  },
  showArrow: false
}

class FrontMenu extends BaseFloat {
  static pluginName = 'frontMenu'

  oldVnode: RenderVNode | null
  outmostBlock: FrontMenuBlock | null
  startBlock: FrontMenuBlockKey | null
  endBlock: FrontMenuBlockKey | null
  reference: FloatReference | null
  frontMenuContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike, options: Partial<BaseFloatOptions> = {}) {
    const name = 'ag-front-menu'
    const opts = Object.assign({}, defaultOptions, options) as BaseFloatOptions
    super(muya, name, opts)
    this.oldVnode = null
    this.outmostBlock = null
    this.startBlock = null
    this.endBlock = null
    this.options = opts
    this.reference = null
    const frontMenuContainer = this.frontMenuContainer = document.createElement('div')
    const containerParent = this.container.parentElement as HTMLElement
    Object.assign(containerParent.style, {
      overflow: 'visible'
    })
    this.container.appendChild(frontMenuContainer)
    this.listen()
  }

  listen (): void {
    const { eventCenter } = this.muya as FrontMenuMuyaLike
    super.listen()
    eventCenter.subscribe('muya-front-menu', ({ reference, outmostBlock, startBlock, endBlock }) => {
      if (reference) {
        this.outmostBlock = outmostBlock
        this.startBlock = startBlock
        this.endBlock = endBlock
        this.reference = reference
        setTimeout(() => {
          this.show(reference)
          this.render()
        }, 0)
      } else {
        this.hide()
        this.reference = null
      }
    })
  }

  renderSubMenu (subMenu: FrontMenuSubMenuItem[]): RenderVNode {
    const reference = this.reference as FloatReference
    const rect = reference.getBoundingClientRect()
    const windowHeight = document.documentElement.clientHeight
    const children = subMenu.map(menuItem => {
      const { icon, title, label, shortCut } = menuItem
      const iconWrapperSelector = 'div.icon-wrapper'
      const iconSelector = `i.icon-${label.replace(/\s/g, '-')}`
      const iconWrapper = createVNode(iconWrapperSelector, createVNode('i.icon', createVNode(iconSelector, {
        style: {
          background: `url(${icon}) no-repeat`,
          'background-size': '100%'
        }
      }, '')))

      const textWrapper = createVNode('span', title)
      const shortCutWrapper = createVNode('div.short-cut', [
        createVNode('span', shortCut)
      ])
      let itemSelector = `li.item.${label}`
      if (label === getLabel(this.outmostBlock as FrontMenuBlock)) {
        itemSelector += '.active'
      }
      return createVNode(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event as FrontMenuMouseEvent, { label })
          }
        }
      }, [iconWrapper, textWrapper, shortCutWrapper])
    })
    let subMenuSelector = 'div.submenu'
    if (windowHeight - rect.bottom < MAX_SUBMENU_HEIGHT - (ITEM_HEIGHT + PADDING)) {
      subMenuSelector += '.align-bottom'
    }
    return createVNode(subMenuSelector, createVNode('ul', children))
  }

  render (): void {
    const { oldVnode, frontMenuContainer, outmostBlock, startBlock, endBlock } = this
    const currentBlock = outmostBlock as FrontMenuBlock
    const { type, functionType } = currentBlock
    const children = (menu as FrontMenuItem[]).map(({ icon, label, text, shortCut }) => {
      const subMenu = getSubMenu(currentBlock, startBlock as FrontMenuBlockKey, endBlock as FrontMenuBlockKey)
      const iconWrapperSelector = 'div.icon-wrapper'
      const iconSelector = `i.icon-${label.replace(/\s/g, '-')}`
      const iconWrapper = createVNode(iconWrapperSelector, createVNode('i.icon', createVNode(iconSelector, {
        style: {
          background: `url(${icon}) no-repeat`,
          'background-size': '100%'
        }
      }, '')))
      const textWrapper = createVNode('span', text)
      const shortCutWrapper = createVNode('div.short-cut', [
        createVNode('span', shortCut)
      ])
      let itemSelector = `li.item.${label}`
      const itemChildren: RenderVNode[] = [iconWrapper, textWrapper, shortCutWrapper]
      if (label === 'turnInto' && subMenu.length !== 0) {
        itemChildren.push(this.renderSubMenu(subMenu))
      }
      if (label === 'turnInto' && subMenu.length === 0) {
        itemSelector += '.disabled'
      }
      // front matter can not be duplicated.
      if (label === 'duplicate' && type === 'pre' && functionType === 'frontmatter') {
        itemSelector += '.disabled'
      }
      return createVNode(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event as FrontMenuMouseEvent, { label })
          }
        }
      }, itemChildren)
    })

    const vnode = createVNode('ul', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(frontMenuContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event: FrontMenuMouseEvent, { label }: Pick<FrontMenuItem, 'label'>): void {
    event.preventDefault()
    event.stopPropagation()
    const { type, functionType } = this.outmostBlock as FrontMenuBlock
    // front matter can not be duplicated.
    if (label === 'duplicate' && type === 'pre' && functionType === 'frontmatter') {
      return
    }
    const { contentState } = this.muya as FrontMenuMuyaLike
    contentState.selectedBlock = null
    switch (label) {
      case 'duplicate': {
        contentState.duplicate()
        break
      }
      case 'delete': {
        contentState.deleteParagraph()
        break
      }
      case 'new': {
        contentState.insertParagraph('after', '', true)
        break
      }
      case 'turnInto':
        // do nothing, do not hide float box.
        return
      default:
        contentState.updateParagraph(label)
        break
    }
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }
}

export default FrontMenu
