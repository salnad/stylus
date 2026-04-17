import selection from '../selection'
import { isMuyaEditorElement } from '../selection/dom'
import { HAS_TEXT_BLOCK_REG, CLASS_OR_ID } from '../config'
import { getParentCheckBox } from '../utils/getParentCheckBox'
import { cumputeCheckboxStatus } from '../utils/cumputeCheckBoxStatus'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRange {
  start: CursorPosition
  end: CursorPosition
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

interface PositionReference {
  getBoundingClientRect(): PositionReferenceRect
  clientWidth: number
  clientHeight: number
  id: string
}

interface BlockLike {
  key: string
  type: string
  text: string
  functionType?: string
  checked?: boolean
  children: BlockLike[]
  [key: string]: unknown
}

interface SelectionFormatsResult {
  formats: unknown[]
}

interface EventCenterLike {
  dispatch(event: string, payload: unknown): unknown
}

interface MuyaLike {
  options: {
    autoCheck?: boolean
    [key: string]: unknown
  }
  eventCenter: EventCenterLike
}

interface ContentStateLike {
  muya: MuyaLike
  cursor: CursorRange
  selectedBlock: BlockLike | null
  getLastBlock(): BlockLike
  findOutMostBlock(block: BlockLike): BlockLike
  createBlockP(text?: string): BlockLike
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  render(): void
  partialRender(): void
  getBlock(key: string | null | undefined): BlockLike | null
  getPositionReference(): PositionReference
  selectionFormats(): SelectionFormatsResult
  codeBlockUpdate(block: BlockLike): boolean
  checkNeedRender(cursor?: CursorRange): boolean
  getParent(block: BlockLike | null | undefined): BlockLike | null
  firstInDescendant(block: BlockLike | null | undefined): BlockLike
}

interface ClickCtrlMethods {
  clickHandler(event: MouseEvent): void
  setCheckBoxState(checkbox: HTMLInputElement, checked: boolean): void
  updateParentsCheckBoxState(checkbox: HTMLInputElement): void
  updateChildrenCheckBoxState(checkbox: HTMLInputElement, checked: boolean): void
  listItemCheckBoxClick(checkbox: HTMLInputElement): unknown
}

interface SelectionLike {
  getCursorRange(): Partial<CursorRange>
  getSelectionStart(): Node | null
}

type ContentStateConstructor = {
  prototype: unknown
}

type InlineFormatType = 'link' | 'emoji' | 'inline_math' | 'strong' | 'em' | 'del' | 'inline_code'

type GetParentCheckBox = (checkbox: HTMLInputElement) => HTMLInputElement | null
type ComputeCheckboxStatus = (parentCheckbox: HTMLInputElement) => boolean

const selectionApi = selection as unknown as SelectionLike
const getParentCheckBoxFn = getParentCheckBox as GetParentCheckBox
const computeCheckboxStatusFn = cumputeCheckboxStatus as ComputeCheckboxStatus

const toElement = (target: EventTarget | Node | null): Element | null => {
  if (!target) {
    return null
  }

  return target instanceof Element ? target : null
}

const clickCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & ClickCtrlMethods

  prototype.clickHandler = function (event: MouseEvent): void {
    const { eventCenter } = this.muya
    const targetNode = event.target instanceof Node ? event.target : null
    const targetElement = toElement(targetNode)

    if (isMuyaEditorElement(targetNode)) {
      const lastBlock = this.getLastBlock()
      const anchor = this.findOutMostBlock(lastBlock)
      const anchorParagraph = document.querySelector<HTMLElement>(`#${anchor.key}`)
      if (anchorParagraph === null) {
        return
      }
      const rect = anchorParagraph.getBoundingClientRect()
      // If click below the last paragraph
      // and the last paragraph is not empty, create a new empty paragraph
      if (event.clientY > rect.top + rect.height) {
        let needToInsertNewParagraph = false
        if (lastBlock.type === 'span') {
          if (/atxLine|paragraphContent/.test(lastBlock.functionType || '') && /\S/.test(lastBlock.text)) {
            needToInsertNewParagraph = true
          }
          if (!/atxLine|paragraphContent/.test(lastBlock.functionType || '')) {
            needToInsertNewParagraph = true
          }
        } else {
          needToInsertNewParagraph = true
        }

        if (needToInsertNewParagraph) {
          event.preventDefault()
          const paragraphBlock = this.createBlockP()
          this.insertAfter(paragraphBlock, anchor)
          const key = paragraphBlock.children[0]?.key
          if (!key) {
            return
          }
          const offset = 0
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }

          this.render()
          return
        }
      }
    }

    // handle front menu click
    const { start: oldStart, end: oldEnd } = this.cursor
    if (oldStart && oldEnd) {
      let hasSameParent = false
      const startBlock = this.getBlock(oldStart.key)
      const endBlock = this.getBlock(oldEnd.key)
      if (startBlock && endBlock) {
        const startOutBlock = this.findOutMostBlock(startBlock)
        const endOutBlock = this.findOutMostBlock(endBlock)
        hasSameParent = startOutBlock === endOutBlock
      }
      // show the muya-front-menu only when the cursor in the same paragraph
      const frontIcon = targetElement?.closest('.ag-front-icon') as HTMLElement | null
      if (frontIcon && hasSameParent && startBlock && endBlock) {
        const currentBlock = this.findOutMostBlock(startBlock)
        const rect = frontIcon.getBoundingClientRect()
        const reference = {
          getBoundingClientRect (): PositionReferenceRect {
            return rect
          },
          clientWidth: rect.width,
          clientHeight: rect.height,
          id: currentBlock.key
        }
        this.selectedBlock = currentBlock
        eventCenter.dispatch('muya-front-menu', {
          reference,
          outmostBlock: currentBlock,
          startBlock,
          endBlock
        })
        this.partialRender()
        return
      }
    }

    const { start, end } = selectionApi.getCursorRange()
    // fix #625, the selection maybe not in edit area.
    if (!start || !end) {
      return
    }

    // format-click
    const selectionStartNode = selectionApi.getSelectionStart()
    const selectionStartElement = selectionStartNode instanceof Element
      ? selectionStartNode
      : selectionStartNode?.parentElement ?? null
    const inlineNode = selectionStartElement?.closest('.ag-inline-rule') as HTMLElement | null

    // link-format-click
    let parentNode: Element | null = inlineNode
    while (parentNode !== null && parentNode.classList.contains(CLASS_OR_ID.AG_INLINE_RULE)) {
      if (parentNode.tagName === 'A') {
        const formatType: InlineFormatType = 'link'
        const data = {
          text: inlineNode?.textContent,
          href: parentNode.getAttribute('href') || ''
        }
        eventCenter.dispatch('format-click', {
          event,
          formatType,
          data
        })
        break
      } else {
        parentNode = parentNode.parentElement
      }
    }

    if (inlineNode) {
      let formatType: InlineFormatType | null = null
      let data: string | null = null
      switch (inlineNode.tagName) {
        case 'SPAN': {
          if (inlineNode.hasAttribute('data-emoji')) {
            formatType = 'emoji'
            data = inlineNode.getAttribute('data-emoji')
          } else if (inlineNode.classList.contains('ag-math-text')) {
            formatType = 'inline_math'
            data = inlineNode.textContent
          }
          break
        }
        case 'STRONG': {
          formatType = 'strong'
          data = inlineNode.textContent
          break
        }
        case 'EM': {
          formatType = 'em'
          data = inlineNode.textContent
          break
        }
        case 'DEL': {
          formatType = 'del'
          data = inlineNode.textContent
          break
        }
        case 'CODE': {
          formatType = 'inline_code'
          data = inlineNode.textContent
          break
        }
      }
      if (formatType) {
        eventCenter.dispatch('format-click', {
          event,
          formatType,
          data
        })
      }
    }

    const block = this.getBlock(start.key)
    let needRender = false
    // is show format float box?
    if (
      block &&
      start.key === end.key &&
      start.offset !== end.offset &&
      HAS_TEXT_BLOCK_REG.test(block.type) &&
      block.functionType !== 'codeContent' &&
      block.functionType !== 'languageInput'
    ) {
      const reference = this.getPositionReference()
      const { formats } = this.selectionFormats()
      eventCenter.dispatch('muya-format-picker', { reference, formats })
    }

    // update '```xxx' to code block when you click other place or use press arrow key.
    if (block && start.key !== this.cursor.start.key) {
      const oldBlock = this.getBlock(this.cursor.start.key)
      if (oldBlock) {
        needRender = needRender || this.codeBlockUpdate(oldBlock)
      }
    }

    // change active status when paragraph changed
    if (
      start.key !== this.cursor.start.key ||
      end.key !== this.cursor.end.key
    ) {
      needRender = true
    }

    const needMarkedUpdate = this.checkNeedRender(this.cursor) || this.checkNeedRender({ start, end } as CursorRange)

    if (needRender) {
      this.cursor = { start, end }
      this.partialRender()
    } else if (needMarkedUpdate) {
      // Fix: whole select can not be canceled #613
      requestAnimationFrame(() => {
        const cursor = selectionApi.getCursorRange()
        if (!cursor.start || !cursor.end) {
          return
        }
        this.cursor = cursor as CursorRange
        this.partialRender()
      })
    } else {
      this.cursor = { start, end }
    }
  }

  prototype.setCheckBoxState = function (checkbox: HTMLInputElement, checked: boolean): void {
    checkbox.checked = checked
    const block = this.getBlock(checkbox.id)
    if (block) {
      block.checked = checked
    }
    checkbox.classList.toggle(CLASS_OR_ID.AG_CHECKBOX_CHECKED)
  }

  prototype.updateParentsCheckBoxState = function (checkbox: HTMLInputElement): void {
    let parent = getParentCheckBoxFn(checkbox)
    while (parent !== null) {
      const checked = computeCheckboxStatusFn(parent)
      if (parent.checked !== checked) {
        this.setCheckBoxState(parent, checked)
        parent = getParentCheckBoxFn(parent)
      } else {
        break
      }
    }
  }

  prototype.updateChildrenCheckBoxState = function (checkbox: HTMLInputElement, checked: boolean): void {
    const checkboxes = checkbox.parentElement?.querySelectorAll<HTMLInputElement>(
      `input ~ ul .${CLASS_OR_ID.AG_TASK_LIST_ITEM_CHECKBOX}`
    ) ?? []
    for (const childCheckbox of Array.from(checkboxes)) {
      if (childCheckbox.checked !== checked) {
        this.setCheckBoxState(childCheckbox, checked)
      }
    }
  }

  // handle task list item checkbox click
  prototype.listItemCheckBoxClick = function (checkbox: HTMLInputElement): unknown {
    const { checked } = checkbox
    this.setCheckBoxState(checkbox, checked)

    // A task checked, then related task should be update
    const { autoCheck } = this.muya.options
    if (autoCheck) {
      this.updateChildrenCheckBoxState(checkbox, checked)
      this.updateParentsCheckBoxState(checkbox)
    }

    const block = this.getBlock(checkbox.id)
    const parentBlock = this.getParent(block)
    const firstEditableBlock = this.firstInDescendant(parentBlock)
    const { key } = firstEditableBlock
    const offset = 0
    this.cursor = { start: { key, offset }, end: { key, offset } }
    return this.partialRender()
  }
}

export default clickCtrl
