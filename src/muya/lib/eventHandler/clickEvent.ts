import { operateClassName } from '../utils/domManipulate'
import { getImageInfo } from '../utils/getImageInfo'
import { CLASS_OR_ID } from '../config'
import selection from '../selection'

interface CursorPositionLike {
  key: string
  offset: number
}

interface CursorLike {
  start?: CursorPositionLike
  end?: CursorPositionLike
}

interface KeyboardLike {
  hideAllFloatTools(): void
}

interface ContentStateLike {
  selectedImage: unknown
  selectedTableCells: unknown
  getBlock(key: string): { key: string, text: string } | null
  findNextBlockInLocation(block: unknown): { key: string } | null
  cursor: CursorLike
  selectionChange(cursor?: CursorLike): unknown
  tableToolBarClick(type: string | null): void
  deleteImage(imageInfo: unknown): void
  selectImage(imageInfo: unknown): void
  handleContainerBlockClick(element: Element | null): void
  listItemCheckBoxClick(target: HTMLElement): void
  clickHandler(event: MouseEvent): void
  copyCodeBlock(event: MouseEvent): void
}

interface EventCenterLike {
  attachDOMEvent(target: EventTarget, event: string, listener: (event: MouseEvent) => void, capture?: boolean): string | false
  dispatch(event: string, ...data: unknown[]): void
}

interface MuyaLike {
  container: HTMLElement
  eventCenter: EventCenterLike
  contentState: ContentStateLike
  keyboard?: KeyboardLike
}

class ClickEvent {
  public muya: MuyaLike

  constructor (muya: MuyaLike) {
    this.muya = muya
    this.clickBinding()
    this.contextClickBingding()
  }

  contextClickBingding (): void {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event: MouseEvent): void => {
      if (!global || !global.marktext) {
        event.preventDefault()
        event.stopPropagation()
      }

      this.muya.keyboard?.hideAllFloatTools()

      const { start, end } = selection.getCursorRange() as { start?: { key: string, offset: number }, end?: { key: string, offset: number } }
      if (!start || !end) {
        return
      }

      const startBlock = contentState.getBlock(start.key)
      const nextTextBlock = startBlock ? contentState.findNextBlockInLocation(startBlock) : null
      if (
        startBlock &&
        nextTextBlock &&
        nextTextBlock.key === end.key &&
        end.offset === 0 &&
        start.offset === startBlock.text.length
      ) {
        contentState.cursor = {
          start,
          end: start
        }
        selection.setCursorRange(contentState.cursor)
      } else {
        contentState.cursor = {
          start,
          end
        }
      }

      const sectionChanges = contentState.selectionChange(contentState.cursor)
      eventCenter.dispatch('contextmenu', event, sectionChanges)
    }

