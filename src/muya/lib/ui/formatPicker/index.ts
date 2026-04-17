import BaseFloat, {
  type BaseFloatEventCenterLike,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import icons, { type FormatPickerIconEntry } from './config'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface SelectionFormat {
  type: string
  tag?: string
  [key: string]: unknown
}

interface SelectionFormatsResult {
  formats: SelectionFormat[]
}

interface ContentStateLike {
  render(): void
  format(type: string): void
  selectionFormats(): SelectionFormatsResult
}

interface FormatPickerEventPayload {
  reference: FloatReference | null
  formats?: SelectionFormat[]
}

interface FormatPickerEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-format-picker', listener: (payload: FormatPickerEventPayload) => void): void
}

interface FormatPickerMuyaLike extends BaseFloatMuyaLike {
  contentState: ContentStateLike
  eventCenter: FormatPickerEventCenterLike
}

interface SnabbdomDataLike {
  attrs?: Record<string, string>
  style?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

interface PickerMouseEvent {
  preventDefault(): void
  stopPropagation(): void
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper

const defaultOptions: Partial<BaseFloatOptions> = {
  placement: 'top',
  modifiers: {
    offset: {
      offset: '0, 5'
    }
  },
  showArrow: false
}

class FormatPicker extends BaseFloat {
  static pluginName = 'formatPicker'

  oldVnode: RenderVNode | null
  formats: SelectionFormat[] | null
  icons: FormatPickerIconEntry[]
  formatContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike, options: Partial<BaseFloatOptions> = {}) {
    const name = 'ag-format-picker'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.formats = null
    this.icons = icons
    const formatContainer = this.formatContainer = document.createElement('div')
    this.container.appendChild(formatContainer)
    this.floatBox.classList.add('ag-format-picker-container')
    this.listen()
  }

  listen (): void {
    const { eventCenter } = this.muya as unknown as FormatPickerMuyaLike
    super.listen()
    eventCenter.subscribe('muya-format-picker', ({ reference, formats }) => {
      if (reference) {
        this.formats = formats || []
        setTimeout(() => {
          this.show(reference)
          this.render()
        }, 0)
      } else {
        this.hide()
      }
    })
  }

  render (): void {
    const { icons, oldVnode, formatContainer, formats } = this
    const activeFormats = formats || []
    const children = icons.map(item => {
      let icon: RenderVNode | undefined
      const iconWrapperSelector = 'div.icon-wrapper'
      if (item.icon) {
        // SVG icon Asset
        icon = createVNode('i.icon', createVNode('i.icon-inner', {
          style: {
            background: `url(${item.icon}) no-repeat`,
            'background-size': '100%'
          }
        }, ''))
      }
      const iconWrapper = createVNode(iconWrapperSelector, icon)

      let itemSelector = `li.item.${item.type}`
      if (activeFormats.some(format => format.type === item.type || (format.type === 'html_tag' && format.tag === item.type))) {
        itemSelector += '.active'
      }
      return createVNode(itemSelector, {
        attrs: {
          title: `${item.tooltip} ${item.shortcut}`
        },
        on: {
          click: event => {
            this.selectItem(event as PickerMouseEvent, item)
          }
        }
      }, [iconWrapper])
    })

    const vnode = createVNode('ul', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(formatContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event: PickerMouseEvent, item: FormatPickerIconEntry): void {
    event.preventDefault()
    event.stopPropagation()
    const { contentState } = this.muya as unknown as FormatPickerMuyaLike
    contentState.render()
    contentState.format(item.type)
    if (/link|image/.test(item.type)) {
      this.hide()
    } else {
      const { formats } = contentState.selectionFormats()
      this.formats = formats
      this.render()
    }
  }
}

export default FormatPicker
