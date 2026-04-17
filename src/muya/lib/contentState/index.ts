import { HAS_TEXT_BLOCK_REG, DEFAULT_TURNDOWN_CONFIG } from '../config'
import { getUniqueId, deepCopy } from '../utils'
import selection from '../selection'
import StateRender from '../parser/render'
import enterCtrl from './enterCtrl'
import updateCtrl from './updateCtrl'
import backspaceCtrl from './backspaceCtrl'
import deleteCtrl from './deleteCtrl'
import codeBlockCtrl from './codeBlockCtrl'
import tableBlockCtrl from './tableBlockCtrl'
import tableDragBarCtrl from './tableDragBarCtrl'
import tableSelectCellsCtrl from './tableSelectCellsCtrl'
import coreApi from './core'
import marktextApi from './marktext'
import History from './history'
import arrowCtrl from './arrowCtrl'
import pasteCtrl from './pasteCtrl'
import copyCutCtrl from './copyCutCtrl'
import paragraphCtrl from './paragraphCtrl'
import tabCtrl from './tabCtrl'
import formatCtrl from './formatCtrl'
import searchCtrl from './searchCtrl'
import containerCtrl from './containerCtrl'
import htmlBlockCtrl from './htmlBlock'
import clickCtrl from './clickCtrl'
import inputCtrl from './inputCtrl'
import tocCtrl from './tocCtrl'
import emojiCtrl from './emojiCtrl'
import imageCtrl from './imageCtrl'
import linkCtrl from './linkCtrl'
import dragDropCtrl from './dragDropCtrl'
import footnoteCtrl from './footnoteCtrl'
import importMarkdown from '../utils/importMarkdown'
import Cursor from '../selection/cursor'
import escapeCharactersMap, { escapeCharacters } from '../parser/escapeCharacter'

interface CursorPosition {
  key: string
  offset: number
  [key: string]: unknown
}

interface CursorRangeInput {
  anchor?: CursorPosition
  focus?: CursorPosition
  start: CursorPosition
  end: CursorPosition
  noHistory?: boolean
  [key: string]: unknown
}

interface CursorRange {
  anchor: CursorPosition
  focus: CursorPosition
  start: CursorPosition
  end: CursorPosition
  noHistory?: boolean
  [key: string]: unknown
}

interface SearchMatch {
  active?: boolean
  [key: string]: unknown
}

interface SearchMatchesState {
  value: string
  matches: SearchMatch[]
  index: number
}

type RenderRange = [string | null, string | null]

interface Block {
  key: string
  text: string
  type: string
  editable: boolean
  parent: string | null
  preSibling: string | null
  nextSibling: string | null
  children: Block[]
  functionType?: string
  [key: string]: unknown
}

type BlockExtras = Partial<Block> & Record<string, unknown>

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
  id: string | null
}

interface MuyaLike {
  container: HTMLElement
  options: {
    fontSize: number
    lineHeight: number
    [key: string]: unknown
  }
  blur(): void
  [key: string]: unknown
}

interface StateRenderLike {
  tokenCache: Map<unknown, unknown>
  collectLabels(blocks: Block[]): void
  render(blocks: Block[], activeBlocks: Block[], matches: SearchMatch[]): void
  partialRender(
    blocks: Block[],
    activeBlocks: Block[],
    matches: SearchMatch[],
    startKey: string | null,
    endKey: string | null
  ): void
  singleRender(block: Block, activeBlocks: Block[], matches: SearchMatch[]): void
}

interface SelectionLike {
  setCursorRange(cursorRange: CursorRange): void
  getCursorCoords(): {
    x: number
    y: number
    width: number
  }
}

interface ContentStateOptions extends Record<string, unknown> {
  bulletListMarker?: string
}

type StateRenderConstructor = new (muya: MuyaLike) => StateRenderLike

