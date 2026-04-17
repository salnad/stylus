import { EVENT_KEYS, CLASS_OR_ID } from '../config'
import { findNearestParagraph } from '../selection/dom'
import selection from '../selection'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  start?: CursorPosition | null
  end?: CursorPosition | null
}

interface SelectedImageLike {
  key: string
  token: {
    range: {
      start: number
      end: number
    }
  }
}

interface BlockLike {
  key: string
  text: string
  type: string
  functionType?: string
  preSibling?: string | null
  children: BlockLike[]
}

interface ParagraphLike extends HTMLElement {
  id: string
}

interface SelectionLike {
  getSelectionStart(): Element | null
  getCursorRange(): CursorRangeLike
  getCursorYOffset(paragraph: Element): {
    topOffset: number
    bottomOffset: number
  }
  getCaretOffsets(element: Node): {
    right: number
  }
  select(startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): Range
}

interface ContentStateWithKeyboard {
  muya: {
    keyboard: {
      hideAllFloatTools(): void
    }
  }
}

interface ContentStateWithTableBlock {
  getTableBlock(): BlockLike
}

interface ArrowCtrlMethods {
  findNextRowCell(cell: BlockLike): BlockLike | null
  findPrevRowCell(cell: BlockLike): BlockLike | null
  docArrowHandler(event: KeyboardEvent): void
  arrowHandler(event: KeyboardEvent): Range | void
}

interface ContentStateLike {
  selectedImage: unknown
  muya: unknown
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  blocks: BlockLike[]
  getBlock(key: string): BlockLike | null
  getParent(block: BlockLike | null | undefined): BlockLike | null
  closest(block: BlockLike | null | undefined, type: string | RegExp): BlockLike | null
  getNextSibling(block: BlockLike): BlockLike | null
  getPreSibling(block: BlockLike): BlockLike | null
  findPreBlockInLocation(block: BlockLike): BlockLike | null | undefined
  findNextBlockInLocation(block: BlockLike): BlockLike | null | undefined
  singleRender(block: BlockLike): void
  partialRender(): void
  createBlockP(): BlockLike
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
}

type ContentStateConstructor = {
  prototype: unknown
}

const selectionApi = selection as unknown as SelectionLike