    eventCenter.attachDOMEvent(container, 'contextmenu', handler)
  }

  clickBinding (): void {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      const toolItem = getToolItem(target)
      contentState.selectedImage = null
      contentState.selectedTableCells = null
      if (toolItem) {
        event.preventDefault()
        event.stopPropagation()
        const type = toolItem.getAttribute('data-label')
        const grandParent = toolItem.parentNode?.parentNode as HTMLElement | null
        if (grandParent?.classList.contains('ag-tool-table')) {
          contentState.tableToolBarClick(type)
        }
      }

      if (target.classList.contains('ag-drag-handler')) {
        event.preventDefault()
        event.stopPropagation()
        const rect = target.getBoundingClientRect()
        const reference = {
          getBoundingClientRect () {
            return rect
          },
          width: target.offsetWidth,
          height: target.offsetHeight
        }
        eventCenter.dispatch('muya-table-bar', {
          reference,
          tableInfo: {
            barType: target.classList.contains('left') ? 'left' : 'bottom'
          }
        })
      }

      const markedImageText = target.previousElementSibling as HTMLElement | null
      const mathRender = target.closest(`.${CLASS_OR_ID.AG_MATH_RENDER}`) as HTMLElement | null
      const rubyRender = target.closest(`.${CLASS_OR_ID.AG_RUBY_RENDER}`) as HTMLElement | null
      const imageWrapper = target.closest(`.${CLASS_OR_ID.AG_INLINE_IMAGE}`) as HTMLElement | null
      const codeCopy = target.closest('.ag-code-copy') as HTMLElement | null
      const footnoteBackLink = target.closest('.ag-footnote-backlink') as HTMLElement | null
      const imageDelete = target.closest('.ag-image-icon-delete') || target.closest('.ag-image-icon-close')
      const mathText = mathRender?.previousElementSibling as HTMLElement | null
      const rubyText = rubyRender?.previousElementSibling as HTMLElement | null

      if (markedImageText?.classList.contains(CLASS_OR_ID.AG_IMAGE_MARKED_TEXT)) {
        eventCenter.dispatch('format-click', {
          event,
          formatType: 'image',
          data: target.getAttribute('src')
        })
        selectionText(markedImageText)
      } else if (mathText) {
        selectionText(mathText)
      } else if (rubyText) {
        selectionText(rubyText)
      }

      if (codeCopy) {
        event.stopPropagation()
        event.preventDefault()
        contentState.copyCodeBlock(event)
        return
      }

      if (imageDelete && imageWrapper) {
        const imageInfo = getImageInfo(imageWrapper)
        event.preventDefault()
        event.stopPropagation()
        eventCenter.dispatch('muya-image-selector', { reference: null })
        contentState.deleteImage(imageInfo)
        return
      }

      if (footnoteBackLink) {
        event.preventDefault()
        event.stopPropagation()
        const figure = target.closest('figure')
        const identifier = figure?.querySelector('span.ag-footnote-input')?.textContent
        if (identifier) {
          const footnoteIdentifier = document.querySelector<HTMLElement>(`#noteref-${identifier}`)
          footnoteIdentifier?.scrollIntoView({ behavior: 'smooth' })
        }
        return
      }

      if (target.tagName === 'IMG' && imageWrapper) {
        const imageInfo = getImageInfo(imageWrapper)
        event.preventDefault()
        eventCenter.dispatch('select-image', imageInfo)
        const imageContainer = imageWrapper.querySelector('.ag-image-container') as HTMLElement | null
        if (imageContainer) {
          const rect = imageContainer.getBoundingClientRect()
          const reference = {
            getBoundingClientRect () {
              return rect
            },
            width: imageWrapper.offsetWidth,
            height: imageWrapper.offsetHeight
          }
          eventCenter.dispatch('muya-image-toolbar', {
            reference,
            imageInfo
          })
          contentState.selectImage(imageInfo)

          const imageSelector = (imageInfo as { imageId: string, key: string, token: { range: { start: number } } }).imageId.indexOf('_') > -1
            ? `#${(imageInfo as { imageId: string }).imageId}`
            : `#${(imageInfo as { key: string }).key}_${(imageInfo as { imageId: string }).imageId}_${(imageInfo as { token: { range: { start: number } } }).token.range.start}`

          const transformerTarget = document.querySelector(`${imageSelector} .ag-image-container`)
          eventCenter.dispatch('muya-transformer', {
            reference: transformerTarget,
            imageInfo
          })
        }
        return
      }

      if (
        imageWrapper &&
        (
          imageWrapper.classList.contains('ag-empty-image') ||
          imageWrapper.classList.contains('ag-image-fail')
        )
      ) {
        const rect = imageWrapper.getBoundingClientRect()
        const reference = {
          getBoundingClientRect () {
            return rect
          }
        }
        const imageInfo = getImageInfo(imageWrapper)
        eventCenter.dispatch('muya-image-selector', {
          reference,
          imageInfo,
          cb: () => {}
        })
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (target.closest('div.ag-container-preview') || target.closest('div.ag-html-preview')) {
        event.stopPropagation()
        if (target.closest('div.ag-container-preview')) {
          event.preventDefault()
          const figureElement = target.closest('figure')
          contentState.handleContainerBlockClick(figureElement)
        }
        return
      }

      const editIcon = target.closest('.ag-container-icon')
      if (editIcon) {
        event.preventDefault()
        event.stopPropagation()
        if ((editIcon.parentNode as HTMLElement | null)?.classList.contains('ag-container-block')) {
          contentState.handleContainerBlockClick(editIcon.parentNode as Element)
        }
      }

      if (target.tagName === 'INPUT' && target.classList.contains(CLASS_OR_ID.AG_TASK_LIST_ITEM_CHECKBOX)) {
        contentState.listItemCheckBoxClick(target)
      }
      contentState.clickHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }
}

function getToolItem (target: HTMLElement): HTMLElement | null {
  return target.closest('[data-label]')
}

function selectionText (node: HTMLElement): void {
  const textLen = node.textContent?.length ?? 0
  operateClassName(node, 'remove', CLASS_OR_ID.AG_HIDE)
  operateClassName(node, 'add', CLASS_OR_ID.AG_GRAY)
  selection.importSelection({
    start: textLen,
    end: textLen
  }, node)
}

export default ClickEvent