const selectionApi = selection as unknown as SelectionLike
const StateRenderCtor = StateRender as unknown as StateRenderConstructor
const escapeCharacterList = escapeCharacters as string[]
const escapeCharacterMap = escapeCharactersMap as Record<string, string>

class ContentState {
  muya: MuyaLike
  exemption: Set<unknown>
  blocks: Block[]
  stateRender: StateRenderLike
  renderRange: RenderRange
  currentCursor: CursorRange | null
  selectedBlock: Block | null
  _selectedImage: unknown
  dropAnchor: unknown
  prevCursor: CursorRange | null
  historyTimer: ReturnType<typeof setTimeout> | null
  history: History
  turndownConfig: Record<string, unknown>
  dragInfo: unknown
  isDragTableBar: boolean
  dragEventIds: unknown[]
  cellSelectInfo: unknown
  _selectedTableCells: unknown
  cellSelectEventIds: unknown[]
  searchMatches!: SearchMatchesState
  resizeLineNumber!: () => void

  constructor (muya: MuyaLike, options: ContentStateOptions) {
    const { bulletListMarker } = options

    this.muya = muya
    Object.assign(this, options)

    // Use to cache the keys which you don't want to remove.
    this.exemption = new Set()
    this.blocks = [this.createBlockP()]
    this.stateRender = new StateRenderCtor(muya)
    this.renderRange = [null, null]
    this.currentCursor = null
    // you'll select the outmost block of current cursor when you click the front icon.
    this.selectedBlock = null
    this._selectedImage = null
    this.dropAnchor = null
    this.prevCursor = null
    this.historyTimer = null
    this.history = new History(this)
    this.turndownConfig = Object.assign({}, DEFAULT_TURNDOWN_CONFIG, { bulletListMarker }) as Record<string, unknown>
    // table drag bar
    this.dragInfo = null
    this.isDragTableBar = false
    this.dragEventIds = []
    // table cell select
    this.cellSelectInfo = null
    this._selectedTableCells = null
    this.cellSelectEventIds = []
    this.init()
  }

  set selectedTableCells (info: unknown) {
    const oldSelectedTableCells = this._selectedTableCells
    if (!info && !!oldSelectedTableCells) {
      const selectedCells = this.muya.container.querySelectorAll<HTMLElement>('.ag-cell-selected')

      for (const cell of Array.from(selectedCells)) {
        cell.classList.remove('ag-cell-selected')
        cell.classList.remove('ag-cell-border-top')
        cell.classList.remove('ag-cell-border-right')
        cell.classList.remove('ag-cell-border-bottom')
        cell.classList.remove('ag-cell-border-left')
      }
    }
    this._selectedTableCells = info
  }

  get selectedTableCells (): unknown {
    return this._selectedTableCells
  }

  set selectedImage (image: unknown) {
    const oldSelectedImage = this._selectedImage
    // if there is no selected image, remove selected status of current selected image.
    if (!image && oldSelectedImage) {
      const selectedImages = this.muya.container.querySelectorAll<HTMLElement>('.ag-inline-image-selected')
      for (const img of selectedImages) {
        img.classList.remove('ag-inline-image-selected')
      }
    }
    this._selectedImage = image
  }

  get selectedImage (): unknown {
    return this._selectedImage
  }

