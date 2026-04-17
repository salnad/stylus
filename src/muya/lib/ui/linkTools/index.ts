import BaseFloat, {
  type BaseFloatEventCenterLike,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import icons from './config'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface LinkToolReference {
  getBoundingClientRect(): DOMRect | ClientRect
}

interface LinkInfoTokenRange {
  start: string | number | null
  end: string | number | null
}

interface LinkInfoToken {
  type?: string
  raw?: string
  href?: string | null
  content?: string
  range?: LinkInfoTokenRange
  [key: string]: unknown
}

interface LinkInfo {
  key: string
  token: LinkInfoToken
  href: string | null
}

interface LinkToolItem {
  type: 'unlink' | 'jump'
  icon: string
}

interface LinkToolsEventPayload {
  reference: LinkToolReference | null
  linkInfo?: LinkInfo
}

interface LinkToolsEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-link-tools', listener: (payload: LinkToolsEventPayload) => void): void
}

interface LinkToolsContentStateLike {
  unlink(linkInfo: LinkInfo): void
}

interface LinkToolsOptionsLike {
  jumpClick?: (linkInfo: LinkInfo) => void
}

interface LinkToolsMuyaLike extends BaseFloatMuyaLike {
  eventCenter: LinkToolsEventCenterLike
  contentState: LinkToolsContentStateLike
}

interface PickerMouseEvent {
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

const defaultOptions: Partial<BaseFloatOptions> = {
  placement: 'bottom',
  modifiers: {
    offset: {
      offset: '0, 5'
    }
  },
  showArrow: false
}

class LinkTools extends BaseFloat {
  static pluginName = 'linkTools'

  oldVnode: RenderVNode | null
  linkInfo: LinkInfo | null
  icons: LinkToolItem[]
  hideTimer: ReturnType<typeof setTimeout> | null
  linkContainer: HTMLDivElement

  constructor (
    muya: BaseFloatMuyaLike,
    options: Partial<BaseFloatOptions> & LinkToolsOptionsLike = {}
  ) {
    const name = 'ag-link-tools'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.linkInfo = null
    this.icons = icons as LinkToolItem[]
    this.hideTimer = null
    const linkContainer = this.linkContainer = document.createElement('div')
    this.container.appendChild(linkContainer)
    this.listen()
  }

  listen (): void {
    const { eventCenter } = this.muya as LinkToolsMuyaLike
    super.listen()
    eventCenter.subscribe('muya-link-tools', ({ reference, linkInfo }) => {
      if (reference) {
        this.linkInfo = linkInfo ?? null
        setTimeout(() => {
          this.show(reference as unknown as FloatReference)
          this.render()
        }, 0)
      } else {
        if (this.hideTimer) {
          clearTimeout(this.hideTimer)
        }
        this.hideTimer = setTimeout(() => {
          this.hide()
        }, 500)
      }
    })

    const mouseOverHandler = (): void => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
      }
    }

    const mouseOutHandler = (): void => {
      this.hide()
    }

    eventCenter.attachDOMEvent(this.container, 'mouseover', mouseOverHandler)
    eventCenter.attachDOMEvent(this.container, 'mouseleave', mouseOutHandler)
  }

  render (): void {
    const { icons, oldVnode, linkContainer } = this
    const children = icons.map(item => {
      const icon = createVNode('i.icon', createVNode('i.icon-inner', {
        style: {
          background: `url(${item.icon}) no-repeat`,
          'background-size': '100%'
        }
      }, ''))
      const iconWrapper = createVNode('div.icon-wrapper', icon)
      const itemSelector = `li.item.${item.type}`

      return createVNode(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event as PickerMouseEvent, item)
          }
        }
      }, iconWrapper)
    })

    const vnode = createVNode('ul', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(linkContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event: PickerMouseEvent, item: LinkToolItem): void {
    event.preventDefault()
    event.stopPropagation()
    const { contentState } = this.muya as LinkToolsMuyaLike
    const options = this.options as BaseFloatOptions & LinkToolsOptionsLike
    const linkInfo = this.linkInfo as LinkInfo
    switch (item.type) {
      case 'unlink':
        contentState.unlink(linkInfo)
        this.hide()
        break
      case 'jump':
        options.jumpClick!(linkInfo)
        this.hide()
        break
      default:
        break
    }
  }
}

export default LinkTools
