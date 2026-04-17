import selection from '../selection'
import { PARAGRAPH_TYPES, DEFAULT_TURNDOWN_CONFIG } from '../config'
import ExportMarkdown from '../utils/exportMarkdown'

interface BlockLike {
  key: string
  text: string
  type: string
  parent: string | null
  preSibling: string | null
  nextSibling: string | null
  children: BlockLike[]
  functionType?: string
  listType?: string
  listItemType?: string
  isLooseListItem?: boolean
  bulletMarkerOrDelimiter?: string
  checked?: boolean
  headingStyle?: string
  lang?: string
  style?: string
  start?: number
  [key: string]: unknown
}

interface CursorPosition {
  key: string
  offset: number
  type?: string
  block?: BlockLike
  [key: string]: unknown
}

interface CursorRangeLike {
  start?: CursorPosition | null
  end?: CursorPosition | null
  noHistory?: boolean
  [key: string]: unknown
}

interface CursorCoords {
  x: number
  y: number
  width: number
}

interface SelectionChangeResult {
  start: CursorPosition
  end: CursorPosition
  affiliation: BlockLike[]
  cursorCoords: CursorCoords
}

interface CommonParentResult {
  parent: BlockLike | null
  startIndex?: number
  endIndex?: number
}

interface TableSelectionCellLike {
  key: string
  text: string
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

interface SelectedTableCellsLike {
  tableId: string
  row: number
  column: number
  cells: TableSelectionCellLike[]
}

interface EventCenterLike {
  dispatch(...args: unknown[]): unknown
}

interface MuyaLike {
  options: {
    frontmatterType?: string
    orderListDelimiter?: string
    bulletListMarker?: string
    preferLooseListItem?: boolean
    [key: string]: unknown
  }
  keyboard: {
    isComposed?: boolean
  }
  eventCenter: EventCenterLike
  dispatchSelectionChange(): void
  dispatchSelectionFormats(): void
  dispatchChange(): void
}

interface ContentStateLike {
  cursor: {
    start: CursorPosition
    end: CursorPosition
    noHistory?: boolean
  }
  blocks: BlockLike[]
  muya: MuyaLike
  isGitlabCompatibilityEnabled: boolean
  listIndentation: number | string
  selectedTableCells: SelectedTableCellsLike | null
  getBlock(key: string | null | undefined): BlockLike | null
  getParents(block: BlockLike): BlockLike[]
  getParent(block: BlockLike | null | undefined): BlockLike | null
  getAnchor(block: BlockLike): BlockLike | null
  getPositionReference(): unknown
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  createBlockP(text?: string): BlockLike
  createContainerBlock(functionType: string, value: string): BlockLike
  createTable(options: { rows: number, columns: number }): void
  initHtmlBlock(block: BlockLike): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  removeBlock(block: BlockLike, fromBlocks?: BlockLike[] | BlockLike): void
  updateList(paragraph: BlockLike, listType: string, bullet?: unknown, line?: BlockLike): BlockLike
  updateTaskListItem(paragraph: BlockLike, listType: string): void
  partialRender(isRenderCursor?: boolean): void
  render(isRenderCursor?: boolean, clearCache?: boolean): void
  singleRender(block: BlockLike, isRenderCursor?: boolean): void
  markdownToState(markdown: string): BlockLike[]
  firstInDescendant(block: BlockLike): BlockLike
  lastInDescendant(block: BlockLike): BlockLike
  findOutMostBlock(block: BlockLike): BlockLike
  copyBlock(block: BlockLike): BlockLike
  getFirstBlock(): BlockLike
  getLastBlock(): BlockLike
  isSingleCellSelected(): BlockLike | null
  isWholeTableSelected(): boolean
  selectTable(table: BlockLike): unknown
  closest(block: BlockLike | null | undefined, type: string | RegExp): BlockLike | null
  isOnlyChild(block: BlockLike): boolean
}

interface ParagraphCtrlMethods {
  selectionChange(cursor?: CursorRangeLike): SelectionChangeResult
  getCommonParent(): CommonParentResult
  handleFrontMatter(): void
  handleListMenu(paraType: string, insertMode?: boolean): boolean | void
  handleLooseListItem(): void
  handleCodeBlockMenu(): void
  handleQuoteMenu(insertMode?: boolean): void
  insertContainerBlock(functionType: string, block: BlockLike): void
  showTablePicker(): void
  insertHtmlBlock(block: BlockLike): void
  updateParagraph(paraType: string, insertMode?: boolean): void
  insertParagraph(location: string, text?: string, outMost?: boolean): void
  duplicate(): unknown
  deleteParagraph(blockKey?: string): unknown
  isSelectAll(): boolean
  selectAllContent(): void
  selectAll(): unknown
  isAllowedTransformation(block: BlockLike, toType: string, isMultilineSelection: boolean): boolean
  getTypeFromBlock(block: BlockLike): string
}

type ContentStateConstructor = {
  prototype: unknown
}

type ExportMarkdownInstance = {
  generate(): string
}

type ExportMarkdownConstructor = new (
  blocks: BlockLike[],
  listIndentation?: number | string,
  isGitlabCompatibilityEnabled?: boolean
) => ExportMarkdownInstance

interface SelectionLike {
  getCursorRange(): CursorRangeLike
  getCursorCoords(): CursorCoords
}

const selectionApi = selection as unknown as SelectionLike
const ExportMarkdownCtor = ExportMarkdown as unknown as ExportMarkdownConstructor

// get header level
//  eg: h1 => 1
//      h2 => 2
const getCurrentLevel = (type: string): number => {
  if (/\d/.test(type)) {
    return Number(/\d/.exec(type)?.[0])
  } else {
    return 0
  }
}

const paragraphCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & ParagraphCtrlMethods