  set cursor (cursor: Cursor | CursorRangeInput) {
    let nextCursor = cursor
    if (!(nextCursor instanceof Cursor)) {
      nextCursor = new Cursor(nextCursor as CursorRangeInput)
    }

    const normalizedCursor = nextCursor as unknown as CursorRange
    this.prevCursor = this.currentCursor
    this.currentCursor = normalizedCursor

    const getHistoryState = () => {
      const { blocks, renderRange, currentCursor } = this
      return {
        blocks,
        renderRange,
        cursor: currentCursor as CursorRange
      }
    }

    if (!normalizedCursor.noHistory) {
      if (
        this.prevCursor &&
        (
          this.prevCursor.start.key !== normalizedCursor.start.key ||
          this.prevCursor.end.key !== normalizedCursor.end.key
        )
      ) {
        // Push history immediately
        this.history.push(getHistoryState())
      } else {
        // WORKAROUND: The current engine doesn't support a smart history and we
        // need to store the whole state. Therefore, we push history only when the
        // user stops typing. Pushing one pending entry allows us to commit the
        // change before an undo action is triggered to partially solve #1321.
        if (this.historyTimer) clearTimeout(this.historyTimer)
        this.history.pushPending(getHistoryState())

        this.historyTimer = setTimeout(() => {
          this.history.commitPending()
        }, 2000)
      }
    }
  }

  get cursor (): CursorRange {
    return this.currentCursor as CursorRange
  }

  init (): void {
    const lastBlock = this.getLastBlock() as Block
    const { key, text } = lastBlock
    const offset = text.length
    this.searchMatches = {
      value: '', // the search value
      matches: [], // matches
      index: -1 // active match
    }
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  getHistory (): Pick<History, 'stack' | 'index'> {
    const { stack, index } = this.history
    return { stack, index }
  }

  setHistory ({ stack, index }: Pick<History, 'stack' | 'index'>): void {
    Object.assign(this.history, { stack, index })
  }

  setCursor (): void {
    selectionApi.setCursorRange(this.cursor)
  }

  setNextRenderRange (): void {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key) as Block
    const endBlock = this.getBlock(end.key) as Block
    const startOutMostBlock = this.findOutMostBlock(startBlock)
    const endOutMostBlock = this.findOutMostBlock(endBlock)

    this.renderRange = [startOutMostBlock.preSibling, endOutMostBlock.nextSibling]
  }

  postRender (): void {
    this.resizeLineNumber()
  }

  render (isRenderCursor = true, clearCache = false): void {
    const { blocks, searchMatches: { matches, index } } = this
    const activeBlocks = this.getActiveBlocks()
    if (clearCache) {
      this.stateRender.tokenCache.clear()
    }
    matches.forEach((m, i) => {
      m.active = i === index
    })
    this.setNextRenderRange()
    this.stateRender.collectLabels(blocks)
    this.stateRender.render(blocks, activeBlocks, matches)
    if (isRenderCursor) {
      this.setCursor()
    } else {
      this.muya.blur()
    }
    this.postRender()
  }

  partialRender (isRenderCursor = true): void {
    const { blocks, searchMatches: { matches, index } } = this
    const activeBlocks = this.getActiveBlocks()
    const [startKey, endKey] = this.renderRange
    matches.forEach((m, i) => {
      m.active = i === index
    })

    // The `endKey` may already be removed from blocks if range was selected via keyboard (GH#1854).
    let startIndex = startKey ? blocks.findIndex(block => block.key === startKey) : 0
    if (startIndex === -1) {
      startIndex = 0
    }

    let endIndex = blocks.length
    if (endKey) {
      const tmpEndIndex = blocks.findIndex(block => block.key === endKey)
      if (tmpEndIndex >= 0) {
        endIndex = tmpEndIndex + 1
      }
    }

    const blocksToRender = blocks.slice(startIndex, endIndex)

    this.setNextRenderRange()
    this.stateRender.collectLabels(blocks)
    this.stateRender.partialRender(blocksToRender, activeBlocks, matches, startKey, endKey)
    if (isRenderCursor) {
      this.setCursor()
    } else {
      this.muya.blur()
    }
    this.postRender()
  }

  singleRender (block: Block, isRenderCursor = true): void {
    const { blocks, searchMatches: { matches, index } } = this
    const activeBlocks = this.getActiveBlocks()
    matches.forEach((m, i) => {
      m.active = i === index
    })
    this.setNextRenderRange()
    this.stateRender.collectLabels(blocks)
    this.stateRender.singleRender(block, activeBlocks, matches)
    if (isRenderCursor) {
      this.setCursor()
    } else {
      this.muya.blur()
    }
    this.postRender()
  }

