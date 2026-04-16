import { getLinkInfo } from '../utils/getLinkInfo'
import { collectFootnotes } from '../utils'

interface BlockLike {
  type?: string
  functionType?: string
  children?: BlockLike[]
  text?: string
}

interface EventCenterLike {
  attachDOMEvent(
    target: EventTarget,
    event: string,
    listener: (event: MouseEvent) => void,
    capture?: boolean
  ): string | false
  dispatch(event: string, ...data: unknown[]): void
}

interface ContentStateLike {
  blocks: BlockLike[]
  handleMouseDown(event: MouseEvent): void
  handleCellMouseDown(event: MouseEvent): void
}

interface MuyaLike {
  container: HTMLElement
  eventCenter: EventCenterLike
  contentState: ContentStateLike
  options: {
    hideLinkPopup?: boolean
    footnote?: boolean
  }
}

class MouseEventHandler {
  public muya: MuyaLike

  constructor (muya: MuyaLike) {
    this.muya = muya
    this.mouseBinding()
    this.mouseDown()
  }

  mouseBinding (): void {
    const { container, eventCenter } = this.muya
    const handler = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      const parent = target?.parentNode as HTMLElement | null
      const preSibling = target?.previousElementSibling as HTMLElement | null
      const parentPreSibling = parent ? parent.previousElementSibling as HTMLElement | null : null
      const { hideLinkPopup, footnote } = this.muya.options

      if (!parent) {
        return
      }

      const rect = parent.getBoundingClientRect()
      const reference = {
        getBoundingClientRect () {
          return rect
        }
      }

      if (
        !hideLinkPopup &&
        parent.tagName === 'A' &&
        parent.classList.contains('ag-inline-rule') &&
        parentPreSibling &&
        parentPreSibling.classList.contains('ag-hide')
      ) {
        eventCenter.dispatch('muya-link-tools', {
          reference,
          linkInfo: getLinkInfo(parent)
        })
      }

      if (
        footnote &&
        parent.tagName === 'SUP' &&
        parent.classList.contains('ag-inline-footnote-identifier') &&
        preSibling &&
        preSibling.classList.contains('ag-hide')
      ) {
        const identifier = target?.textContent ?? ''
        eventCenter.dispatch('muya-footnote-tool', {
          reference,
          identifier,
          footnotes: collectFootnotes(this.muya.contentState.blocks as unknown as Array<{
            type?: string
            functionType?: string
            children?: Array<{ text: string }>
          }>)
        })
      }
    }
    const leaveHandler = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      const parent = target?.parentNode as HTMLElement | null
      const preSibling = target?.previousElementSibling as HTMLElement | null
      const { footnote } = this.muya.options

      if (parent && parent.tagName === 'A' && parent.classList.contains('ag-inline-rule')) {
        eventCenter.dispatch('muya-link-tools', {
          reference: null
        })
      }

      if (
        footnote &&
        parent &&
        parent.tagName === 'SUP' &&
        parent.classList.contains('ag-inline-footnote-identifier') &&
        preSibling &&
        preSibling.classList.contains('ag-hide')
      ) {
        eventCenter.dispatch('muya-footnote-tool', {
          reference: null
        })
      }
    }

    eventCenter.attachDOMEvent(container, 'mouseover', handler)
    eventCenter.attachDOMEvent(container, 'mouseout', leaveHandler)
  }

  mouseDown (): void {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.classList?.contains('ag-drag-handler')) {
        contentState.handleMouseDown(event)
      } else if (target?.closest('tr')) {
        contentState.handleCellMouseDown(event)
      }
    }
    eventCenter.attachDOMEvent(container, 'mousedown', handler)
  }
}

export default MouseEventHandler