  prototype.selectionChange = function (cursor?: CursorRangeLike): SelectionChangeResult {
    const { start, end } = cursor || selectionApi.getCursorRange()
    if (!start || !end) {
      // TODO: Throw an exception and try to fix this later (GH#848).
      throw new Error('selectionChange: expected cursor but cursor is null.')
    }
    const cursorCoords = selectionApi.getCursorCoords()
    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const affiliation = startParents
      .filter(p => endParents.includes(p))
      .filter(p => (PARAGRAPH_TYPES as readonly string[]).includes(p.type))

    start.type = startBlock.type
    start.block = startBlock
    end.type = endBlock.type
    end.block = endBlock

    return {
      start,
      end,
      affiliation,
      cursorCoords
    }
  }

  prototype.getCommonParent = function (): CommonParentResult {
    const { start, end, affiliation } = this.selectionChange()
    const parent = affiliation.length ? affiliation[0] : null
    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike
    const startParentKeys = this.getParents(startBlock).map(b => b.key)
    const endParentKeys = this.getParents(endBlock).map(b => b.key)
    const children = parent ? parent.children : this.blocks
    let startIndex: number | undefined
    let endIndex: number | undefined
    for (const child of children) {
      if (startParentKeys.includes(child.key)) {
        startIndex = children.indexOf(child)
      }
      if (endParentKeys.includes(child.key)) {
        endIndex = children.indexOf(child)
      }
    }
    return { parent, startIndex, endIndex }
  }

