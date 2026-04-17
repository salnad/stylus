import BaseScrollFloat from '../baseScrollFloat'
import type {
  BaseFloatCallback,
  BaseFloatEventCenterLike,
  FloatReference,
  MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import Emoji from '../emojis'
import { patch, h } from '../../parser/render/snabbdom'
import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface EmojiItem {
  aliases: string[]
  description: string
  emoji: string
  [key: string]: unknown
}

type EmojiRenderMap = Record<string, EmojiItem[]>

interface EmojiPickerEventPayload {
  reference?: FloatReference
  emojiNode?: Element | false | null
}

interface EmojiPickerEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-emoji-picker', listener: (payload: EmojiPickerEventPayload) => void): void
}

interface EmojiPickerContentStateLike {
  setEmoji(item: EmojiItem): void
}

interface EmojiServiceLike {
  search(text: string): EmojiRenderMap
  destroy(): void
}

interface SnabbdomDataLike {
  dataset?: Record<string, string>
  props?: Record<string, unknown>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

interface MuyaLike extends BaseFloatMuyaLike {
  eventCenter: EmojiPickerEventCenterLike
  contentState: EmojiPickerContentStateLike
}

const createVNode = h as unknown as SnabbdomHelper

class EmojiPicker extends BaseScrollFloat<EmojiItem> {
  static pluginName = 'emojiPicker'

  _renderObj: EmojiRenderMap
  oldVnode: RenderVNode | null
  emoji: EmojiServiceLike

  constructor (muya: BaseFloatMuyaLike) {
    const name = 'ag-emoji-picker'
    super(muya, name)
    this._renderObj = {}
    this.renderArray = []
    this.activeItem = null
    this.oldVnode = null
    this.emoji = new Emoji() as unknown as EmojiServiceLike
    this.listen()
  }

  get renderObj (): EmojiRenderMap {
    return this._renderObj
  }

  set renderObj (obj: EmojiRenderMap) {
    this._renderObj = obj
    const renderArray: EmojiItem[] = []
    Object.keys(obj).forEach(key => {
      renderArray.push(...obj[key])
    })
    this.renderArray = renderArray
    if (this.renderArray.length > 0) {
      this.activeItem = this.renderArray[0]
      const activeEle = this.getItemElement(this.activeItem)
      this.activeEleScrollIntoView(activeEle)
    }
  }

  listen (): void {
    super.listen()
    const { eventCenter } = this.muya as MuyaLike
    const contentState = (this.muya as MuyaLike).contentState
    eventCenter.subscribe('muya-emoji-picker', ({ reference, emojiNode }) => {
      if (!emojiNode) return this.hide()
      const text = emojiNode.textContent?.trim() || ''
      if (text) {
        const renderObj = this.emoji.search(text)
        this.renderObj = renderObj
        const cb = (item: EmojiItem | null): void => {
          if (item) {
            contentState.setEmoji(item)
          }
        }
        if (this.renderArray.length && reference) {
          this.show(reference, cb as BaseFloatCallback)
          this.render()
        } else {
          this.hide()
        }
      }
    })
  }

  render (): void {
    const { scrollElement, _renderObj, activeItem, oldVnode } = this
    const children = Object.keys(_renderObj).map(category => {
      const title = createVNode('div.title', category)
      const emojis = _renderObj[category].map(item => {
        const selector = activeItem === item ? 'div.item.active' : 'div.item'
        const label = item.aliases[0] ?? ''
        return createVNode(selector, {
          dataset: { label },
          props: { title: item.description },
          on: {
            click: () => {
              this.selectItem(item)
            }
          }
        }, createVNode('span', item.emoji))
      })

      return createVNode('section', [title, createVNode('div.emoji-wrapper', emojis)])
    })

    const vnode = createVNode('div', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(scrollElement as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  getItemElement (item: EmojiItem | null): Element | null {
    const label = item?.aliases[0]
    if (!label) {
      return null
    }

    return this.floatBox.querySelector(`[data-label="${label}"]`)
  }

  destroy (): void {
    super.destroy()
    this.emoji.destroy()
  }
}

export default EmojiPicker