// If the next block is header, put cursor after the `#{1,6} *`
const adjustOffset = (offset: number, block: BlockLike, event: KeyboardEvent): number => {
  if (/^span$/.test(block.type) && block.functionType === 'atxLine' && event.key === EVENT_KEYS.ArrowDown) {
    const match = /^\s{0,3}(?:#{1,6})(?:\s{1,}|$)/.exec(block.text)
    if (match) {
      return match[0].length
    }
  }
  return offset
}

const arrowCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as unknown as ContentStateLike & ArrowCtrlMethods

  prototype.findNextRowCell = function (cell: BlockLike): BlockLike | null {
    if (cell.functionType !== 'cellContent') {
      throw new Error(`block with type ${cell && cell.type} is not a table cell`)
    }
    const thOrTd = this.getParent(cell) as BlockLike
    const row = this.closest(cell, 'tr') as BlockLike
    const rowContainer = this.closest(row, /thead|tbody/) as BlockLike // thead or tbody
    const column = row.children.indexOf(thOrTd)
    if (rowContainer.type === 'thead') {
      const tbody = this.getNextSibling(rowContainer)
      if (tbody && tbody.children.length) {
        return tbody.children[0].children[column].children[0]
      }
    } else if (rowContainer.type === 'tbody') {
      const nextRow = this.getNextSibling(row)
      if (nextRow) {
        return nextRow.children[column].children[0]
      }
    }
    return null
  }

  prototype.findPrevRowCell = function (cell: BlockLike): BlockLike | null {
    if (cell.functionType !== 'cellContent') {
      throw new Error(`block with type ${cell && cell.type} is not a table cell`)
    }
    const thOrTd = this.getParent(cell) as BlockLike
    const row = this.closest(cell, 'tr') as BlockLike
    const rowContainer = this.getParent(row) as BlockLike // thead or tbody
    const rowIndex = rowContainer.children.indexOf(row)
    const column = row.children.indexOf(thOrTd)
    if (rowContainer.type === 'tbody') {
      if (rowIndex === 0 && rowContainer.preSibling) {
        const thead = this.getPreSibling(rowContainer) as BlockLike
        return thead.children[0].children[column].children[0]
      } else if (rowIndex > 0) {
        return (this.getPreSibling(row) as BlockLike).children[column].children[0]
      }
      return null
    }
    return null
  }

  prototype.docArrowHandler = function (event: KeyboardEvent): void {
    const selectedImage = this.selectedImage as SelectedImageLike | null
    if (selectedImage) {
      const { key, token } = selectedImage
      const { start, end } = token.range
      event.preventDefault()
      event.stopPropagation()
      const block = this.getBlock(key) as BlockLike
      switch (event.key) {
        case EVENT_KEYS.ArrowUp:
        case EVENT_KEYS.ArrowLeft: {
          this.cursor = {
            start: { key, offset: start },
            end: { key, offset: start }
          }
          break
        }
        case EVENT_KEYS.ArrowDown:
        case EVENT_KEYS.ArrowRight: {
          this.cursor = {
            start: { key, offset: end },
            end: { key, offset: end }
          }
          break
        }
      }
      const { keyboard } = (this as unknown as ContentStateLike & ContentStateWithKeyboard).muya
      keyboard.hideAllFloatTools()
      return this.singleRender(block)
    }
  }

  prototype.arrowHandler = function (event: KeyboardEvent): Range | void {
    const node = selectionApi.getSelectionStart()
    const paragraph = findNearestParagraph(node) as ParagraphLike
    const id = paragraph.id
    const block = this.getBlock(id) as BlockLike
    const preBlock = this.findPreBlockInLocation(block)
    const nextBlock = this.findNextBlockInLocation(block)
    const { start, end } = selectionApi.getCursorRange()
    const { topOffset, bottomOffset } = selectionApi.getCursorYOffset(paragraph)
    if (!start || !end) {
      return
    }

    // fix #101
    if (event.key === EVENT_KEYS.ArrowRight && node?.classList.contains(CLASS_OR_ID.AG_MATH_TEXT)) {
      const { right } = selectionApi.getCaretOffsets(node)
      if (right === 0 && start.key === end.key && start.offset === end.offset) {
        // It's not recommended to use such lower API, but it's work well.
        return selectionApi.select((node.parentNode as Element).nextElementSibling as Node, 0)
      }
    }

    // Just do nothing if the cursor is not collapsed or `shiftKey` pressed
    if (
      (start.key === end.key && start.offset !== end.offset) ||
      start.key !== end.key || event.shiftKey
    ) {
      return
    }

    if (
      (event.key === EVENT_KEYS.ArrowUp && topOffset > 0) ||
      (event.key === EVENT_KEYS.ArrowDown && bottomOffset > 0)
    ) {
      if (!/pre/.test(block.type) || block.functionType !== 'cellContent') {
        return
      }
    }

    if (block.functionType === 'cellContent') {
      let activeBlock: BlockLike | null | undefined
      const cellInNextRow = this.findNextRowCell(block)
      const cellInPrevRow = this.findPrevRowCell(block)

      if (event.key === EVENT_KEYS.ArrowUp) {
        if (cellInPrevRow) {
          activeBlock = cellInPrevRow
        } else {
          const tableBlock = (this as unknown as ContentStateLike & ContentStateWithTableBlock).getTableBlock()
          activeBlock = this.findPreBlockInLocation(tableBlock)
        }
      }

      if (event.key === EVENT_KEYS.ArrowDown) {
        if (cellInNextRow) {
          activeBlock = cellInNextRow
        } else {
          const tableBlock = (this as unknown as ContentStateLike & ContentStateWithTableBlock).getTableBlock()
          activeBlock = this.findNextBlockInLocation(tableBlock)
        }
      }

      if (activeBlock) {
        event.preventDefault()
        event.stopPropagation()
        let offset = activeBlock.type === 'p'
          ? 0
          : (event.key === EVENT_KEYS.ArrowUp
            ? activeBlock.text.length
            : 0)

        offset = adjustOffset(offset, activeBlock, event)

        const key = activeBlock.type === 'p'
          ? activeBlock.children[0].key
          : activeBlock.key

        this.cursor = {
          start: {
            key,
            offset
          },
          end: {
            key,
            offset
          }
        }

        return this.partialRender()
      }
    }

    if (
      (event.key === EVENT_KEYS.ArrowUp) ||
      (event.key === EVENT_KEYS.ArrowLeft && start.offset === 0)
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (!preBlock) return
      const key = preBlock.key
      const offset = preBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.partialRender()
    } else if (
      (event.key === EVENT_KEYS.ArrowDown) ||
      (event.key === EVENT_KEYS.ArrowRight && start.offset === block.text.length)
    ) {
      event.preventDefault()
      event.stopPropagation()
      let key: string
      let newBlock: BlockLike | undefined
      if (nextBlock) {
        key = nextBlock.key
      } else {
        newBlock = this.createBlockP()
        const lastBlock = this.blocks[this.blocks.length - 1]
        this.insertAfter(newBlock, lastBlock)
        key = newBlock.children[0].key
      }
      const offset = adjustOffset(0, nextBlock || (newBlock as BlockLike), event)
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.partialRender()
    }
  }
}

export default arrowCtrl