  prototype.handleFrontMatter = function (): void {
    const firstBlock = this.blocks[0] as BlockLike
    if (firstBlock.type === 'pre' && firstBlock.functionType === 'frontmatter') return

    const { frontmatterType } = this.muya.options
    let lang = ''
    let style = ''
    switch (frontmatterType) {
      case '+':
        lang = 'toml'
        style = '+'
        break
      case ';':
        lang = 'json'
        style = ';'
        break
      case '{':
        lang = 'json'
        style = '{'
        break
      default:
        lang = 'yaml'
        style = '-'
        break
    }

    const frontMatter = this.createBlock('pre', {
      functionType: 'frontmatter',
      lang,
      style
    })
    const codeBlock = this.createBlock('code', {
      lang
    })
    const emptyCodeContent = this.createBlock('span', {
      functionType: 'codeContent',
      lang
    })

    this.appendChild(codeBlock, emptyCodeContent)
    this.appendChild(frontMatter, codeBlock)
    this.insertBefore(frontMatter, firstBlock)
    const { key } = emptyCodeContent
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  // TODO: New created nestled list items missing "listType" key and value.

  prototype.handleListMenu = function (paraType: string, insertMode = false): boolean | void {
    const { start, end, affiliation } = this.selectionChange(this.cursor)
    const { orderListDelimiter, bulletListMarker, preferLooseListItem } = this.muya.options
    const [blockType, listType] = paraType.split('-') as [string, string]
    const isListed = affiliation.slice(0, 3).filter(b => /ul|ol/.test(b.type))

    if (isListed.length && !insertMode) {
      const listBlock = isListed[0]
      if (listType === listBlock.listType) {
        const listItems = listBlock.children
        listItems.forEach(listItem => {
          listItem.children.forEach(itemParagraph => {
            if (itemParagraph.type !== 'input') {
              this.insertBefore(itemParagraph, listBlock)
            }
          })
        })
        this.removeBlock(listBlock)
        return
      }
      // if the old list block is task list, remove checkbox
      if (listBlock.listType === 'task') {
        const listItems = listBlock.children
        listItems.forEach(item => {
          const inputBlock = item.children[0]
          if (inputBlock) {
            this.removeBlock(inputBlock)
          }
        })
      }
      const oldListType = listBlock.listType
      listBlock.type = blockType
      listBlock.listType = listType
      listBlock.children.forEach(b => {
        b.listItemType = listType
      })

      if (listType === 'order') {
        listBlock.start = listBlock.start || 1
        listBlock.children.forEach(b => {
          b.bulletMarkerOrDelimiter = orderListDelimiter
        })
      }
      if (
        (listType === 'bullet' && oldListType === 'order') ||
        (listType === 'task' && oldListType === 'order')
      ) {
        delete listBlock.start
        listBlock.children.forEach(b => {
          b.bulletMarkerOrDelimiter = bulletListMarker
        })
      }

      // if the new block is task list, add checkbox
      if (listType === 'task') {
        const listItems = listBlock.children
        listItems.forEach(item => {
          const checkbox = this.createBlock('input')
          checkbox.checked = false
          this.insertBefore(checkbox, item.children[0] as BlockLike)
        })
      }
    } else {
      if (start.key === end.key || (start.block?.parent && start.block.parent === end.block?.parent)) {
        const block = this.getBlock(start.key) as BlockLike
        const paragraph = this.getBlock(block.parent) as BlockLike
        if (listType === 'task') {
          // 1. first update the block to bullet list
          const listItemParagraph = this.updateList(paragraph, 'bullet', undefined, block)
          // 2. second update bullet list to task list
          setTimeout(() => {
            this.updateTaskListItem(listItemParagraph, listType)
            this.partialRender()
            this.muya.dispatchSelectionChange()
            this.muya.dispatchSelectionFormats()
            this.muya.dispatchChange()
          })
          return false
        } else {
          this.updateList(paragraph, listType, undefined, block)
        }
      } else {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex as number] as BlockLike
        const listWrapper = this.createBlock(listType === 'order' ? 'ol' : 'ul')
        listWrapper.listType = listType
        if (listType === 'order') listWrapper.start = 1

        children.slice(startIndex as number, (endIndex as number) + 1).forEach(child => {
          if (child !== referBlock) {
            this.removeBlock(child, children)
          } else {
            this.insertAfter(listWrapper, child)
            this.removeBlock(child, children)
          }
          const listItem = this.createBlock('li')
          listItem.listItemType = listType
          listItem.isLooseListItem = preferLooseListItem
          this.appendChild(listWrapper, listItem)
          if (listType === 'task') {
            const checkbox = this.createBlock('input')
            checkbox.checked = false
            this.appendChild(listItem, checkbox)
          }
          this.appendChild(listItem, child)
        })
      }
    }

    return true
  }

  prototype.handleLooseListItem = function (): void {
    const { affiliation } = this.selectionChange(this.cursor)
    let listContainer: BlockLike[] = []
    if (affiliation.length >= 1 && /ul|ol/.test(affiliation[0].type)) {
      listContainer = affiliation[0].children
    } else if (affiliation.length >= 3 && affiliation[1].type === 'li') {
      listContainer = affiliation[2].children
    }
    if (listContainer.length > 0) {
      for (const block of listContainer) {
        block.isLooseListItem = !block.isLooseListItem
      }
      this.partialRender()
    }
  }

