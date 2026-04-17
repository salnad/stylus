import BaseFloat, {
  type BaseFloatEventCenterLike,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import WarningIcon from '../../assets/pngicon/warning/2.png'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface FootnoteReference {
  getBoundingClientRect(): DOMRect | ClientRect
}

interface FootnoteBlock {
  key: string
  text?: string
  children: FootnoteBlock[]
  [key: string]: unknown
}

type FootnoteMap = Map<string, FootnoteBlock>

interface FootnoteToolEventPayload {
  reference: FootnoteReference | null
  identifier?: string
  footnotes?: FootnoteMap
}

interface FootnoteToolEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-footnote-tool', listener: (payload: FootnoteToolEventPayload) => void): void
}

interface FootnoteToolContentStateLike {
  createFootnote(identifier: string): void
}

interface FootnoteToolMuyaLike extends BaseFloatMuyaLike {
  eventCenter: FootnoteToolEventCenterLike
  contentState: FootnoteToolContentStateLike
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

const getFootnoteText = (block: FootnoteBlock): string => {
  let text = ''
  const travel = (currentBlock: FootnoteBlock): void => {
    if (currentBlock.children.length === 0 && currentBlock.text) {
      text += currentBlock.text
    } else if (currentBlock.children.length) {
      for (const child of currentBlock.children) {
        travel(child)
      }
    }
  }

  const blocks = block.children.slice(1)
  for (const child of blocks) {
    travel(child)
  }

  return text
}

const defaultOptions: Partial<BaseFloatOptions> = {
  placement: 'bottom',
  modifiers: {
    offset: {
      offset: '0, 5'
    }
  },
  showArrow: false
}

class FootnoteTool extends BaseFloat {
  static pluginName = 'footnoteTool'

  oldVnode: RenderVNode | null
  identifier: string | null
  footnotes: FootnoteMap | null
  hideTimer: ReturnType<typeof setTimeout> | null
  toolContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike, options: Partial<BaseFloatOptions> = {}) {
    const name = 'ag-footnote-tool'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.identifier = null
    this.footnotes = null
    this.hideTimer = null
    const toolContainer = this.toolContainer = document.createElement('div')
    this.container.appendChild(toolContainer)
    this.floatBox.classList.add('ag-footnote-tool-container')
    this.listen()
  }

  listen (): void {
    const { eventCenter } = this.muya as FootnoteToolMuyaLike
    super.listen()
    eventCenter.subscribe('muya-footnote-tool', ({ reference, identifier, footnotes }) => {
      if (reference) {
        this.footnotes = footnotes ?? null
        this.identifier = identifier ?? null
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
    const { oldVnode, toolContainer } = this
    const identifier = this.identifier ?? ''
    const footnotes = this.footnotes ?? new Map<string, FootnoteBlock>()
    const hasFootnote = footnotes.has(identifier)
    const icon = createVNode('i.icon', createVNode('i.icon-inner', {
      style: {
        background: `url(${WarningIcon}) no-repeat`,
        'background-size': '100%'
      }
    }, ''))
    const iconWrapper = createVNode('div.icon-wrapper', icon)

    let text = 'Can\'t find footnote with syntax [^abc]:'
    if (hasFootnote) {
      const footnoteBlock = footnotes.get(identifier)
      if (footnoteBlock) {
        text = getFootnoteText(footnoteBlock)
        if (!text) {
          text = 'Input the footnote definition...'
        }
      }
    }

    const textNode = createVNode('span.text', text)
    const button = createVNode('a.btn', {
      on: {
        click: event => {
          this.buttonClick(event as PickerMouseEvent, hasFootnote)
        }
      }
    }, hasFootnote ? 'Go to' : 'Create')
    const children: RenderVNode[] = [textNode, button]

    if (!hasFootnote) {
      children.unshift(iconWrapper)
    }

    const vnode = createVNode('div', children)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(toolContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  buttonClick (event: PickerMouseEvent, hasFootnote: boolean): void {
    event.preventDefault()
    event.stopPropagation()

    const identifier = this.identifier ?? ''
    const footnotes = this.footnotes ?? new Map<string, FootnoteBlock>()
    if (hasFootnote) {
      const block = footnotes.get(identifier)
      const key = block?.key
      const element = key ? document.querySelector<HTMLElement>(`#${key}`) : null
      element?.scrollIntoView({ behavior: 'smooth' })
    } else {
      const { contentState } = this.muya as FootnoteToolMuyaLike
      contentState.createFootnote(identifier)
    }

    this.hide()
  }
}

export default FootnoteTool