  /**
   * A block in MarkText present a paragraph(block syntax in GFM) or a line in paragraph.
   * a `span` block must in a `p block` or `pre block` and `p block`'s children must be `span` blocks.
   */
  createBlock (type = 'span', extras: BlockExtras = {}): Block {
    const key = getUniqueId()
    const blockData: Block = {
      key,
      text: '',
      type,
      editable: true,
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }

    // give span block a default functionType `paragraphContent`
    if (type === 'span' && !extras.functionType) {
      blockData.functionType = 'paragraphContent'
    }

    if (extras.functionType === 'codeContent' && typeof extras.text === 'string') {
      const CHAR_REG = new RegExp(`(${escapeCharacterList.join('|')})`, 'gi')
      extras.text = extras.text.replace(CHAR_REG, (_: string, p: string) => {
        return escapeCharacterMap[p] as string
      })
    }

    Object.assign(blockData, extras)
    return blockData
  }

  createBlockP (text = ''): Block {
    const pBlock = this.createBlock('p')
    const contentBlock = this.createBlock('span', { text })
    this.appendChild(pBlock, contentBlock)
    return pBlock
  }

  isCollapse (cursor = this.cursor): boolean {
    const { start, end } = cursor
    return start.key === end.key && start.offset === end.offset
  }

  // getBlocks
  getBlocks (): Block[] {
    return this.blocks
  }

  getCursor (): CursorRange {
    return this.cursor
  }

  getBlock (key: string | null | undefined): Block | null {
    if (!key) return null
    let result: Block | null = null
    const travel = (blocks: Block[]) => {
      for (const block of blocks) {
        if (block.key === key) {
          result = block
          return
        }
        const { children } = block
        if (children.length) {
          travel(children)
        }
      }
    }
    travel(this.blocks)
    return result
  }

  copyBlock (origin: Block): Block {
    const copiedBlock = deepCopy(origin) as Block
    const travel = (block: Block, parent: Block | null, preBlock: Block | null, nextBlock: Block | null) => {
      const key = getUniqueId()
      block.key = key
      block.parent = parent ? parent.key : null
      block.preSibling = preBlock ? preBlock.key : null
      block.nextSibling = nextBlock ? nextBlock.key : null
      const { children } = block
      const len = children.length
      if (children && len) {
        let i
        for (i = 0; i < len; i++) {
          const b = children[i]
          const preB = i >= 1 ? children[i - 1] : null
          const nextB = i < len - 1 ? children[i + 1] : null
          travel(b, block, preB, nextB)
        }
      }
    }

    travel(copiedBlock, null, null, null)
    return copiedBlock
  }

  getParent (block: Block | null | undefined): Block | null {
    if (block && block.parent) {
      return this.getBlock(block.parent)
    }
    return null
  }

  // return block and its parents
  getParents (block: Block): Block[] {
    const result = []
    result.push(block)
    let parent = this.getParent(block)
    while (parent) {
      result.push(parent)
      parent = this.getParent(parent)
    }
    return result
  }

  getPreSibling (block: Block): Block | null {
    return block.preSibling ? this.getBlock(block.preSibling) : null
  }

  getNextSibling (block: Block): Block | null {
    return block.nextSibling ? this.getBlock(block.nextSibling) : null
  }

  /**
   * if target is descendant of parent return true, else return false
   * @param  {[type]}  parent [description]
   * @param  {[type]}  target [description]
   * @return {Boolean}        [description]
   */
  isInclude (parent: Block, target: Block): boolean {
    const children = parent.children
    if (children.length === 0) {
      return false
    } else {
      if (children.some(child => child.key === target.key)) {
        return true
      } else {
        return children.some(child => this.isInclude(child, target))
      }
    }
  }