  prototype.handleCodeBlockMenu = function (): void {
    const { start, end, affiliation } = this.selectionChange(this.cursor)
    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const hasFencedCodeBlockParent = (): boolean => {
      return [...startParents, ...endParents].some(b => b.type === 'pre' && typeof b.functionType === 'string' && /code/.test(b.functionType))
    }
    // change fenced code block to p paragraph
    if (
      affiliation.length &&
      affiliation[0].type === 'pre' &&
      typeof affiliation[0].functionType === 'string' &&
      /code/.test(affiliation[0].functionType)
    ) {
      const codeBlock = affiliation[0]
      const codeContent = codeBlock.children[1].children[0].text
      const states = this.markdownToState(codeContent)

      for (const state of states) {
        this.insertBefore(state, codeBlock)
      }

      this.removeBlock(codeBlock)

      const cursorBlock = this.firstInDescendant(states[0] as BlockLike)
      const { key, text } = cursorBlock
      const offset = text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    } else {
      if (start.key === end.key) {
        if (startBlock.type === 'span') {
          const anchorBlock = this.getParent(startBlock) as BlockLike
          const lang = ''
          const preBlock = this.createBlock('pre', {
            functionType: 'fencecode',
            lang
          })

          const codeBlock = this.createBlock('code', {
            lang
          })

          const inputBlock = this.createBlock('span', {
            functionType: 'languageInput'
          })

          const codeContent = this.createBlock('span', {
            text: startBlock.text,
            lang,
            functionType: 'codeContent'
          })

          this.appendChild(codeBlock, codeContent)
          this.appendChild(preBlock, inputBlock)
          this.appendChild(preBlock, codeBlock)
          this.insertBefore(preBlock, anchorBlock)

          this.removeBlock(anchorBlock)

          const { key } = inputBlock
          const offset = 0

          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }
        } else {
          this.cursor = {
            start: this.cursor.start,
            end: this.cursor.end
          }
        }
      } else if (!hasFencedCodeBlockParent()) {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex as number] as BlockLike
        const lang = ''
        const preBlock = this.createBlock('pre', {
          functionType: 'fencecode',
          lang
        })
        const codeBlock = this.createBlock('code', {
          lang
        })

        const { isGitlabCompatibilityEnabled, listIndentation } = this
        const markdown = new ExportMarkdownCtor(
          children.slice(startIndex as number, (endIndex as number) + 1),
          listIndentation,
          isGitlabCompatibilityEnabled
        ).generate()
        const codeContent = this.createBlock('span', {
          text: markdown,
          lang,
          functionType: 'codeContent'
        })
        const inputBlock = this.createBlock('span', {
          functionType: 'languageInput'
        })
        this.appendChild(codeBlock, codeContent)
        this.appendChild(preBlock, inputBlock)
        this.appendChild(preBlock, codeBlock)
        this.insertAfter(preBlock, referBlock)
        const removeCache: BlockLike[] = []
        for (let i = startIndex as number; i <= (endIndex as number); i++) {
          const child = children[i] as BlockLike
          removeCache.push(child)
        }
        removeCache.forEach(b => {
          this.removeBlock(b)
        })
        const key = inputBlock.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
      }
    }
  }

  prototype.handleQuoteMenu = function (insertMode = false): void {
    const { start, end, affiliation } = this.selectionChange(this.cursor)
    let startBlock = this.getBlock(start.key) as BlockLike
    const isBlockQuote = affiliation.slice(0, 2).filter(b => /blockquote/.test(b.type))
    // change blockquote to paragraph
    if (isBlockQuote.length && !insertMode) {
      const quoteBlock = isBlockQuote[0]
      const children = quoteBlock.children
      for (const child of children) {
        this.insertBefore(child, quoteBlock)
      }
      this.removeBlock(quoteBlock)
      // change paragraph to blockquote
    } else {
      if (start.key === end.key) {
        if (startBlock.type === 'span') {
          startBlock = this.getParent(startBlock) as BlockLike
        }
        const quoteBlock = this.createBlock('blockquote')
        this.insertAfter(quoteBlock, startBlock)
        this.removeBlock(startBlock)
        this.appendChild(quoteBlock, startBlock)
      } else {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex as number] as BlockLike
        const quoteBlock = this.createBlock('blockquote')

        children.slice(startIndex as number, (endIndex as number) + 1).forEach(child => {
          if (child !== referBlock) {
            this.removeBlock(child, children)
          } else {
            this.insertAfter(quoteBlock, child)
            this.removeBlock(child, children)
          }
          this.appendChild(quoteBlock, child)
        })
      }
    }
  }

  prototype.insertContainerBlock = function (functionType: string, block: BlockLike): void {
    const anchor = this.getAnchor(block)
    if (!anchor) {
      console.error('Can not find the anchor paragraph to insert paragraph')
      return
    }

    const value = anchor.type === 'p'
      ? anchor.children.map(child => child.text).join('\n').trim()
      : ''

    const containerBlock = this.createContainerBlock(functionType, value)
    this.insertAfter(containerBlock, anchor)
    if (anchor.type === 'p') {
      this.removeBlock(anchor)
    }

    const cursorBlock = containerBlock.children[0].children[0].children[0] as BlockLike
    const { key } = cursorBlock
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  prototype.showTablePicker = function (): void {
    const { eventCenter } = this.muya
    const reference = this.getPositionReference()

    const handler = (rows: number, columns: number): void => {
      this.createTable({ rows: rows + 1, columns: columns + 1 })
    }
    eventCenter.dispatch('muya-table-picker', { row: -1, column: -1 }, reference, handler.bind(this))
  }

  prototype.insertHtmlBlock = function (block: BlockLike): void {
    if (block.type === 'span') {
      block = this.getParent(block) as BlockLike
    }
    const preBlock = this.initHtmlBlock(block)
    const cursorBlock = this.firstInDescendant(preBlock)
    const { key, text } = cursorBlock
    const match = /^[^\n]+\n[^\n]*/.exec(text)
    const offset = match && match[0] ? match[0].length : 0

    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  prototype.updateParagraph = function (paraType: string, insertMode = false): void {
    const { start, end } = this.cursor
    const block = this.getBlock(start.key) as BlockLike
    const { text, type } = block
    let needDispatchChange: boolean | void = true

    // Only allow valid transformations.
    if (!this.isAllowedTransformation(block, paraType, start.key !== end.key)) {
      return
    }

    // Convert back to paragraph.
    if (paraType === 'reset-to-paragraph') {
      const blockType = this.getTypeFromBlock(block)
      if (!blockType) {
        return
      }

      if (blockType === 'table') {
        return
      } else if (/heading|hr/.test(blockType)) {
        paraType = 'paragraph'
      } else {
        paraType = blockType
      }
    }

    switch (paraType) {
      case 'front-matter': {
        this.handleFrontMatter()
        break
      }
      case 'ul-bullet':
      case 'ul-task':
      case 'ol-order': {
        needDispatchChange = this.handleListMenu(paraType, insertMode)
        break
      }
      case 'loose-list-item': {
        this.handleLooseListItem()
        break
      }
      case 'pre': {
        this.handleCodeBlockMenu()
        break
      }
      case 'blockquote': {
        this.handleQuoteMenu(insertMode)
        break
      }
      case 'mathblock': {
        this.insertContainerBlock('multiplemath', block)
        break
      }
      case 'table': {
        this.showTablePicker()
        break
      }
      case 'html': {
        this.insertHtmlBlock(block)
        break
      }
      case 'flowchart':
      case 'sequence':
      case 'plantuml':
      case 'mermaid':
      case 'vega-lite':
        this.insertContainerBlock(paraType, block)
        break
      case 'heading 1':
      case 'heading 2':
      case 'heading 3':
      case 'heading 4':
      case 'heading 5':
      case 'heading 6':
      case 'upgrade heading':
      case 'degrade heading':
      case 'paragraph': {
        if (start.key !== end.key) {
          return
        }

        const headingStyle = DEFAULT_TURNDOWN_CONFIG.headingStyle
        const parent = this.getParent(block) as BlockLike
        // \u00A0 is &nbsp;
        const match = /(^ {0,3}#*[ \u00A0]*)([\s\S]*)/.exec(text) as RegExpExecArray
        const hash = match[1]
        const partText = match[2]
        let newLevel = 0 // 1, 2, 3, 4, 5, 6
        let newType = 'p'
        let key: string

        if (/\d/.test(paraType)) {
          newLevel = Number(paraType.split(/\s/)[1])
          newType = `h${newLevel}`
        } else if (paraType === 'upgrade heading' || paraType === 'degrade heading') {
          const currentLevel = getCurrentLevel(parent.type)
          newLevel = currentLevel
          if (paraType === 'upgrade heading' && currentLevel !== 1) {
            if (currentLevel === 0) newLevel = 6
            else newLevel = currentLevel - 1
          } else if (paraType === 'degrade heading' && currentLevel !== 0) {
            if (currentLevel === 6) newLevel = 0
            else newLevel = currentLevel + 1
          }
          newType = newLevel === 0 ? 'p' : `h${newLevel}`
        }

        const startOffset = newLevel > 0
          ? start.offset + newLevel - hash.length + 1
          : start.offset - hash.length
        const endOffset = newLevel > 0
          ? end.offset + newLevel - hash.length + 1
          : end.offset - hash.length
        let newText = newLevel > 0
          ? '#'.repeat(newLevel) + `${String.fromCharCode(160)}${partText}`
          : partText

        // Remove <hr> content when converting to paragraph.
        if (type === 'span' && block.functionType === 'thematicBreakLine') {
          newText = ''
        }

        // No change
        if (newType === 'p' && parent.type === newType) {
          return
        }
        // No change
        if (newType !== 'p' && parent.type === newType && parent.headingStyle === headingStyle) {
          return
        }

        if (newType !== 'p') {
          const header = this.createBlock(newType, {
            headingStyle
          })
          const headerContent = this.createBlock('span', {
            text: headingStyle === 'atx' ? newText.replace(/\n/g, ' ') : newText,
            functionType: headingStyle === 'atx' ? 'atxLine' : 'paragraphContent'
          })
          this.appendChild(header, headerContent)
          key = headerContent.key

          this.insertBefore(header, parent)
          this.removeBlock(parent)
        } else {
          const pBlock = this.createBlockP(newText)
          key = pBlock.children[0].key
          this.insertAfter(pBlock, parent)
          this.removeBlock(parent)
        }

        this.cursor = {
          start: { key, offset: startOffset },
          end: { key, offset: endOffset }
        }
        break
      }
      case 'hr': {
        const pBlock = this.createBlockP()
        const archor = block.type === 'span' ? (this.getParent(block) as BlockLike) : block
        const hrBlock = this.createBlock('hr')
        const thematicContent = this.createBlock('span', {
          functionType: 'thematicBreakLine',
          text: '---'
        })
        this.appendChild(hrBlock, thematicContent)
        this.insertAfter(hrBlock, archor)
        this.insertAfter(pBlock, hrBlock)
        if (!text) {
          if (block.type === 'span' && this.isOnlyChild(block)) {
            this.removeBlock(archor)
          } else {
            this.removeBlock(block)
          }
        }
        const { key } = pBlock.children[0]
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        break
      }
    }
    if (paraType === 'front-matter' || paraType === 'pre') {
      this.render()
    } else {
      this.partialRender()
    }

    if (needDispatchChange) {
      this.muya.dispatchSelectionChange()
      this.muya.dispatchSelectionFormats()
      this.muya.dispatchChange()
    }
  }

  prototype.insertParagraph = function (location: string, text = '', outMost = false): void {
    const { start, end } = this.cursor
    // if cursor is not in one line or paragraph, can not insert paragraph
    if (start.key !== end.key) return
    const block = this.getBlock(start.key) as BlockLike
    let anchor: BlockLike | null = null
    if (outMost) {
      anchor = this.findOutMostBlock(block)
    } else {
      anchor = this.getAnchor(block)
    }

    // You can not insert paragraph before frontmatter
    if (!anchor || (anchor.functionType === 'frontmatter' && location === 'before')) {
      return
    }

    const newBlock = this.createBlockP(text)
    if (location === 'before') {
      this.insertBefore(newBlock, anchor)
    } else {
      this.insertAfter(newBlock, anchor)
    }
    const { key } = newBlock.children[0]
    const offset = text.length
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
    this.muya.eventCenter.dispatch('stateChange')
  }

  // make a dulication of the current block
  prototype.duplicate = function (): unknown {
    const { start, end } = this.cursor
    const startOutmostBlock = this.findOutMostBlock(this.getBlock(start.key) as BlockLike)
    const endOutmostBlock = this.findOutMostBlock(this.getBlock(end.key) as BlockLike)
    if (startOutmostBlock !== endOutmostBlock) {
      // if the cursor is not in one paragraph, just return
      return
    }
    // if copied block has pre block: html, multiplemath, vega-light, mermaid, flowchart, sequence, plantuml...
    const copiedBlock = this.copyBlock(startOutmostBlock)
    this.insertAfter(copiedBlock, startOutmostBlock)

    const cursorBlock = this.firstInDescendant(copiedBlock)
    // set cursor at the end of the first descendant of the duplicated block.
    const { key, text } = cursorBlock
    const offset = text.length
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
    return this.muya.eventCenter.dispatch('stateChange')
  }

  // delete current paragraph
  prototype.deleteParagraph = function (blockKey?: string): unknown {
    let startOutmostBlock: BlockLike
    if (blockKey) {
      const block = this.getBlock(blockKey) as BlockLike
      const firstEditableBlock = this.firstInDescendant(block)
      startOutmostBlock = this.getAnchor(firstEditableBlock) as BlockLike
    } else {
      const { start, end } = this.cursor
      startOutmostBlock = this.findOutMostBlock(this.getBlock(start.key) as BlockLike)
      const endOutmostBlock = this.findOutMostBlock(this.getBlock(end.key) as BlockLike)
      if (startOutmostBlock !== endOutmostBlock) {
        // if the cursor is not in one paragraph, just return
        return
      }
    }

    const preBlock = this.getBlock(startOutmostBlock.preSibling)
    const nextBlock = this.getBlock(startOutmostBlock.nextSibling)
    let cursorBlock: BlockLike | null = null
    if (nextBlock) {
      cursorBlock = this.firstInDescendant(nextBlock)
    } else if (preBlock) {
      cursorBlock = this.lastInDescendant(preBlock)
    } else {
      const newBlock = this.createBlockP()
      this.insertAfter(newBlock, startOutmostBlock)
      cursorBlock = this.firstInDescendant(newBlock)
    }
    this.removeBlock(startOutmostBlock)
    const { key, text } = cursorBlock as BlockLike
    const offset = text.length
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
    return this.muya.eventCenter.dispatch('stateChange')
  }

  prototype.isSelectAll = function (): boolean {
    const firstTextBlock = this.getFirstBlock()
    const lastTextBlock = this.getLastBlock()
    const { start, end } = this.cursor

    return firstTextBlock.key === start.key &&
      start.offset === 0 &&
      lastTextBlock.key === end.key &&
      end.offset === lastTextBlock.text.length &&
      !this.muya.keyboard.isComposed
  }

  prototype.selectAllContent = function (): void {
    const firstTextBlock = this.getFirstBlock()
    const lastTextBlock = this.getLastBlock()
    this.cursor = {
      start: {
        key: firstTextBlock.key,
        offset: 0
      },
      end: {
        key: lastTextBlock.key,
        offset: lastTextBlock.text.length
      }
    }

    return this.render()
  }

  prototype.selectAll = function (): unknown {
    const mayBeCell = this.isSingleCellSelected()
    const mayBeTable = this.isWholeTableSelected()

    if (mayBeTable) {
      this.selectedTableCells = null
      return this.selectAllContent()
    }

    // Select whole table if already select one cell.
    if (mayBeCell) {
      const table = this.closest(mayBeCell, 'table')

      if (table) {
        return this.selectTable(table)
      }
    }
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike
    // handle selectAll in table.
    if (startBlock.functionType === 'cellContent' && endBlock.functionType === 'cellContent') {
      if (start.key === end.key) {
        const table = this.closest(startBlock, 'table') as BlockLike
        const cellBlock = this.closest(startBlock, /th|td/) as BlockLike

        this.selectedTableCells = {
          tableId: table.key,
          row: 1,
          column: 1,
          cells: [{
            key: cellBlock.key,
            text: cellBlock.children[0].text,
            top: true,
            right: true,
            bottom: true,
            left: true
          }]
        }

        this.singleRender(table, false)
        return this.muya.eventCenter.dispatch('muya-format-picker', { reference: null })
      } else {
        const startTable = this.closest(startBlock, 'table')
        const endTable = this.closest(endBlock, 'table')
        // Check whether both blocks are in the same table.
        if (!startTable || !endTable) {
          console.error('No table found or invalid type.')
          return
        } else if (startTable.key !== endTable.key) {
          // Select entire document
          return
        }
        return this.selectTable(startTable)
      }
    }
    // Handler selectAll in code block. only select all the code block conent.
    // `code block` here is Math, HTML, BLOCK CODE, Mermaid, vega-lite, flowchart, front-matter etc...
    if (startBlock.type === 'span' && startBlock.functionType === 'codeContent') {
      const { key } = startBlock
      this.cursor = {
        start: {
          key,
          offset: 0
        },
        end: {
          key,
          offset: startBlock.text.length
        }
      }

      return this.partialRender()
    }
    // Handler language input, only select language info only...
    if (startBlock.type === 'span' && startBlock.functionType === 'languageInput') {
      this.cursor = {
        start: {
          key: startBlock.key,
          offset: 0
        },
        end: {
          key: startBlock.key,
          offset: startBlock.text.length
        }
      }
      return this.partialRender()
    }

    return this.selectAllContent()
  }

  // Test whether the paragraph transformation is valid.
  prototype.isAllowedTransformation = function (block: BlockLike, toType: string, isMultilineSelection: boolean): boolean {
    const fromType = this.getTypeFromBlock(block)
    if (toType === 'front-matter') {
      // Front matter block is added at the beginning.
      return true
    } else if (!fromType) {
      return false
    } else if (isMultilineSelection && /heading|table/.test(toType)) {
      return false
    } else if (fromType === toType || toType === 'reset-to-paragraph') {
      // Convert back to paragraph.
      return true
    }

    switch (fromType) {
      case 'ul-bullet':
      case 'ul-task':
      case 'ol-order':
      case 'blockquote':
      case 'paragraph': {
        // Only allow line and table with an empty paragraph.
        if (/hr|table/.test(toType) && block.text) {
          return false
        }
        return true
      }
      case 'heading 1':
      case 'heading 2':
      case 'heading 3':
      case 'heading 4':
      case 'heading 5':
      case 'heading 6':
        return /paragraph|heading/.test(toType)
      default:
        // Tables and all code blocks are not allowed.
        return false
    }
  }

  // Translate block type into internal name.
  prototype.getTypeFromBlock = function (block: BlockLike): string {
    const { type } = block

    let internalType = ''
    const headingMatch = type.match(/^h([1-6]{1})$/)
    if (headingMatch && headingMatch[1]) {
      internalType = `heading ${headingMatch[1]}`
    }

    switch (type) {
      case 'span': {
        if (block.functionType === 'atxLine') {
          internalType = 'heading 1' // loose match
        } else if (block.functionType === 'languageInput') {
          internalType = 'pre'
        } else if (block.functionType === 'codeContent') {
          if (block.lang === 'markup') {
            internalType = 'html'
          } else if (block.lang === 'latex') {
            internalType = 'mathblock'
          }

          // We cannot easy distinguish between diagram and code blocks.
          const rootBlock = this.getAnchor(block)
          if (rootBlock && rootBlock.functionType !== 'fencecode') {
            // Block seems to be a diagram block.
            internalType = rootBlock.functionType || ''
          } else {
            internalType = 'pre'
          }
        } else if (block.functionType === 'cellContent') {
          internalType = 'table'
        } else if (block.functionType === 'thematicBreakLine') {
          internalType = 'hr'
        }

        // List and quote content is also a problem because it's shown as paragraph.
        const { affiliation } = this.selectionChange(this.cursor)
        const listTypes = affiliation
          .slice(0, 3) // the third entry should be the ul/ol
          .filter(b => /ul|ol/.test(b.type))
          .map(b => b.listType)

        // Prefer list or blockquote over paragraph.
        if (listTypes && listTypes.length === 1) {
          const listType = listTypes[0]
          if (listType === 'bullet') {
            internalType = 'ul-bullet'
          } else if (listType === 'task') {
            internalType = 'ul-task'
          } if (listType === 'order') {
            internalType = 'ol-order'
          }
        } else if (affiliation.length === 2 && affiliation[1].type === 'blockquote') {
          internalType = 'blockquote'
        } else if (block.functionType === 'paragraphContent') {
          internalType = 'paragraph'
        }
        break
      }
      case 'div': {
        // Preview for math formulas or diagramms.
        return ''
      }
      case 'figure': {
        if (block.functionType === 'multiplemath') {
          internalType = 'mathblock'
        } else {
          internalType = block.functionType || ''
        }
        break
      }
      case 'pre': {
        if (block.functionType === 'multiplemath') {
          internalType = 'mathblock'
        } else if (block.functionType === 'fencecode' || block.functionType === 'indentcode') {
          internalType = 'pre'
        } else if (block.functionType === 'frontmatter') {
          internalType = 'front-matter'
        } else {
          internalType = block.functionType || ''
        }
        break
      }
      case 'ul': {
        if (block.listType === 'task') {
          internalType = 'ul-task'
        } else {
          internalType = 'ul-bullet'
        }
        break
      }
      case 'ol': {
        internalType = 'ol-order'
        break
      }
      case 'li': {
        if (block.listItemType === 'order') {
          internalType = 'ol-order'
        } else if (block.listItemType === 'bullet') {
          internalType = 'ul-bullet'
        } else if (block.listItemType === 'task') {
          internalType = 'ul-task'
        }
        break
      }
      case 'table':
      case 'th':
      case 'td': {
        internalType = 'table'
        break
      }
    }
    return internalType
  }
}

export default paragraphCtrl
