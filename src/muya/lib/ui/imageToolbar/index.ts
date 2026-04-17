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

type ImageAlign = 'inline' | 'left' | 'center' | 'right'

interface ImageToolbarReference {
  getBoundingClientRect(): DOMRect | ClientRect
}

interface ImageInfoTokenRange {
  start: number
  end: number
}

interface ImageInfoToken {
  type?: string
  range?: ImageInfoTokenRange
  attrs: Record<string, string>
  [key: string]: unknown
}

interface ImageInfo {
  imageId: string
  key: string
  token: ImageInfoToken
}

interface ImageToolbarItem {
  type: 'edit' | ImageAlign | 'delete'
  tooltip: string
  icon: string
}

interface ImageToolbarEventPayload {
  reference: ImageToolbarReference | null
  imageInfo?: ImageInfo
}

interface TransformerEventPayload {
  reference: Element | null
}

interface ImageSelectorReference {
  getBoundingClientRect(): DOMRect | ClientRect
}

interface ImageSelectorEventPayload {
  reference: ImageSelectorReference | null
  imageInfo?: ImageInfo
  cb?: () => void
}

interface ImageToolbarEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-image-toolbar', listener: (payload: ImageToolbarEventPayload) => void): void
  dispatch(event: 'muya-transformer', payload: TransformerEventPayload): void
  dispatch(event: 'muya-image-selector', payload: ImageSelectorEventPayload): void
}

interface ImageToolbarContentStateLike {
  deleteImage(imageInfo: ImageInfo): void
  updateImage(imageInfo: ImageInfo, attrName: string, attrValue: string | number): void
}

interface ImageToolbarMuyaLike extends BaseFloatMuyaLike {
  eventCenter: ImageToolbarEventCenterLike
  contentState: ImageToolbarContentStateLike
}

interface PickerMouseEvent {
  preventDefault(): void
  stopPropagation(): void
}

interface SnabbdomDataLike {
  style?: Record<string, string>
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
  placement: 'top',
  modifiers: {
    offset: {
      offset: '0, 10'
    }
  },
  showArrow: false
}

class ImageToolbar extends BaseFloat {
  static pluginName = 'imageToolbar'

  oldVnode: RenderVNode | null
  imageInfo: ImageInfo | null
  icons: ImageToolbarItem[]
  reference: ImageToolbarReference | null
  toolbarContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike, options: Partial<BaseFloatOptions> = {}) {
    const name = 'ag-image-toolbar'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.imageInfo = null
    this.icons = icons as ImageToolbarItem[]
    this.reference = null
    const toolbarContainer = this.toolbarContainer = document.createElement('div')
    this.container.appendChild(toolbarContainer)
    this.floatBox.classList.add('ag-image-toolbar-container')
    this.listen()
  }

  listen (): void {
    const { eventCenter } = this.muya as ImageToolbarMuyaLike
    super.listen()
    eventCenter.subscribe('muya-image-toolbar', ({ reference, imageInfo }) => {
      this.reference = reference
      if (reference) {
        this.imageInfo = imageInfo ?? null
        setTimeout(() => {
          this.show(reference as unknown as FloatReference)
          this.render()
        }, 0)
      } else {
        this.hide()
      }
    })
  }

  render (): void {
    const { icons, oldVnode, toolbarContainer } = this
    const imageInfo = this.imageInfo as ImageInfo
    const { attrs } = imageInfo.token
    const dataAlign = attrs['data-align']
    const children = icons.map(item => {
      const icon = createVNode('i.icon', createVNode('i.icon-inner', {
        style: {
          background: `url(${item.icon}) no-repeat`,
          'background-size': '100%'
        }
      }, ''))
      const iconWrapper = createVNode('div.icon-wrapper', icon)
      let itemSelector = `li.item.${item.type}`

      if (item.type === dataAlign || (!dataAlign && item.type === 'inline')) {
        itemSelector += '.active'
      }
      return createVNode(itemSelector, {
        dataset: {
          tip: item.tooltip
        },
        on: {
          click: event => {
            this.selectItem(event as PickerMouseEvent, item)
          }
        }
      }, [createVNode('div.tooltip', item.tooltip), iconWrapper])
    })

    const vnode = createVNode('ul', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(toolbarContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event: PickerMouseEvent, item: ImageToolbarItem): void {
    event.preventDefault()
    event.stopPropagation()

    const { eventCenter, contentState } = this.muya as ImageToolbarMuyaLike
    const imageInfo = this.imageInfo as ImageInfo
    switch (item.type) {
      case 'delete':
        contentState.deleteImage(imageInfo)
        eventCenter.dispatch('muya-transformer', {
          reference: null
        })
        this.hide()
        break
      case 'edit': {
        const reference = this.reference as ImageToolbarReference
        const rect = reference.getBoundingClientRect() as DOMRect & { height: number }
        const nextReference: ImageSelectorReference = {
          getBoundingClientRect () {
            rect.height = 0
            return rect
          }
        }
        eventCenter.dispatch('muya-transformer', {
          reference: null
        })
        eventCenter.dispatch('muya-image-selector', {
          reference: nextReference,
          imageInfo,
          cb: () => {}
        })
        this.hide()
        break
      }
      case 'inline':
      case 'left':
      case 'center':
      case 'right':
        contentState.updateImage(imageInfo, 'data-align', item.type)
        this.hide()
        break
      default:
        break
    }
  }
}

export default ImageToolbar
