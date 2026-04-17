import type { BaseFloatEventCenterLike } from '../baseFloat'
import './index.css'

const CIRCLES = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

type CirclePosition = typeof CIRCLES[number]

const CIRCLE_RADIO = 6

interface ImageInfoTokenRange {
  start: number
  end: number
}

interface ImageInfoToken {
  type?: string
  range: ImageInfoTokenRange
  attrs: Record<string, string>
  [key: string]: unknown
}

interface ImageInfo {
  imageId: string
  key: string
  token: ImageInfoToken
}

interface TransformerReference extends Element {
  getBoundingClientRect(): DOMRect | ClientRect
  querySelector(selectors: 'img'): HTMLImageElement | null
}

interface TransformerEventPayload {
  reference: TransformerReference | null
  imageInfo?: ImageInfo
}

interface TransformerContentStateLike {
  updateImage(imageInfo: ImageInfo, attrName: string, attrValue: string | number): void
}

interface TransformerMuyaLike {
  eventCenter: BaseFloatEventCenterLike
  container: HTMLElement
  contentState: unknown
}

interface TransformerEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-transformer', listener: (payload: TransformerEventPayload) => void): void
  detachDOMEvent(eventId?: string | false): false | void
}

class Transformer {
  static pluginName = 'transformer'

  muya: TransformerMuyaLike
  options: Record<string, unknown> | undefined
  reference: TransformerReference | null
  imageInfo: ImageInfo | null
  movingAnchor: CirclePosition | null
  status: boolean
  width: number | null
  eventId: Array<string | false>
  lastScrollTop: number | null
  resizing: boolean
  container: HTMLDivElement

  constructor (muya: TransformerMuyaLike, options?: Record<string, unknown>) {
    this.muya = muya
    this.options = options
    this.reference = null
    this.imageInfo = null
    this.movingAnchor = null
    this.status = false
    this.width = null
    this.eventId = []
    this.lastScrollTop = null
    this.resizing = false
    const container = this.container = document.createElement('div')
    container.classList.add('ag-transformer')
    document.body.appendChild(container)
    this.listen()
  }

  listen (): void {
    const { container } = this.muya
    const eventCenter = this.muya.eventCenter as TransformerEventCenterLike
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
      if (!this.resizing && this.status && Math.abs(scrollTop - this.lastScrollTop) > 50) {
        this.hide()
      }
    }
    eventCenter.attachDOMEvent(document, 'click', this.hide.bind(this) as (...args: unknown[]) => void)
    eventCenter.attachDOMEvent(container, 'scroll', scrollHandler)
    eventCenter.attachDOMEvent(this.container, 'dragstart', (...args: unknown[]) => {
      const event = args[0] as Event
      event.preventDefault()
    })
    eventCenter.attachDOMEvent(document.body, 'mousedown', this.mouseDown)
  }

  render (): void {
    const { eventCenter } = this.muya
    if (this.status) {
      this.hide()
    }
    this.status = true

    this.createElements()
    this.update()
    eventCenter.dispatch('muya-float', this, true)
  }

  createElements (): void {
    CIRCLES.forEach(circlePosition => {
      const circle = document.createElement('div')
      circle.classList.add('circle')
      circle.classList.add(circlePosition)
      circle.setAttribute('data-position', circlePosition)
      this.container.appendChild(circle)
    })
  }

  update (): void {
    const rect = (this.reference as TransformerReference).getBoundingClientRect()
    CIRCLES.forEach(circlePosition => {
      const circle = this.container.querySelector<HTMLElement>(`.${circlePosition}`)
      if (!circle) {
        return
      }

      switch (circlePosition) {
        case 'top-left':
          circle.style.left = `${rect.left - CIRCLE_RADIO}px`
          circle.style.top = `${rect.top - CIRCLE_RADIO}px`
          break
        case 'top-right':
          circle.style.left = `${rect.left + rect.width - CIRCLE_RADIO}px`
          circle.style.top = `${rect.top - CIRCLE_RADIO}px`
          break
        case 'bottom-left':
          circle.style.left = `${rect.left - CIRCLE_RADIO}px`
          circle.style.top = `${rect.top + rect.height - CIRCLE_RADIO}px`
          break
        case 'bottom-right':
          circle.style.left = `${rect.left + rect.width - CIRCLE_RADIO}px`
          circle.style.top = `${rect.top + rect.height - CIRCLE_RADIO}px`
          break
      }
    })
  }

  mouseDown = (...args: unknown[]): void => {
    const event = args[0] as MouseEvent
    const target = event.target instanceof Element ? event.target : null
    if (!target?.closest('.circle')) return
    const eventCenter = this.muya.eventCenter as TransformerEventCenterLike
    this.movingAnchor = target.getAttribute('data-position') as CirclePosition
    const mouseMoveId = eventCenter.attachDOMEvent(document.body, 'mousemove', this.mouseMove)
    const mouseUpId = eventCenter.attachDOMEvent(document.body, 'mouseup', this.mouseUp)
    this.resizing = true
    // Hide image toolbar
    eventCenter.dispatch('muya-image-toolbar', { reference: null })
    this.eventId.push(mouseMoveId, mouseUpId)
  }

  mouseMove = (...args: unknown[]): void => {
    const event = args[0] as MouseEvent
    const clientX = event.clientX
    let width: number
    let relativeAnchor: HTMLElement | null = null
    const reference = this.reference as TransformerReference
    const image = reference.querySelector('img')
    if (!image) {
      return
    }
    switch (this.movingAnchor) {
      case 'top-left':
      case 'bottom-left':
        relativeAnchor = this.container.querySelector<HTMLElement>('.top-right')
        if (!relativeAnchor) {
          return
        }
        width = Math.max(relativeAnchor.getBoundingClientRect().left + CIRCLE_RADIO - clientX, 50)
        break
      case 'top-right':
      case 'bottom-right':
        relativeAnchor = this.container.querySelector<HTMLElement>('.top-left')
        if (!relativeAnchor) {
          return
        }
        width = Math.max(clientX - relativeAnchor.getBoundingClientRect().left - CIRCLE_RADIO, 50)
        break
      default:
        return
    }
    // Image width/height attribute must be an integer.
    width = parseInt(String(width), 10)
    this.width = width
    image.setAttribute('width', String(width))
    this.update()
  }

  mouseUp = (..._args: unknown[]): void => {
    const eventCenter = this.muya.eventCenter as TransformerEventCenterLike
    if (this.eventId.length) {
      for (const id of this.eventId) {
        eventCenter.detachDOMEvent(id)
      }
      this.eventId = []
    }
    // todo update data
    if (typeof this.width === 'number') {
      const contentState = this.muya.contentState as TransformerContentStateLike
      contentState.updateImage(this.imageInfo as ImageInfo, 'width', this.width)
      this.width = null
      this.hide()
    }
    this.resizing = false
    this.movingAnchor = null
  }

  hide (): void {
    const { eventCenter } = this.muya
    const circles = this.container.querySelectorAll('.circle')
    Array.from(circles).forEach(circle => circle.remove())
    this.status = false
    eventCenter.dispatch('muya-float', this, false)
  }
}

export default Transformer
