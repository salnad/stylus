import BaseFloat, {
  type BaseFloatCallback,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike
} from '../baseFloat'
import { EVENT_KEYS } from '../../config'

type ScrollDirection = 'previous' | 'next'

const isHTMLElementReference = (reference: FloatReference): reference is HTMLElement => {
  return reference instanceof HTMLElement
}

class BaseScrollFloat<TItem = unknown> extends BaseFloat {
  scrollElement!: HTMLDivElement
  reference: FloatReference | null
  activeItem: TItem | null
  renderArray: TItem[]

  constructor (muya: MuyaLike, name: string, options: Partial<BaseFloatOptions> = {}) {
    super(muya, name, options)
    this.reference = null
    this.activeItem = null
    this.renderArray = []
    this.createScrollElement()
  }

  createScrollElement (): void {
    const { container } = this
    const scrollElement = document.createElement('div')
    container.appendChild(scrollElement)
    this.scrollElement = scrollElement
  }

  activeEleScrollIntoView (element: Element | null): void {
    if (element) {
      element.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'start'
      })
    }
  }

  listen (): void {
    super.listen()
    const { eventCenter, container } = this.muya
    const handler = (event: unknown): void => {
      const keyboardEvent = event as KeyboardEvent
      if (!this.status) return
      switch (keyboardEvent.key) {
        case EVENT_KEYS.ArrowUp:
          this.step('previous')
          break
        case EVENT_KEYS.ArrowDown:
        case EVENT_KEYS.Tab:
          this.step('next')
          break
        case EVENT_KEYS.Enter:
          this.selectItem(this.activeItem)
          break
        default:
          break
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  hide (): void {
    super.hide()
    this.reference = null
  }

  show (reference: FloatReference, cb: BaseFloatCallback): void {
    this.cb = cb
    if (isHTMLElementReference(reference)) {
      if (this.reference && this.reference === reference && this.status) return
    } else {
      if (
        this.reference &&
        !isHTMLElementReference(this.reference) &&
        this.reference.id === reference.id &&
        this.status
      ) {
        return
      }
    }

    this.reference = reference
    super.show(reference, cb)
  }

  step (direction: ScrollDirection): void {
    let index = this.renderArray.findIndex(item => {
      return item === this.activeItem
    })
    index = direction === 'next' ? index + 1 : index - 1
    if (index < 0 || index >= this.renderArray.length) {
      return
    }
    this.activeItem = this.renderArray[index]
    this.render()
    const activeElement = this.getItemElement(this.activeItem)
    this.activeEleScrollIntoView(activeElement)
  }

  selectItem (item: TItem | null): void {
    this.cb(item)
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }

  render (): void {}

  getItemElement (_item: TItem | null): Element | null {
    return null
  }
}

export default BaseScrollFloat