  removeTextOrBlock (block: Block): void {
    if (block.functionType === 'languageInput') return
    const checkerIn = (currentBlock: Block): boolean => {
      if (this.exemption.has(currentBlock.key)) {
        return true
      } else {
        const parent = this.getBlock(currentBlock.parent)
        return parent ? checkerIn(parent) : false
      }
    }

    const checkerOut = (currentBlock: Block): boolean => {
      const children = currentBlock.children
      if (children.length) {
        if (children.some(child => this.exemption.has(child.key))) {
          return true
        } else {
          return children.some(child => checkerOut(child))
        }
      } else {
        return false
      }
    }

    if (checkerIn(block) || checkerOut(block)) {
      block.text = ''
      const { children } = block
      if (children.length) {
        children.forEach(child => this.removeTextOrBlock(child))
      }
    } else if (block.editable) {
      this.removeBlock(block)
    }
  }

  /**
   * remove blocks between before and after, and includes after block.
   */
  removeBlocks (before: Block, after: Block, isRemoveAfter = true, isRecursion = false): void {
    if (!isRecursion) {
      if (/td|th/.test(before.type)) {
        this.exemption.add(this.closest(before, 'figure'))
      }
      if (/td|th/.test(after.type)) {
        this.exemption.add(this.closest(after, 'figure'))
      }
    }
    let nextSibling = this.getBlock(before.nextSibling)
    let beforeEnd = false
    while (nextSibling) {
      if (nextSibling.key === after.key || this.isInclude(nextSibling, after)) {
        beforeEnd = true
        break
      }
      this.removeTextOrBlock(nextSibling)
      nextSibling = this.getBlock(nextSibling.nextSibling)
    }
    if (!beforeEnd) {
      const parent = this.getParent(before)
      if (parent) {
        this.removeBlocks(parent, after, false, true)
      }
    }
    let preSibling = this.getBlock(after.preSibling)
    let afterEnd = false
    while (preSibling) {
      if (preSibling.key === before.key || this.isInclude(preSibling, before)) {
        afterEnd = true
        break
      }
      this.removeTextOrBlock(preSibling)
      preSibling = this.getBlock(preSibling.preSibling)
    }
    if (!afterEnd) {
      const parent = this.getParent(after)
      if (parent) {
        const removeAfter = isRemoveAfter && this.isOnlyRemoveableChild(after)
        this.removeBlocks(before, parent, removeAfter, true)
      }
    }
    if (isRemoveAfter) {
      this.removeTextOrBlock(after)
    }
    if (!isRecursion) {
      this.exemption.clear()
    }
  }

  removeBlock (block: Block, fromBlocks: Block[] | Block = this.blocks): void {
    const remove = (blocks: Block[], currentBlock: Block): Block[] | undefined => {
      const len = blocks.length
      let i
      for (i = 0; i < len; i++) {
        if (blocks[i].key === currentBlock.key) {
          const preSibling = this.getBlock(currentBlock.preSibling)
          const nextSibling = this.getBlock(currentBlock.nextSibling)

          if (preSibling) {
            preSibling.nextSibling = nextSibling ? nextSibling.key : null
          }
          if (nextSibling) {
            nextSibling.preSibling = preSibling ? preSibling.key : null
          }

          return blocks.splice(i, 1)
        } else {
          if (blocks[i].children.length) {
            remove(blocks[i].children, currentBlock)
          }
        }
      }
    }
    remove(Array.isArray(fromBlocks) ? fromBlocks : fromBlocks.children, block)
  }

  getActiveBlocks (): Block[] {
    const result = []
    let block = this.getBlock(this.cursor.start.key)
    if (block) {
      result.push(block)
    }
    while (block && block.parent) {
      block = this.getBlock(block.parent) as Block
      result.push(block)
    }
    return result
  }

