import './index.css'

interface TooltipEventCenterLike {
  attachDOMEvent(
    target: EventTarget,
    type: string,
    listener: EventListener,
    capture?: boolean
  ): string | false
}

interface MuyaLike {
  container: HTMLElement
  eventCenter: TooltipEventCenterLike
}

interface TooltipAnchorLike extends HTMLElement {
  getAttribute(qualifiedName: string): string | null
}

type TooltipEventTarget = HTMLElement

const position = (source: HTMLElement, element: HTMLElement): void => {
  const rect = source.getBoundingClientRect()
  const { top, right, height } = rect

  Object.assign(element.style, {
    top: `${top + height + 15}px`,
    left: `${right - element.offsetWidth / 2 - 10}px`
  })
}

class Tooltip {
  muya: MuyaLike
  cache: WeakMap<HTMLElement, HTMLDivElement>

  constructor (muya: MuyaLike) {
    this.muya = muya
    this.cache = new WeakMap()
    const { container, eventCenter } = this.muya

    eventCenter.attachDOMEvent(container, 'mouseover', this.mouseOver.bind(this) as EventListener)
  }

  mouseOver (event: Event): void {
    const target = event.target as TooltipEventTarget | null
    const toolTipTarget = target?.closest('[data-tooltip]') as TooltipAnchorLike | null
    const { eventCenter } = this.muya
    if (toolTipTarget && !this.cache.has(toolTipTarget)) {
      const tooltip = toolTipTarget.getAttribute('data-tooltip')
      const tooltipElement = document.createElement('div')
      tooltipElement.textContent = tooltip
      tooltipElement.classList.add('ag-tooltip')
      document.body.appendChild(tooltipElement)
      position(toolTipTarget, tooltipElement)

      this.cache.set(toolTipTarget, tooltipElement)

      setTimeout(() => {
        tooltipElement.classList.add('active')
      })

      const timer = setInterval(() => {
        if (!document.body.contains(toolTipTarget)) {
          this.mouseLeave({
            target: toolTipTarget
          } as unknown as Event)
          clearInterval(timer)
        }
      }, 300)

      eventCenter.attachDOMEvent(toolTipTarget, 'mouseleave', this.mouseLeave.bind(this) as EventListener)
    }
  }

  mouseLeave (event: Event): void {
    const target = event.target as HTMLElement | null
    if (target && this.cache.has(target)) {
      const tooltipElement = this.cache.get(target)
      tooltipElement?.remove()
      this.cache.delete(target)
    }
  }
}

export default Tooltip
