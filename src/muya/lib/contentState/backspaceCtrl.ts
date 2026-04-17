import selection from '../selection'
import { findNearestParagraph, findOutMostParagraph } from '../selection/dom'
import { tokenizer, generator } from '../parser'
import { getImageInfo } from '../utils/getImageInfo'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  start?: CursorPosition | null
  end?: CursorPosition | null
}

interface RangeLike {
  start: number
  end: number
}

interface TokenLike {
  type: string
  raw: string
  range: RangeLike
  tag?: string
  [key: string]: unknown
}

interface ImageInfoLike {
  key: string
  token: {
    range: RangeLike
    [key: string]: unknown
  }
  imageId?: string
}

interface BlockLike {
  key: string
  text: string
  type: string
  parent: string | null
  preSibling: string | null
  nextSibling: string | null
  children: BlockLike[]
  functionType?: string
  listItemType?: string
  editable?: boolean
  [key: string]: unknown
}

interface ParagraphLike extends HTMLElement {
  id: string
}

interface SelectionLike {
  getSelectionStart(): Element
  getCursorRange(): CursorRangeLike
  getCaretOffsets(element: Node): {
    left: number
    right: number
  }
}

interface MuyaLike {
  options: Record<string, unknown>
  dispatchSelectionChange(): void
  dispatchSelectionFormats(): void
  dispatchChange(): void
}

type BackspaceCase =
  | { type: 'LI', info: 'REPLACEMENT' | 'REMOVE_INSERT_BEFORE' | 'INSERT_PRE_LIST_ITEM' }
  | { type: 'BLOCKQUOTE', info: 'REPLACEMENT' | 'INSERT_BEFORE' }
  | { type: 'STOP' }

interface ContentStateLike {
  selectedImage: unknown
  selectedTableCells: unknown
  blocks: BlockLike[]
  cursor: {
    start: CursorPosition
    end: CursorPosition
    noHistory?: boolean
  }
  muya: MuyaLike
  getBlock(key: string | BlockLike | null | undefined): BlockLike
  getParent(block: BlockLike | null | undefined): BlockLike | null
  getPreSibling(block: BlockLike): BlockLike
  findOutMostBlock(block: BlockLike): BlockLike
  findPreBlockInLocation(block: BlockLike): BlockLike | null
  isFirstChild(block: BlockLike): boolean
  isOnlyChild(block: BlockLike): boolean
  deleteImage(image: unknown): void
  deleteSelectedTableCells(): void
  isSelectAll(): boolean
  createBlockP(text?: string): BlockLike
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  init(): void
  render(): void
  partialRender(): void
  singleRender(block: BlockLike): void
  updateToParagraph(block: BlockLike | null, line: BlockLike): void
  closest(block: BlockLike | null | undefined, type: string | RegExp): BlockLike
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  appendChild(parent: BlockLike, block: BlockLike): void
  removeBlocks(before: BlockLike, after: BlockLike, isRemoveAfter?: boolean, isRecursion?: boolean): void
  removeBlock(block: BlockLike): void
  selectImage(imageInfo: Pick<ImageInfoLike, 'key' | 'token'>): void
  isCollapse(cursor?: unknown): boolean
  checkInlineUpdate(block: BlockLike): void
}

interface BackspaceCtrlMethods {
  checkBackspaceCase(): BackspaceCase | false | undefined
  docBackspaceHandler(event: KeyboardEvent): void
  backspaceHandler(event: KeyboardEvent): void
}

type ContentStateConstructor = {
  prototype: unknown
}

const selectionApi = selection as unknown as SelectionLike

const backspaceCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & BackspaceCtrlMethods

  prototype.checkBackspaceCase = function () {
    const node = selectionApi.getSelectionStart()
    const paragraph = findNearestParagraph(node) as ParagraphLike
    const outMostParagraph = findOutMostParagraph(node) as ParagraphLike
    let block = this.getBlock(paragraph.id)
    if (block.type === 'span' && block.preSibling) {
      return false
    }
    if (block.type === 'span') {
      block = this.getParent(block) as BlockLike
    }
    const preBlock = this.getPreSibling(block)
    const outBlock = this.findOutMostBlock(block)
    const parent = this.getParent(block)

    const { left: outLeft } = selectionApi.getCaretOffsets(outMostParagraph)
    const { left: inLeft } = selectionApi.getCaretOffsets(paragraph)

    if (
      (parent && parent.type === 'li' && inLeft === 0 && this.isFirstChild(block)) ||
      (parent && parent.type === 'li' && inLeft === 0 && parent.listItemType === 'task' && preBlock.type === 'input') // handle task item
    ) {
      if (this.isOnlyChild(parent)) {
        /**
         * <ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         * <ul>
         * ===>
         * <p>|text</p>
         * <p>maybe has other paragraph</p>
         */
        return { type: 'LI', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(parent)) {
        /**
         * <ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         * ===>
         * <p>|text</p>
         * <p>maybe has other paragraph</p>
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         */
        return { type: 'LI', info: 'REMOVE_INSERT_BEFORE' }
      } else {
        /**
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         * ===>
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         */
        return { type: 'LI', info: 'INSERT_PRE_LIST_ITEM' }
      }
    }
    if (parent && parent.type === 'blockquote' && inLeft === 0) {
      if (this.isOnlyChild(block)) {
        return { type: 'BLOCKQUOTE', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(block)) {
        return { type: 'BLOCKQUOTE', info: 'INSERT_BEFORE' }
      }
    }
    if (!outBlock.preSibling && outLeft === 0) {
      return { type: 'STOP' }
    }
  }

  prototype.docBackspaceHandler = function (event: KeyboardEvent): void {
    // handle delete selected image
    if (this.selectedImage) {
      event.preventDefault()
      return this.deleteImage(this.selectedImage)
    }
    if (this.selectedTableCells) {
      event.preventDefault()
      return this.deleteSelectedTableCells()
    }
  }

  prototype.backspaceHandler = function (event: KeyboardEvent): void {
    const { start, end } = selectionApi.getCursorRange()

    if (!start || !end) {
      return
    }

    // handle delete selected image
    if (this.selectedImage) {
      event.preventDefault()
      return this.deleteImage(this.selectedImage)
    }

    // Handle select all content.
    if (this.isSelectAll()) {
      event.preventDefault()
      this.blocks = [this.createBlockP()]
      this.init()

      this.render()

      this.muya.dispatchSelectionChange()
      this.muya.dispatchSelectionFormats()
      return this.muya.dispatchChange()
    }

    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const maybeLastRow = this.getParent(endBlock) as BlockLike
    const startOutmostBlock = this.findOutMostBlock(startBlock)
    const endOutmostBlock = this.findOutMostBlock(endBlock)
    // Just for fix delete the last `#` or all the atx heading cause error @fixme
    if (
      start.key === end.key &&
      startBlock.type === 'span' &&
      startBlock.functionType === 'atxLine'
    ) {
      if (
        (start.offset === 0 && end.offset === startBlock.text.length) ||
        (start.offset === end.offset && start.offset === 1 && startBlock.text === '#')
      ) {
        event.preventDefault()
        startBlock.text = ''
        this.cursor = {
          start: { key: start.key, offset: 0 },
          end: { key: end.key, offset: 0 }
        }
        this.updateToParagraph(this.getParent(startBlock), startBlock)
        return this.partialRender()
      }
    }
    // fix: #897
    const { text } = startBlock
    const tokens = tokenizer(text, {
      options: this.muya.options
    }) as unknown as TokenLike[]
    let needRender = false
    let preToken: TokenLike | null = null
    for (const token of tokens) {
      // handle delete the second $ in inline_math.
      if (
        token.range.end === start.offset &&
        token.type === 'inline_math'
      ) {
        needRender = true
        token.raw = token.raw.substr(0, token.raw.length - 1)
        break
      }
      // handle pre token is a <ruby> html tag, need preventdefault.
      if (
        token.range.start + 1 === start.offset &&
        preToken &&
        preToken.type === 'html_tag' &&
        preToken.tag === 'ruby'
      ) {
        needRender = true
        token.raw = token.raw.substr(1)
        break
      }
      preToken = token
    }
    if (needRender) {
      startBlock.text = generator(tokens)
      event.preventDefault()
      start.offset--
      end.offset--
      this.cursor = {
        start,
        end
      }
      return this.partialRender()
    }

    // fix bug when the first block is table, these two ways will cause bugs.
    // 1. one paragraph bollow table, selectAll, press backspace.
    // 2. select table from the first cell to the last cell, press backsapce.
    const maybeCell = this.getParent(startBlock) as BlockLike
    if (/th/.test(maybeCell.type) && start.offset === 0 && !maybeCell.preSibling) {
      if (
        (
          end.offset === endBlock.text.length &&
          startOutmostBlock === endOutmostBlock &&
          !endBlock.nextSibling &&
          !maybeLastRow.nextSibling
        ) ||
        startOutmostBlock !== endOutmostBlock
      ) {
        event.preventDefault()
        // need remove the figure block.
        const figureBlock = this.getBlock(this.closest(startBlock, 'figure'))
        // if table is the only block, need create a p block.
        const p = this.createBlockP(endBlock.text.substring(end.offset))
        this.insertBefore(p, figureBlock)
        const cursorBlock = p.children[0]
        if (startOutmostBlock !== endOutmostBlock) {
          this.removeBlocks(figureBlock, endBlock)
        }

        this.removeBlock(figureBlock)
        const { key } = cursorBlock
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        return this.render()
      }
    }
    // Fixed #1456 existed bugs `Select one cell and press backspace will cause bug`
    if (
      startBlock.functionType === 'cellContent' &&
      this.cursor.start.offset === 0 &&
      this.cursor.end.offset !== 0 &&
      this.cursor.end.offset === startBlock.text.length
    ) {
      event.preventDefault()
      event.stopPropagation()
      startBlock.text = ''
      const { key } = startBlock
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.singleRender(startBlock)
    }

    // Fix: https://github.com/marktext/marktext/issues/2013
    // Also fix the codeblock crashed when the code content is '\n' and press backspace.
    if (
      startBlock.functionType === 'codeContent' &&
      startBlock.key === endBlock.key &&
      this.cursor.start.offset === this.cursor.end.offset &&
      (/\n.$/.test(startBlock.text) || startBlock.text === '\n') &&
      startBlock.text.length === this.cursor.start.offset
    ) {
      event.preventDefault()
      event.stopPropagation()

      startBlock.text = /\n.$/.test(startBlock.text) ? startBlock.text.replace(/.$/, '') : ''
      const { key } = startBlock
      const offset = startBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.singleRender(startBlock)
    }

    // If select multiple paragraph or multiple characters in one paragraph, just let
    // inputCtrl to handle this case.
    if (start.key !== end.key || start.offset !== end.offset) {
      return
    }

    const node = selectionApi.getSelectionStart()
    const parentNode = node ? node.parentNode as HTMLElement | null : null
    const paragraph = findNearestParagraph(node) as ParagraphLike
    const id = paragraph.id
    let block = this.getBlock(id)
    let parent = this.getBlock(block.parent)
    const preBlock = this.findPreBlockInLocation(block)
    const { left, right } = selectionApi.getCaretOffsets(paragraph)
    const inlineDegrade = this.checkBackspaceCase()
    // Handle backspace when the previous is an inline image.
    if (parentNode && parentNode.classList.contains('ag-inline-image')) {
      if (selectionApi.getCaretOffsets(node).left === 0) {
        event.preventDefault()
        event.stopPropagation()
        const imageInfo = getImageInfo(parentNode) as ImageInfoLike
        return this.deleteImage(imageInfo)
      }
      if (selectionApi.getCaretOffsets(node).left === 1 && right === 0) {
        event.stopPropagation()
        event.preventDefault()
        const key = startBlock.key
        const text = startBlock.text

        startBlock.text = text.substring(0, start.offset - 1) + text.substring(start.offset)
        const offset = start.offset - 1
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        return this.singleRender(startBlock)
      }
    }

    // handle backspace when cursor at the end of inline image.
    if (node.classList.contains('ag-image-container')) {
      const imageWrapper = node.parentNode as HTMLElement
      const imageInfo = getImageInfo(imageWrapper) as ImageInfoLike
      if (start.offset === imageInfo.token.range.end) {
        event.preventDefault()
        event.stopPropagation()
        return this.selectImage(imageInfo)
      }
    }

    // Fix issue #1218
    if (startBlock.functionType === 'cellContent' && /<br\/>.{1}$/.test(startBlock.text)) {
      event.preventDefault()
      event.stopPropagation()

      const { text } = startBlock
      startBlock.text = text.substring(0, text.length - 1)
      const key = startBlock.key
      const offset = startBlock.text.length

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.singleRender(startBlock)
    }

    // Fix delete the last character in table cell, the default action will delete the cell content if not preventDefault.
    if (startBlock.functionType === 'cellContent' && left === 1 && right === 0) {
      event.stopPropagation()
      event.preventDefault()
      startBlock.text = ''
      const { key } = startBlock
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.singleRender(startBlock)
    }

    const tableHasContent = (table: BlockLike): boolean => {
      const tHead = table.children[0]
      const tBody = table.children[1]
      const tHeadHasContent = tHead.children[0].children.some(th => th.children[0].text.trim())
      const tBodyHasContent = tBody.children.some(row => row.children.some(td => td.children[0].text.trim()))
      return tHeadHasContent || tBodyHasContent
    }

    if (
      block.type === 'span' &&
      block.functionType === 'paragraphContent' &&
      left === 0 &&
      preBlock &&
      preBlock.functionType === 'footnoteInput'
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (!parent.nextSibling) {
        const pBlock = this.createBlockP(block.text)
        const figureBlock = this.closest(block, 'figure')
        this.insertBefore(pBlock, figureBlock)
        this.removeBlock(figureBlock)
        const key = pBlock.children[0].key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }

        this.partialRender()
      }
    } else if (
      block.type === 'span' &&
      block.functionType === 'codeContent' &&
      left === 0 &&
      !block.preSibling
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (
        !block.nextSibling
      ) {
        const preBlock = this.getParent(parent) as BlockLike
        const pBlock = this.createBlock('p')
        const lineBlock = this.createBlock('span', { text: block.text })
        const key = lineBlock.key
        const offset = 0
        this.appendChild(pBlock, lineBlock)
        let referenceBlock: BlockLike | null = null
        switch (preBlock.functionType) {
          case 'fencecode':
          case 'indentcode':
          case 'frontmatter':
            referenceBlock = preBlock
            break
          case 'multiplemath':
          case 'flowchart':
          case 'mermaid':
          case 'sequence':
          case 'plantuml':
          case 'vega-lite':
          case 'html':
            referenceBlock = this.getParent(preBlock)
            break
        }
        this.insertBefore(pBlock, referenceBlock as BlockLike)
        this.removeBlock(referenceBlock as BlockLike)

        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.partialRender()
      }
    } else if (left === 0 && block.functionType === 'cellContent') {
      event.preventDefault()
      event.stopPropagation()
      const table = this.closest(block, 'table')
      const figure = this.closest(table, 'figure')
      const hasContent = tableHasContent(table)
      let key: string | undefined
      let offset: number | undefined

      if ((!preBlock || preBlock.functionType !== 'cellContent') && !hasContent) {
        const paragraphContent = this.createBlock('span')
        delete figure.functionType
        figure.children = []
        this.appendChild(figure, paragraphContent)
        figure.text = ''
        figure.type = 'p'
        key = paragraphContent.key
        offset = 0
      } else if (preBlock) {
        key = preBlock.key
        offset = preBlock.text.length
      }

      if (key !== undefined && offset !== undefined) {
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }

        this.partialRender()
      }
    } else if (inlineDegrade) {
      event.preventDefault()
      if (block.type === 'span') {
        block = this.getParent(block) as BlockLike
        parent = this.getParent(parent) as BlockLike
      }

      switch (inlineDegrade.type) {
        case 'STOP': // Cursor at begin of article and nothing need to do
          break
        case 'LI': {
          if (inlineDegrade.info === 'REPLACEMENT') {
            const children = parent.children
            const grandpa = this.getBlock(parent.parent)
            if (children[0].type === 'input') {
              this.removeBlock(children[0])
            }
            children.forEach(child => {
              this.insertBefore(child, grandpa)
            })
            this.removeBlock(grandpa)
          } else if (inlineDegrade.info === 'REMOVE_INSERT_BEFORE') {
            const children = parent.children
            const grandpa = this.getBlock(parent.parent)
            if (children[0].type === 'input') {
              this.removeBlock(children[0])
            }
            children.forEach(child => {
              this.insertBefore(child, grandpa)
            })
            this.removeBlock(parent)
          } else if (inlineDegrade.info === 'INSERT_PRE_LIST_ITEM') {
            const parPre = this.getBlock(parent.preSibling)
            const children = parent.children
            if (children[0].type === 'input') {
              this.removeBlock(children[0])
            }
            children.forEach(child => {
              this.appendChild(parPre, child)
            })
            this.removeBlock(parent)
          }
          break
        }
        case 'BLOCKQUOTE':
          if (inlineDegrade.info === 'REPLACEMENT') {
            this.insertBefore(block, parent)
            this.removeBlock(parent)
          } else if (inlineDegrade.info === 'INSERT_BEFORE') {
            this.removeBlock(block)
            this.insertBefore(block, parent)
          }
          break
      }

      const key = block.type === 'p' ? block.children[0].key : block.key
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      if (inlineDegrade.type !== 'STOP') {
        this.partialRender()
      }
    } else if (left === 0 && preBlock) {
      event.preventDefault()
      const { text } = block
      const key = preBlock.key
      const offset = preBlock.text.length
      preBlock.text += text
      // If block is a line block and its parent paragraph only has one text line,
      // also need to remove the paragrah
      if (this.isOnlyChild(block) && block.type === 'span') {
        this.removeBlock(parent)
      } else if (block.functionType !== 'languageInput' && block.functionType !== 'footnoteInput') {
        this.removeBlock(block)
      }

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      let needRenderAll = false

      if (this.isCollapse() && preBlock.type === 'span' && preBlock.functionType === 'paragraphContent') {
        this.checkInlineUpdate(preBlock)
        needRenderAll = true
      }

      if (needRenderAll) {
        this.render()
      } else {
        this.partialRender()
      }
    }
  }
}

export default backspaceCtrl
