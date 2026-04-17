import Popper from 'popper.js/dist/esm/popper'
import resizeDetector from 'element-resize-detector'
import { noop } from '../../utils'
import { EVENT_KEYS } from '../../config'
import './index.css'

export interface BaseFloatEventCenterLike {
  attachDOMEvent(
    target: EventTarget & {
      addEventListener(event: string, listener: EventListenerOrEventListenerObject, capture?: boolean): void
      removeEventListener(event: string, listener: EventListenerOrEventListenerObject, capture?: boolean): void
    },
    event: string,
    listener: (...args: unknown[]) => void,
    capture?: boolean
  ): string | false
  dispatch(event: string, ...data: unknown[]): void
}

export interface MuyaLike {
  container: HTMLElement
  eventCenter: BaseFloatEventCenterLike
}

export interface FloatReferenceLike {
  getBoundingClientRect(): DOMRect | ClientRect
  clientWidth: number
  clientHeight: number
  id: string | null
}

export type FloatReference = HTMLElement | FloatReferenceLike
export type BaseFloatCallback = (...args: unknown[]) => void

interface FloatOffsetModifier {
  offset: string
}

interface FloatModifiers {
  offset: FloatOffsetModifier
  [key: string]: unknown
}

export interface BaseFloatOptions {
  placement: string
  modifiers: FloatModifiers
  showArrow: boolean
}

interface PopperOptions {
  placement: string
  modifiers: FloatModifiers
}

interface PopperLike {
  update(): void
  destroy(): void
}

interface PopperConstructor {
  new (reference: FloatReference, popper: HTMLElement, options: PopperOptions): PopperLike
}

interface ResizeDetectorLike {
  listenTo(element: Element, listener: (element: HTMLElement) => void): void
  uninstall(element: Element): void
}

interface ResizeDetectorFactory {
  (options: { strategy: string }): ResizeDetectorLike
}

const defaultOptions = (): BaseFloatOptions => ({
  placement: 'bottom-start',
  modifiers: {
    offset: {
      offset: '0, 12'
    }
  },
  showArrow: true
})

const PopperCtor = Popper as unknown as PopperConstructor
const createResizeDetector = resizeDetector as unknown as ResizeDetectorFactory

class BaseFloat {
  name: string
  muya: MuyaLike
  options: BaseFloatOptions
  status: boolean
  floatBox!: HTMLDivElement
  container!: HTMLDivElement
  popper: PopperLike | null
  lastScrollTop: number | null
  resizeDetector: ResizeDetectorLike | null
  cb: BaseFloatCallback

  constructor (muya: MuyaLike, name: string, options: Partial<BaseFloatOptions> = {}) {
    this.name = name
    this.muya = muya
    this.options = Object.assign({}, defaultOptions(), options)
    this.status = false
    this.popper = null
    this.lastScrollTop = null
    this.resizeDetector = null
    this.cb = noop as BaseFloatCallback
    this.init()
  }

  init (): void {
    const { showArrow } = this.options
    const floatBox = document.createElement('div')
    const container = document.createElement('div')
    // Use to remember whick float container is shown.
    container.classList.add(this.name)
    container.classList.add('ag-float-container')
    floatBox.classList.add('ag-float-wrapper')

    if (showArrow) {
      const arrow = document.createElement('div')
      arrow.setAttribute('x-arrow', '')
      arrow.classList.add('ag-popper-arrow')
      floatBox.appendChild(arrow)
    }

    floatBox.appendChild(container)
    document.body.appendChild(floatBox)
    this.resizeDetector = createResizeDetector({
      strategy: 'scroll'
    })

    // use polyfill
    this.resizeDetector.listenTo(container, element => {
      const { offsetWidth, offsetHeight } = element
      Object.assign(floatBox.style, { width: `${offsetWidth}px`, height: `${offsetHeight}px` })
      if (this.popper) {
        this.popper.update()
      }
    })

    this.floatBox = floatBox
    this.container = container
  }

  listen (): void {
    const { eventCenter, container } = this.muya
    const { floatBox } = this
    const keydownHandler = (...args: unknown[]): void => {
      const keyboardEvent = args[0] as KeyboardEvent
      if (keyboardEvent.key === EVENT_KEYS.Escape) {
        this.hide()
      }
    }
    const scrollHandler = (...args: unknown[]): void => {
      const event = args[0] as Event
      const target = event.target as HTMLElement | null
      const scrollTop = target?.scrollTop

      if (typeof scrollTop !== 'number') {
        return
      }

      if (typeof this.lastScrollTop !== 'number') {
        this.lastScrollTop = scrollTop
        return
      }
      // only when scoll distance great than 50px, then hide the float box.
      if (this.status && Math.abs(scrollTop - this.lastScrollTop) > 50) {
        this.hide()
      }
    }

    eventCenter.attachDOMEvent(document, 'click', this.hide.bind(this) as (...args: unknown[]) => void)
    eventCenter.attachDOMEvent(floatBox, 'click', (...args: unknown[]) => {
      const event = args[0] as Event
      event.stopPropagation()
      event.preventDefault()
    })
    eventCenter.attachDOMEvent(container, 'keydown', keydownHandler)
    eventCenter.attachDOMEvent(container, 'scroll', scrollHandler)
  }

  hide (): void {
    const { eventCenter } = this.muya
    if (!this.status) return
    this.status = false
    if (this.popper?.destroy) {
      this.popper.destroy()
    }
    this.cb = noop as BaseFloatCallback
    eventCenter.dispatch('muya-float', this, false)
    this.lastScrollTop = null
  }

  show (reference: FloatReference, cb: BaseFloatCallback = noop as BaseFloatCallback): void {
    const { floatBox } = this
    const { eventCenter } = this.muya
    const { placement, modifiers } = this.options
    if (this.popper?.destroy) {
      this.popper.destroy()
    }
    this.cb = cb
    this.popper = new PopperCtor(reference, floatBox, {
      placement,
      modifiers
    })
    this.status = true
    eventCenter.dispatch('muya-float', this, true)
  }

  destroy (): void {
    if (this.popper?.destroy) {
      this.popper.destroy()
    }
    if (this.resizeDetector && this.container) {
      this.resizeDetector.uninstall(this.container)
    }
    this.floatBox.remove()
  }
}

export default BaseFloat