  insertAfter (newBlock: Block, oldBlock: Block): void {
    const siblings = oldBlock.parent ? (this.getBlock(oldBlock.parent) as Block).children : this.blocks
    const oldNextSibling = this.getBlock(oldBlock.nextSibling)
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index + 1, 0, newBlock)
    oldBlock.nextSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.key
    if (oldNextSibling) {
      newBlock.nextSibling = oldNextSibling.key
      oldNextSibling.preSibling = newBlock.key
    }
  }

  insertBefore (newBlock: Block, oldBlock: Block): void {
    const siblings = oldBlock.parent ? (this.getBlock(oldBlock.parent) as Block).children : this.blocks
    const oldPreSibling = this.getBlock(oldBlock.preSibling)
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index, 0, newBlock)
    oldBlock.preSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.nextSibling = oldBlock.key
    newBlock.preSibling = null

    if (oldPreSibling) {
      oldPreSibling.nextSibling = newBlock.key
      newBlock.preSibling = oldPreSibling.key
    }
  }

  findOutMostBlock (block: Block): Block {
    const parent = this.getBlock(block.parent)
    return parent ? this.findOutMostBlock(parent) : block
  }

  findIndex (children: Block[], block: Block): number {
    return children.findIndex(child => child === block)
  }

  prependChild (parent: Block, block: Block): void {
    block.parent = parent.key
    block.preSibling = null
    if (parent.children.length) {
      block.nextSibling = parent.children[0].key
    }
    parent.children.unshift(block)
  }

  appendChild (parent: Block, block: Block): void {
    const len = parent.children.length
    const lastChild = parent.children[len - 1]
    parent.children.push(block)
    block.parent = parent.key
    if (lastChild) {
      lastChild.nextSibling = block.key
      block.preSibling = lastChild.key
    } else {
      block.preSibling = null
    }
    block.nextSibling = null
  }

  replaceBlock (newBlock: Block, oldBlock: Block): void {
    const blockList = oldBlock.parent ? (this.getParent(oldBlock) as Block).children : this.blocks
    const index = this.findIndex(blockList, oldBlock)

    blockList.splice(index, 1, newBlock)
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.preSibling
    newBlock.nextSibling = oldBlock.nextSibling
  }

  canInserFrontMatter (block: Block | null): boolean {
    if (!block) return true
    const parent = this.getParent(block) as Block
    return block.type === 'span' &&
      !block.preSibling &&
      !parent.preSibling &&
      !parent.parent
  }

  isFirstChild (block: Block): boolean {
    return !block.preSibling
  }

  isLastChild (block: Block): boolean {
    return !block.nextSibling
  }

  isOnlyChild (block: Block): boolean {
    return !block.nextSibling && !block.preSibling
  }

  isOnlyRemoveableChild (block: Block): boolean {
    if (block.editable === false) return false
    const parent = this.getParent(block)
    return (parent ? parent.children : this.blocks).filter(child => child.editable && child.functionType !== 'languageInput').length === 1
  }

  getLastChild (block: Block | null | undefined): Block | null {
    if (block) {
      const len = block.children.length
      if (len) {
        return block.children[len - 1]
      }
    }
    return null
  }

  firstInDescendant (block: Block): Block | undefined {
    const children = block.children
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (children.length) {
      if (
        children[0].type === 'input' ||
        (children[0].type === 'div' && children[0].editable === false)
      ) { // handle task item
        return this.firstInDescendant(children[1] as Block)
      } else {
        return this.firstInDescendant(children[0] as Block)
      }
    }
  }

  lastInDescendant (block: Block): Block | undefined {
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (block.children.length) {
      const children = block.children
      let lastChild = children[children.length - 1] as Block
      while (lastChild.editable === false) {
        lastChild = this.getPreSibling(lastChild) as Block
      }
      return this.lastInDescendant(lastChild)
    }
  }

  findPreBlockInLocation (block: Block): Block | null | undefined {
    const parent = this.getParent(block)
    const preBlock = this.getPreSibling(block) as Block
    if (
      block.preSibling &&
      preBlock.type !== 'input' &&
      preBlock.type !== 'div' &&
      preBlock.editable !== false
    ) { // handle task item and table
      return this.lastInDescendant(preBlock)
    } else if (parent) {
      return this.findPreBlockInLocation(parent)
    } else {
      return null
    }
  }

  findNextBlockInLocation (block: Block): Block | null | undefined {
    const parent = this.getParent(block)
    const nextBlock = this.getNextSibling(block)

    if (
      nextBlock && nextBlock.editable !== false
    ) {
      return this.firstInDescendant(nextBlock)
    } else if (parent) {
      return this.findNextBlockInLocation(parent)
    } else {
      return null
    }
  }

  getPositionReference (): PositionReference {
    const { fontSize, lineHeight } = this.muya.options
    const { start } = this.cursor
    const block = this.getBlock(start.key)
    const { x, y, width } = selectionApi.getCursorCoords()
    const height = fontSize * lineHeight
    const bottom = y + height
    const right = x + width
    const left = x
    const top = y
    return {
      getBoundingClientRect () {
        return { x, y, top, left, right, bottom, height, width }
      },
      clientWidth: width,
      clientHeight: height,
      id: block ? block.key : null
    }
  }

  getFirstBlock (): Block | undefined {
    return this.firstInDescendant(this.blocks[0] as Block)
  }

  getLastBlock (): Block | undefined {
    const { blocks } = this
    const len = blocks.length
    return this.lastInDescendant(blocks[len - 1] as Block)
  }

  closest (block: Block | null | undefined, type: string | RegExp): Block | null {
    if (!block) {
      return null
    }
    if (type instanceof RegExp ? type.test(block.type) : block.type === type) {
      return block
    } else {
      const parent = this.getParent(block)
      return this.closest(parent, type)
    }
  }

  getAnchor (block: Block): Block | null {
    const { type, functionType } = block
    if (type !== 'span') {
      return null
    }

    if (functionType === 'codeContent' || functionType === 'cellContent') {
      return this.closest(block, 'figure') || this.closest(block, 'pre')
    } else {
      return this.getParent(block)
    }
  }

  clear (): void {
    this.history.clearHistory()
  }
}

