import selection from '../selection'
import { HTML_TAGS, VOID_HTML_TAGS, HAS_TEXT_BLOCK_REG } from '../config'
import { tokenizer } from '../parser'

interface SelectorParseResult {
  tag: string
  id: string
  className: string
  isVoid: boolean
}

interface CursorPosition {
  key: string
  offset: number
  [key: string]: unknown
}

interface CursorRangeLike {
  start?: CursorPosition | null
  end?: CursorPosition | null
  [key: string]: unknown
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
  isLooseListItem?: boolean
  lang?: string
  [key: string]: unknown
}

interface ParserTokenRange {
  start: number
  end: number
}

interface BacklashPair {
  first: string
  second: string
}

interface ParserToken {
  type: string
  range: ParserTokenRange
  marker?: string
  children?: ParserToken[] | ''
  srcAndTitle?: string
  hrefAndTitle?: string
  backlash?: string | BacklashPair
  closeTag?: string
  isFullLink?: boolean
  label?: string
  [key: string]: unknown
}

interface CursorAtEndFormatResult {
  offset: number
}

interface StateRenderLike {
  labels: Map<string, unknown>
}

interface MuyaLike {
  options: Record<string, unknown>
}

interface ContentStateLike {
  cursor: {
    start: CursorPosition
    end: CursorPosition
    noHistory?: boolean
  }
  tabSize: number
  stateRender: StateRenderLike
  muya: MuyaLike
  getParent(block: BlockLike | null | undefined): BlockLike | null
  getBlock(key: string | null | undefined): BlockLike | null
  getNextSibling(block: BlockLike): BlockLike | null
  getPreSibling(block: BlockLike): BlockLike | null
  getLastChild(block: BlockLike | null | undefined): BlockLike | null
  firstInDescendant(block: BlockLike): BlockLike | undefined
  lastInDescendant(block: BlockLike): BlockLike | undefined
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  removeBlock(block: BlockLike, fromBlocks?: BlockLike[] | BlockLike): void
  isOnlyChild(block: BlockLike): boolean
  isCollapse(cursor?: unknown): boolean
  closest(block: BlockLike | null | undefined, type: string | RegExp): BlockLike | null
  partialRender(arg?: unknown): unknown
  singleRender(block: BlockLike, isRenderCursor?: boolean): unknown
}

interface TabCtrlMethods {
  findNextCell(block: BlockLike): BlockLike | false | undefined
  findPreviousCell(block: BlockLike): BlockLike | undefined
  isUnindentableListItem(block: BlockLike): false | 'REPLACEMENT' | 'INDENT'
  isIndentableListItem(): string | false | null
  unindentListItem(block: BlockLike, type: 'REPLACEMENT' | 'INDENT'): unknown
  indentListItem(): unknown
  insertTab(): unknown
  checkCursorAtEndFormat(text: string, offset: number): CursorAtEndFormatResult | null
  tabHandler(event: KeyboardEvent): unknown
}

interface SelectionLike {
  getCursorRange(): CursorRangeLike
}

type ContentStateConstructor = {
  prototype: unknown
}

const htmlTags = HTML_TAGS as readonly string[]
const voidHtmlTags = VOID_HTML_TAGS as readonly string[]
const textBlockReg = HAS_TEXT_BLOCK_REG as RegExp
const selectionApi = selection as unknown as SelectionLike

