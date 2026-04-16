import { EVENT_KEYS } from '../config'
import selection from '../selection'
import { findNearestParagraph } from '../selection/dom'
import { getParagraphReference, getImageInfo } from '../utils'
import { checkEditEmoji } from '../ui/emojis'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  anchor?: CursorPosition | null
  focus?: CursorPosition | null
  start?: CursorPosition | null
  end?: CursorPosition | null
}

interface FloatToolLike {
  name: string
  hide(): void
}

interface ImageTokenLike {
  src?: string
  attrs: {
    src?: string
    [key: string]: unknown
  }
}

interface SelectedImageLike {
  token: ImageTokenLike
  [key: string]: unknown
}

interface BlockLike {
  functionType?: string
  [key: string]: unknown
}

interface SelectionFormatsResult {
  formats: unknown[]
}

interface PositionReferenceRect {
  x: number
  y: number
  top: number
  left: number
  right: number
  bottom: number
  height: number
  width: number
}

interface PositionReferenceLike {
  getBoundingClientRect(): PositionReferenceRect
  clientWidth: number
  clientHeight: number
  id: string | null
}

interface EventCenterLike {
  subscribe(event: string, listener: (...args: unknown[]) => void): void
  attachDOMEvent(
    target: EventTarget,
    event: string,
    listener: (event: Event) => void,
    capture?: boolean
  ): string | false
  dispatch(event: string, ...data: unknown[]): void
}

interface ContentStateLike {
  selectedBlock: unknown
  selectedImage: SelectedImageLike | null
  cursor: {
    anchor: CursorPosition
    focus: CursorPosition
  }
  inputHandler(event: Event): void
  docEnterHandler(event: KeyboardEvent): unknown
  docBackspaceHandler(event: KeyboardEvent): unknown
  docDeleteHandler(event: KeyboardEvent): unknown
  docArrowHandler(event: KeyboardEvent): unknown
  backspaceHandler(event: KeyboardEvent): void
  deleteHandler(event: KeyboardEvent): void
  enterHandler(event: KeyboardEvent): void
  arrowHandler(event: KeyboardEvent): void
  tabHandler(event: KeyboardEvent): void
  checkEditLanguage(): {
    lang: string
    paragraph: (Element & { id: string }) | null
  }
  selectLanguage(paragraph: Element & { id: string }, lang: string): void
  checkNeedRender(cursor?: unknown): boolean
  partialRender(): unknown
  getBlock(key: string): BlockLike
  getPositionReference(): PositionReferenceLike
  selectionFormats(): SelectionFormatsResult
}

interface MuyaLike {
  container: HTMLElement
  eventCenter: EventCenterLike
  contentState: ContentStateLike
  dispatchSelectionChange(): void
  dispatchSelectionFormats(): void
  dispatchChange(): void
}

interface CodePickerItem {
  name: string
}

interface SelectionLike {
  getCursorRange(): CursorRangeLike
  getSelectionStart(): Element | null
}

const selectionApi = selection as unknown as SelectionLike

class Keyboard {
  public muya: MuyaLike
  public isComposed: boolean
  public shownFloat: Set<FloatToolLike>

  constructor (muya: MuyaLike) {
    this.muya = muya
    this.isComposed = false
    this.shownFloat = new Set()
    this.recordIsComposed()
    this.dispatchEditorState()
    this.keydownBinding()
    this.keyupBinding()
    this.inputBinding()
    this.listen()
  }

  listen (): void {
    // cache shown float box
    this.muya.eventCenter.subscribe('muya-float', (tool: unknown, status: unknown) => {
      const floatTool = tool as FloatToolLike
      const isShown = status as boolean
      isShown ? this.shownFloat.add(floatTool) : this.shownFloat.delete(floatTool)
      if (floatTool.name === 'ag-front-menu' && !isShown) {
        const selectedParagraph = this.muya.container.querySelector('.ag-selected')
        if (selectedParagraph) {
          this.muya.contentState.selectedBlock = null
          // prevent rerender, so change the class manually.
          selectedParagraph.classList.toggle('ag-selected')
        }
      }
    })
  }

