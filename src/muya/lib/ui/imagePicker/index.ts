import BaseScrollFloat from '../baseScrollFloat'
import type {
  BaseFloatCallback,
  BaseFloatEventCenterLike,
  FloatReference,
  MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import FolderIcon from '../../assets/icons/folder.svg'
import ImageIcon from '../../assets/icons/image.svg'
import UploadIcon from '../../assets/icons/upload.svg'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface SvgIconLike {
  url: string
  viewBox: string
}

const iconHash = {
  'icon-image': ImageIcon,
  'icon-folder': FolderIcon,
  'icon-upload': UploadIcon
} as const satisfies Record<string, SvgIconLike>

interface ImagePickerItem {
  text: string
  iconClass: keyof typeof iconHash
}

type ImagePickerCallback = (item: ImagePickerItem) => void

interface ImagePickerEventPayload {
  reference: FloatReference
  list: ImagePickerItem[]
  cb: ImagePickerCallback
}

interface ImagePickerEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-image-picker', listener: (payload: ImagePickerEventPayload) => void): void
}

interface SnabbdomVNodeLike {
  children?: unknown[]
  elm?: Element & { innerHTML: string }
}

interface SnabbdomHookLike {
  prepatch?: (...args: unknown[]) => void
}

interface SnabbdomDataLike {
  attrs?: Record<string, string>
  dataset?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  hook?: SnabbdomHookLike
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper

class ImagePathPicker extends BaseScrollFloat<ImagePickerItem> {
  static pluginName = 'imagePathPicker'
  oldVnode: RenderVNode | null

  constructor (muya: BaseFloatMuyaLike) {
    const name = 'ag-list-picker'
    super(muya, name)
    this.renderArray = []
    this.oldVnode = null
    this.activeItem = null
    this.floatBox.classList.add('ag-image-picker-wrapper')
    this.listen()
  }

  listen (): void {
    super.listen()
    const { eventCenter } = this.muya as unknown as { eventCenter: ImagePickerEventCenterLike }
    eventCenter.subscribe('muya-image-picker', ({ reference, list, cb }) => {
      if (list.length) {
        this.show(reference, cb as BaseFloatCallback)
        this.renderArray = list
        this.activeItem = list[0]
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render (): void {
    const { renderArray, oldVnode, scrollElement, activeItem } = this
    const children = renderArray.map(item => {
      const { text, iconClass } = item
      const iconInfo = iconHash[iconClass]
      const icon = createVNode('div.icon-wrapper', createVNode('svg', {
        attrs: {
          viewBox: iconInfo.viewBox,
          'aria-hidden': 'true'
        },
        hook: {
          prepatch (...args) {
            const [oldVnode] = args as [SnabbdomVNodeLike, SnabbdomVNodeLike]
            // cheat snabbdom that the pre block is changed!!!
            oldVnode.children = []
            if (oldVnode.elm) {
              oldVnode.elm.innerHTML = ''
            }
          }
        }
      }, createVNode('use', {
        attrs: {
          'xlink:href': iconInfo.url
        }
      }, [])))
      const textElement = createVNode('div.language', text)
      const selector = activeItem === item ? 'li.item.active' : 'li.item'
      return createVNode(selector, {
        dataset: {
          label: item.text
        },
        on: {
          click: () => {
            this.selectItem(item)
          }
        }
      }, [icon, textElement])
    })

    const vnode = createVNode('ul', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(scrollElement as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  getItemElement (item: ImagePickerItem | null): Element | null {
    const text = item?.text
    if (!text) {
      return null
    }

    return this.floatBox.querySelector(`[data-label="${text}"]`)
  }
}

export default ImagePathPicker