type ContentStateMixin = (contentState: typeof ContentState) => void

const prototypes: ContentStateMixin[] = [
  coreApi as unknown as ContentStateMixin,
  marktextApi as unknown as ContentStateMixin,
  tabCtrl as ContentStateMixin,
  enterCtrl as ContentStateMixin,
  updateCtrl as ContentStateMixin,
  backspaceCtrl as ContentStateMixin,
  deleteCtrl as unknown as ContentStateMixin,
  codeBlockCtrl as ContentStateMixin,
  arrowCtrl as unknown as ContentStateMixin,
  pasteCtrl as ContentStateMixin,
  copyCutCtrl as ContentStateMixin,
  tableBlockCtrl as ContentStateMixin,
  tableDragBarCtrl as ContentStateMixin,
  tableSelectCellsCtrl as ContentStateMixin,
  paragraphCtrl as ContentStateMixin,
  formatCtrl as ContentStateMixin,
  searchCtrl as unknown as ContentStateMixin,
  containerCtrl as ContentStateMixin,
  htmlBlockCtrl as unknown as ContentStateMixin,
  clickCtrl as ContentStateMixin,
  inputCtrl as ContentStateMixin,
  tocCtrl as ContentStateMixin,
  emojiCtrl as unknown as ContentStateMixin,
  imageCtrl as ContentStateMixin,
  linkCtrl as unknown as ContentStateMixin,
  dragDropCtrl as ContentStateMixin,
  footnoteCtrl as ContentStateMixin,
  importMarkdown as ContentStateMixin
]

prototypes.forEach(ctrl => ctrl(ContentState))

export default ContentState