  hideAllFloatTools (): void {
    for (const tool of this.shownFloat) {
      tool.hide()
    }
  }

  recordIsComposed (): void {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event: Event): void => {
      if (event.type === 'compositionstart') {
        this.isComposed = true
      } else if (event.type === 'compositionend') {
        this.isComposed = false
        // Because the compose event will not cause `input` event, So need call `inputHandler` by ourself
        contentState.inputHandler(event)
        eventCenter.dispatch('stateChange')
      }
    }

    eventCenter.attachDOMEvent(container, 'compositionend', handler)
    // eventCenter.attachDOMEvent(container, 'compositionupdate', handler)
    eventCenter.attachDOMEvent(container, 'compositionstart', handler)
  }

  dispatchEditorState (): void {
    const { container, eventCenter } = this.muya

    let timer: ReturnType<typeof setTimeout> | null = null
    const changeHandler = (event: Event): void => {
      const keyboardEvent = event as KeyboardEvent
      if (
        event.type === 'keyup' &&
        (keyboardEvent.key === EVENT_KEYS.ArrowUp || keyboardEvent.key === EVENT_KEYS.ArrowDown) &&
        this.shownFloat.size > 0
      ) {
        return
      }
      // Cursor outside editor area or over not editable elements.
      const target = event.target as Element | null
      if (target?.closest('[contenteditable=false]')) {
        return
      }

      // We need check cursor is null, because we may copy the html preview content,
      // and no need to dispatch change.
      const { start, end } = selectionApi.getCursorRange()
      if (!start || !end) {
        return
      }

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        this.muya.dispatchSelectionChange()
        this.muya.dispatchSelectionFormats()
        if (!this.isComposed && event.type === 'click') {
          this.muya.dispatchChange()
        }
      })
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }

  keydownBinding (): void {
    const { container, eventCenter, contentState } = this.muya
    const docHandler = (event: Event): unknown => {
      const keyboardEvent = event as KeyboardEvent
      switch (keyboardEvent.code) {
        case EVENT_KEYS.Enter:
          return contentState.docEnterHandler(keyboardEvent)
        case EVENT_KEYS.Space: {
          if (contentState.selectedImage) {
            const { token } = contentState.selectedImage
            const { src } = getImageInfo(token.src || token.attrs.src || '')
            if (src) {
              eventCenter.dispatch('preview-image', {
                data: src
              })
            }
          }
          break
        }
        case EVENT_KEYS.Backspace: {
          return contentState.docBackspaceHandler(keyboardEvent)
        }
        case EVENT_KEYS.Delete: {
          return contentState.docDeleteHandler(keyboardEvent)
        }
        case EVENT_KEYS.ArrowUp: // fallthrough
        case EVENT_KEYS.ArrowDown: // fallthrough
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowRight: // fallthrough
          return contentState.docArrowHandler(keyboardEvent)
      }
    }

    const handler = (event: Event): void => {
      const keyboardEvent = event as KeyboardEvent
      if (keyboardEvent.metaKey || keyboardEvent.ctrlKey) {
        container.classList.add('ag-meta-or-ctrl')
      }

      if (
        this.shownFloat.size > 0 &&
        (
          keyboardEvent.key === EVENT_KEYS.Enter ||
          keyboardEvent.key === EVENT_KEYS.Escape ||
          keyboardEvent.key === EVENT_KEYS.Tab ||
          keyboardEvent.key === EVENT_KEYS.ArrowUp ||
          keyboardEvent.key === EVENT_KEYS.ArrowDown
        )
      ) {
        let needPreventDefault = false

        for (const tool of this.shownFloat) {
          if (
            tool.name === 'ag-format-picker' ||
            tool.name === 'ag-table-picker' ||
            tool.name === 'ag-quick-insert' ||
            tool.name === 'ag-emoji-picker' ||
            tool.name === 'ag-front-menu' ||
            tool.name === 'ag-list-picker' ||
            tool.name === 'ag-image-selector'
          ) {
            needPreventDefault = true
            break
          }
        }
        if (needPreventDefault) {
          keyboardEvent.preventDefault()
        }
        // event.stopPropagation()
        return
      }
      switch (keyboardEvent.key) {
        case EVENT_KEYS.Backspace:
          contentState.backspaceHandler(keyboardEvent)
          break
        case EVENT_KEYS.Delete:
          contentState.deleteHandler(keyboardEvent)
          break
        case EVENT_KEYS.Enter:
          if (!this.isComposed) {
            contentState.enterHandler(keyboardEvent)
            this.muya.dispatchChange()
          }
          break
        case EVENT_KEYS.ArrowUp: // fallthrough
        case EVENT_KEYS.ArrowDown: // fallthrough
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowRight: // fallthrough
          if (!this.isComposed) {
            contentState.arrowHandler(keyboardEvent)
          }
          break
        case EVENT_KEYS.Tab:
          contentState.tabHandler(keyboardEvent)
          break
        default:
          break
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
    eventCenter.attachDOMEvent(document, 'keydown', docHandler)
  }

  inputBinding (): void {
    const { container, eventCenter, contentState } = this.muya
    const inputHandler = (event: Event): void => {
      if (!this.isComposed) {
        contentState.inputHandler(event)
        this.muya.dispatchChange()
      }

      const { lang, paragraph } = contentState.checkEditLanguage()
      if (lang) {
        const activeParagraph = paragraph as Element & { id: string }
        eventCenter.dispatch('muya-code-picker', {
          reference: getParagraphReference(activeParagraph, activeParagraph.id),
          lang,
          cb: (item: CodePickerItem) => {
            contentState.selectLanguage(activeParagraph, item.name)
          }
        })
      } else {
        // hide code picker float box
        eventCenter.dispatch('muya-code-picker', { reference: null })
      }
    }

    eventCenter.attachDOMEvent(container, 'input', inputHandler)
  }

  keyupBinding (): void {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event: Event): unknown => {
      const keyboardEvent = event as KeyboardEvent
      container.classList.remove('ag-meta-or-ctrl')
      // check if edit emoji
      const node = selectionApi.getSelectionStart()
      const paragraph = findNearestParagraph(node) as (Element & { id: string }) | null
      const emojiNode = checkEditEmoji(node)
      contentState.selectedImage = null
      if (
        paragraph &&
        emojiNode &&
        keyboardEvent.key !== EVENT_KEYS.Enter &&
        keyboardEvent.key !== EVENT_KEYS.ArrowDown &&
        keyboardEvent.key !== EVENT_KEYS.ArrowUp &&
        keyboardEvent.key !== EVENT_KEYS.Tab &&
        keyboardEvent.key !== EVENT_KEYS.Escape
      ) {
        const reference = getParagraphReference(emojiNode, paragraph.id)
        eventCenter.dispatch('muya-emoji-picker', {
          reference,
          emojiNode
        })
      }
      if (!emojiNode) {
        eventCenter.dispatch('muya-emoji-picker', {
          emojiNode
        })
      }

      const { anchor, focus, start, end } = selectionApi.getCursorRange()
      if (!anchor || !focus) {
        return
      }
      if (
        !this.isComposed
      ) {
        const { anchor: oldAnchor, focus: oldFocus } = contentState.cursor
        if (
          anchor.key !== oldAnchor.key ||
          anchor.offset !== oldAnchor.offset ||
          focus.key !== oldFocus.key ||
          focus.offset !== oldFocus.offset
        ) {
          const needRender = contentState.checkNeedRender(contentState.cursor) || contentState.checkNeedRender({ start, end })
          contentState.cursor = { anchor, focus }
          if (needRender) {
            return contentState.partialRender()
          }
        }
      }

      const block = contentState.getBlock(anchor.key)
      if (
        anchor.key === focus.key &&
        anchor.offset !== focus.offset &&
        block.functionType !== 'codeContent' &&
        block.functionType !== 'languageInput'
      ) {
        const reference = contentState.getPositionReference()
        const { formats } = contentState.selectionFormats()
        eventCenter.dispatch('muya-format-picker', { reference, formats })
      } else {
        eventCenter.dispatch('muya-format-picker', { reference: null })
      }
    }

    eventCenter.attachDOMEvent(container, 'keyup', handler) // temp use input event
  }
}

export default Keyboard