const parseSelector = (str = ''): SelectorParseResult => {
  const REG_EXP = /(#|\.)([^#.]+)/
  let tag = ''
  let id = ''
  let className = ''
  let isVoid = false
  let cap: RegExpExecArray | null

  for (const tagName of htmlTags) {
    if (str.startsWith(tagName) && (!str[tagName.length] || /#|\./.test(str[tagName.length]))) {
      tag = tagName
      if (voidHtmlTags.indexOf(tagName) > -1) isVoid = true
      str = str.substring(tagName.length)
    }
  }

  if (tag !== '') {
    cap = REG_EXP.exec(str)
    while (cap && str.length) {
      if (cap[1] === '#') {
        id = cap[2]
      } else {
        className = cap[2]
      }
      str = str.substring(cap[0].length)
      cap = REG_EXP.exec(str)
    }
  }

  return { tag, id, className, isVoid }
}

const BOTH_SIDES_FORMATS = [
  'strong',
  'em',
  'inline_code',
  'image',
  'link',
  'reference_image',
  'reference_link',
  'emoji',
  'del',
  'html_tag',
  'inline_math'
] as const

const hasBacklashPair = (backlash: ParserToken['backlash']): backlash is BacklashPair => {
  return typeof backlash === 'object' && backlash !== null
}

const tabCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & TabCtrlMethods

  prototype.findNextCell = function (block: BlockLike): BlockLike | false | undefined {
    if (block.functionType !== 'cellContent') {
      throw new Error('only th and td can have next cell')
    }

    const cellBlock = this.getParent(block) as BlockLike
    const nextSibling = this.getBlock(cellBlock.nextSibling)
    const rowBlock = this.getBlock(cellBlock.parent) as BlockLike
    const tbOrTh = this.getBlock(rowBlock.parent) as BlockLike

    if (nextSibling) {
      return this.firstInDescendant(nextSibling)
    } else {
      if (rowBlock.nextSibling) {
        const nextRow = this.getBlock(rowBlock.nextSibling) as BlockLike
        return this.firstInDescendant(nextRow)
      } else if (tbOrTh.type === 'thead') {
        const tBody = this.getBlock(tbOrTh.nextSibling)
        if (tBody && tBody.children.length) {
          return this.firstInDescendant(tBody)
        }
      }
    }

    return false
  }

  prototype.findPreviousCell = function (block: BlockLike): BlockLike | undefined {
    if (block.functionType !== 'cellContent') {
      throw new Error('only th and td can have previous cell')
    }

    const cellBlock = this.getParent(block) as BlockLike
    const previousSibling = this.getBlock(cellBlock.preSibling)
    const rowBlock = this.getBlock(cellBlock.parent) as BlockLike
    const tbOrTh = this.getBlock(rowBlock.parent) as BlockLike

    if (previousSibling) {
      return this.firstInDescendant(previousSibling)
    } else {
      if (rowBlock.preSibling) {
        const previousRow = this.getBlock(rowBlock.preSibling) as BlockLike
        return this.lastInDescendant(previousRow)
      } else if (tbOrTh.type === 'tbody') {
        const tHead = this.getBlock(tbOrTh.preSibling)
        if (tHead && tHead.children.length) {
          return this.lastInDescendant(tHead)
        }
      }
    }

    return block
  }

  prototype.isUnindentableListItem = function (block: BlockLike): false | 'REPLACEMENT' | 'INDENT' {
    const parent = this.getParent(block) as BlockLike
    const listItem = this.getParent(parent) as BlockLike
    const list = this.getParent(listItem) as BlockLike
    const listParent = this.getParent(list)

    if (!this.isCollapse()) return false
    if (listParent && listParent.type === 'li') {
      return !list.preSibling ? 'REPLACEMENT' : 'INDENT'
    }

    return false
  }

  prototype.isIndentableListItem = function (): string | false | null {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key) as BlockLike
    const parent = this.getParent(startBlock)

    if (!parent || parent.type !== 'p' || !parent.parent) {
      return false
    }

    const listItem = this.getParent(parent) as BlockLike
    if (listItem.type !== 'li' || start.key !== end.key || start.offset !== end.offset) {
      return false
    }

    // Now we know it's a list item. Check whether we can indent the list item.
    const list = this.getParent(listItem)
    return list && /ol|ul/.test(list.type) && listItem.preSibling
  }

  prototype.unindentListItem = function (block: BlockLike, type: 'REPLACEMENT' | 'INDENT'): unknown {
    const pBlock = this.getParent(block) as BlockLike
    const listItem = this.getParent(pBlock) as BlockLike
    const list = this.getParent(listItem) as BlockLike
    const listParent = this.getParent(list) as BlockLike

    if (type === 'REPLACEMENT') {
      this.insertBefore(pBlock, list)
      if (this.isOnlyChild(listItem)) {
        this.removeBlock(list)
      } else {
        this.removeBlock(listItem)
      }
    } else if (type === 'INDENT') {
      if (list.children.length === 1) {
        this.removeBlock(list)
      } else {
        const newList = this.createBlock(list.type)
        let target = this.getNextSibling(listItem)
        while (target) {
          this.appendChild(newList, target)
          const temp = target
          target = this.getNextSibling(target)
          this.removeBlock(temp, list)
        }

        if (newList.children.length) this.appendChild(listItem, newList)
        this.removeBlock(listItem, list)
        if (!list.children.length) {
          this.removeBlock(list)
        }
      }
      this.insertAfter(listItem, listParent)
      let target = this.getNextSibling(list)
      while (target) {
        this.appendChild(listItem, target)
        this.removeBlock(target, listParent)
        target = this.getNextSibling(target)
      }
    }

    return this.partialRender()
  }

  prototype.indentListItem = function (): unknown {
    const { start } = this.cursor
    const startBlock = this.getBlock(start.key) as BlockLike
    const parent = this.getParent(startBlock) as BlockLike
    const listItem = this.getParent(parent) as BlockLike
    const list = this.getParent(listItem) as BlockLike
    const prevListItem = this.getPreSibling(listItem) as BlockLike

    this.removeBlock(listItem)

    // Search for a list in previous block
    let newList = this.getLastChild(prevListItem)
    if (!newList || !/ol|ul/.test(newList.type)) {
      newList = this.createBlock(list.type)
      this.appendChild(prevListItem, newList)
    }

    // Update item type only if we insert into an existing list
    if (newList.children.length !== 0) {
      listItem.isLooseListItem = newList.children[0].isLooseListItem
    }

    this.appendChild(newList, listItem)
    return this.partialRender()
  }

  prototype.insertTab = function (): unknown {
    const tabSize = this.tabSize
    const tabCharacter = String.fromCharCode(160).repeat(tabSize)
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike

    if (start.key === end.key && start.offset === end.offset) {
      startBlock.text = startBlock.text.substring(0, start.offset) +
        tabCharacter + endBlock.text.substring(end.offset)
      const key = start.key
      const offset = start.offset + tabCharacter.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.partialRender()
    }
  }

  prototype.checkCursorAtEndFormat = function (text: string, offset: number): CursorAtEndFormatResult | null {
    const { labels } = this.stateRender
    const tokens = tokenizer(text, {
      hasBeginRules: false,
      labels,
      options: this.muya.options
    }) as ParserToken[]
    let result: CursorAtEndFormatResult | null = null

    const walkTokens = (tkns: ParserToken[]): void => {
      for (const token of tkns) {
        const {
          marker,
          type,
          range,
          children,
          srcAndTitle,
          hrefAndTitle,
          backlash,
          closeTag,
          isFullLink,
          label
        } = token
        const { start, end } = range

        if ((BOTH_SIDES_FORMATS as readonly string[]).includes(type) && offset > start && offset < end) {
          switch (type) {
            case 'strong':
            case 'em':
            case 'inline_code':
            case 'emoji':
            case 'del':
            case 'inline_math': {
              if (marker && offset === end - marker.length) {
                result = {
                  offset: marker.length
                }
                return
              }
              break
            }
            case 'image':
            case 'link': {
              const linkTitleLen = (srcAndTitle || hrefAndTitle || '').length
              const secondLashLen = hasBacklashPair(backlash) ? backlash.second.length : 0
              if (offset === end - 3 - (linkTitleLen + secondLashLen)) {
                result = {
                  offset: 2
                }
                return
              } else if (offset === end - 1) {
                result = {
                  offset: 1
                }
                return
              }
              break
            }
            case 'reference_image':
            case 'reference_link': {
              const labelLen = label ? label.length : 0
              const secondLashLen = hasBacklashPair(backlash) ? backlash.second.length : 0
              if (isFullLink) {
                if (offset === end - 3 - labelLen - secondLashLen) {
                  result = {
                    offset: 2
                  }
                  return
                } else if (offset === end - 1) {
                  result = {
                    offset: 1
                  }
                  return
                }
              } else if (offset === end - 1) {
                result = {
                  offset: 1
                }
                return
              }
              break
            }
            case 'html_tag': {
              if (closeTag && offset === end - closeTag.length) {
                result = {
                  offset: closeTag.length
                }
                return
              }
              break
            }
            default:
              break
          }
        }

        if (Array.isArray(children) && children.length) {
          walkTokens(children)
        }
      }
    }

    walkTokens(tokens)

    return result
  }

  prototype.tabHandler = function (event: KeyboardEvent): unknown {
    // disable tab focus
    event.preventDefault()

    const { start, end } = selectionApi.getCursorRange()
    if (!start || !end) {
      return
    }

    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)

    if (!startBlock || !endBlock) {
      return
    }

    if (event.shiftKey && startBlock.functionType !== 'cellContent') {
      const unindentType = this.isUnindentableListItem(startBlock)
      if (unindentType) {
        this.unindentListItem(startBlock, unindentType)
      }
      return
    }

    // Handle `tab` to jump to the end of format when the cursor is at the end of format content.
    if (
      start.key === end.key &&
      start.offset === end.offset &&
      textBlockReg.test(startBlock.type) &&
      startBlock.functionType !== 'codeContent' && // code content has no inline syntax
      startBlock.functionType !== 'languageInput' // language input textarea has no inline syntax
    ) {
      const { text, key } = startBlock
      const { offset } = start
      const atEnd = this.checkCursorAtEndFormat(text, offset)
      if (atEnd) {
        this.cursor = {
          start: { key, offset: offset + atEnd.offset },
          end: { key, offset: offset + atEnd.offset }
        }
        return this.partialRender()
      }
    }

    // Auto-complete of inline html tag and html block and `html` code block.
    if (
      start.key === end.key &&
      start.offset === end.offset &&
      startBlock.type === 'span' &&
      (
        !startBlock.functionType ||
        (startBlock.functionType === 'codeContent' && /markup|html|xml|svg|mathml/.test(startBlock.lang || ''))
      )
    ) {
      const { text } = startBlock
      const lastWordBeforeCursor = text.substring(0, start.offset).split(/\s+/).pop() || ''
      const { tag, isVoid, id, className } = parseSelector(lastWordBeforeCursor)

      if (tag) {
        const preText = text.substring(0, start.offset - lastWordBeforeCursor.length)
        const postText = text.substring(end.offset)
        let html = `<${tag}`
        const key = startBlock.key
        let startOffset = 0
        let endOffset = 0

        switch (tag) {
          case 'img':
            html += ' alt="" src=""'
            startOffset = endOffset = html.length - 1
            break
          case 'input':
            html += ' type="text"'
            startOffset = html.length - 5
            endOffset = html.length - 1
            break
          case 'a':
            html += ' href=""'
            startOffset = endOffset = html.length - 1
            break
          case 'link':
            html += ' rel="stylesheet" href=""'
            startOffset = endOffset = html.length - 1
            break
        }

        if (id) {
          html += ` id="${id}"`
        }
        if (className) {
          html += ` class="${className}"`
        }
        html += '>'
        if (startOffset === 0 && endOffset === 0) {
          startOffset = endOffset = html.length
        }
        if (!isVoid) {
          html += `</${tag}>`
        }
        startBlock.text = preText + html + postText
        this.cursor = {
          start: { key, offset: startOffset + preText.length },
          end: { key, offset: endOffset + preText.length }
        }
        return this.partialRender()
      }
    }

    // Handle `tab` key in table cell.
    let nextCell: BlockLike | false | undefined | null
    if (start.key === end.key && startBlock.functionType === 'cellContent') {
      nextCell = event.shiftKey
        ? this.findPreviousCell(startBlock)
        : this.findNextCell(startBlock)
    } else if (endBlock.functionType === 'cellContent') {
      nextCell = endBlock
    } else {
      nextCell = null
    }

    if (nextCell) {
      const { key } = nextCell
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      const figure = this.closest(nextCell, 'figure') as BlockLike
      return this.singleRender(figure)
    }

    if (this.isIndentableListItem()) {
      return this.indentListItem()
    }
    return this.insertTab()
  }
}

export default tabCtrl
