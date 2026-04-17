import { tokenizer } from '../parser'
import { conflict } from '../utils'

const INLINE_UPDATE_FRAGMENTS = [
  '(?:^|\n) {0,3}([*+-] {1,4})', // Bullet list
  '(?:^|\n)(\\[[x ]{1}\\] {1,4})', // Task list
  '(?:^|\n) {0,3}(\\d{1,9}(?:\\.|\\)) {1,4})', // Order list
  '(?:^|\n) {0,3}(#{1,6})(?=\\s{1,}|$)', // ATX headings
  '^(?:[\\s\\S]+?)\\n {0,3}(\\={3,}|\\-{3,})(?= {1,}|$)', // Setext headings **match from beginning**
  '(?:^|\n) {0,3}(>).+', // Block quote
  '^( {4,})', // Indent code **match from beginning**
  '^(\\[\\^[^\\^\\[\\]\\s]+?(?<!\\\\)\\]: )', // Footnote **match from beginning**
  '(?:^|\n) {0,3}((?:\\* *\\* *\\*|- *- *-|_ *_ *_)[ \\*\\-\\_]*)$' // Thematic break
]

const INLINE_UPDATE_REG = new RegExp(INLINE_UPDATE_FRAGMENTS.join('|'), 'i')

interface RangeLike {
  start: number
  end: number
}

interface TokenLike {
  type: string
  range: RangeLike
}

interface CursorPosition {
  key: string
  offset: number
}

interface CursorLike {
  anchor?: CursorPosition
  focus?: CursorPosition
  start?: CursorPosition
  end?: CursorPosition
  noHistory?: boolean
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
  listType?: string
  listItemType?: string
  bulletMarkerOrDelimiter?: string
  isLooseListItem?: boolean
  headingStyle?: string
  marker?: string
  checked?: boolean
  start?: string | number
  lang?: string
  [key: string]: unknown
}

interface MuyaLike {
  options: {
    preferLooseListItem?: boolean
    bulletListMarker?: string
    footnote?: boolean
    [key: string]: unknown
  }
}

interface StateRenderLike {
  labels: Map<string, unknown>
}

interface ContentStateLike {
  cursor: CursorLike & {
    start: CursorPosition
    end: CursorPosition
  }
  stateRender: StateRenderLike
  muya: MuyaLike
  getBlock(key: string | null | undefined): BlockLike | null
  getParent(block: BlockLike | null | undefined): BlockLike | null
  getPreSibling(block: BlockLike): BlockLike | null
  getNextSibling(block: BlockLike): BlockLike | null
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  createBlockP(text?: string): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  removeBlock(block: BlockLike): void
  isOnlyChild(block: BlockLike): boolean
  isFirstChild(block: BlockLike): boolean
  isLastChild(block: BlockLike): boolean
  updateFootnote(block: BlockLike, line: BlockLike): BlockLike
}

interface UpdateCtrlMethods {
  checkSameMarkerOrDelimiter(list: BlockLike, markerOrDelimiter?: string): boolean
  checkNeedRender(cursor?: CursorLike): boolean
  checkInlineUpdate(block: BlockLike): BlockLike | null | false
  updateThematicBreak(block: BlockLike, marker: string, line: BlockLike): BlockLike | null
  updateList(block: BlockLike, type: string, marker: string | undefined, line: BlockLike): BlockLike
  updateTaskListItem(block: BlockLike, type: string, marker?: string): BlockLike
  updateAtxHeader(block: BlockLike, header: string, line: BlockLike): BlockLike | null
  updateSetextHeader(block: BlockLike, marker: string, line: BlockLike): BlockLike | null
  updateBlockQuote(block: BlockLike, line: BlockLike): BlockLike
  updateIndentCode(block: BlockLike, line?: BlockLike): BlockLike
  updateToParagraph(block: BlockLike | null, line: BlockLike): BlockLike | null
}

type ContentStateConstructor = {
  prototype: unknown
}

const updateCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & UpdateCtrlMethods

  prototype.checkSameMarkerOrDelimiter = function (list: BlockLike, markerOrDelimiter?: string): boolean {
    if (!/ol|ul/.test(list.type)) return false
    return list.children[0].bulletMarkerOrDelimiter === markerOrDelimiter
  }

  prototype.checkNeedRender = function (cursor?: CursorLike): boolean {
    const activeCursor = cursor || this.cursor
    const { labels } = this.stateRender
    const { start: cStart, end: cEnd, anchor, focus } = activeCursor
    const startPosition = cStart || (anchor as CursorPosition)
    const endPosition = cEnd || (focus as CursorPosition)
    const startBlock = this.getBlock(startPosition.key) as BlockLike
    const endBlock = this.getBlock(endPosition.key) as BlockLike
    const startOffset = startPosition.offset
    const endOffset = endPosition.offset
    const NO_NEED_TOKEN_REG = /text|hard_line_break|soft_line_break/

    for (const token of tokenizer(startBlock.text, {
      labels,
      options: this.muya.options
    }) as TokenLike[]) {
      if (NO_NEED_TOKEN_REG.test(token.type)) continue
      const { start, end } = token.range
      const textLen = startBlock.text.length
      if (
        conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [startOffset, startOffset])
      ) {
        return true
      }
    }

    for (const token of tokenizer(endBlock.text, {
      labels,
      options: this.muya.options
    }) as TokenLike[]) {
      if (NO_NEED_TOKEN_REG.test(token.type)) continue
      const { start, end } = token.range
      const textLen = endBlock.text.length
      if (
        conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [endOffset, endOffset])
      ) {
        return true
      }
    }

    return false
  }

  /**
   * block must be span block.
   */
  prototype.checkInlineUpdate = function (block: BlockLike): BlockLike | null | false {
    // table cell can not have blocks in it
    if (/figure/.test(block.type)) {
      return false
    }
    if (/cellContent|codeContent|languageInput|footnoteInput/.test(block.functionType || '')) {
      return false
    }

    let line: BlockLike | null = null
    const { text } = block
    if (block.type === 'span') {
      line = block
      block = this.getParent(block) as BlockLike
    }
    const listItem = this.getParent(block)
    const [
      match, bullet, tasklist, order, atxHeader,
      setextHeader, blockquote, indentCode, footnote, hr
    ] = text.match(INLINE_UPDATE_REG) || []
    const { footnote: isSupportFootnote } = this.muya.options

    switch (true) {
      case (!!hr && new Set(hr.split('').filter(char => /\S/.test(char))).size === 1):
        return this.updateThematicBreak(block, hr, line as BlockLike)

      case !!bullet:
        return this.updateList(block, 'bullet', bullet, line as BlockLike)

      // only `bullet` list item can be update to `task` list item
      case !!tasklist && !!listItem && listItem.listItemType === 'bullet':
        return this.updateTaskListItem(block, 'tasklist', tasklist)

      case !!order:
        return this.updateList(block, 'order', order, line as BlockLike)

      case !!atxHeader:
        return this.updateAtxHeader(block, atxHeader, line as BlockLike)

      case !!setextHeader:
        return this.updateSetextHeader(block, setextHeader, line as BlockLike)

      case !!blockquote:
        return this.updateBlockQuote(block, line as BlockLike)

      case !!indentCode:
        return this.updateIndentCode(block, line as BlockLike)

      case !!footnote && block.type === 'p' && !block.parent && !!isSupportFootnote:
        return this.updateFootnote(block, line as BlockLike)

      case !match:
      default:
        return this.updateToParagraph(block, line as BlockLike)
    }
  }

  // Thematic break
  prototype.updateThematicBreak = function (block: BlockLike, _marker: string, line: BlockLike): BlockLike | null {
    // If the block is already thematic break, no need to update.
    if (block.type === 'hr') return null
    const text = line.text
    const lines = text.split('\n')
    const preParagraphLines: string[] = []
    let thematicLine = ''
    const postParagraphLines: string[] = []
    let thematicLineHasPushed = false
    for (const currentLine of lines) {
      /* eslint-disable no-useless-escape */
      if (/ {0,3}(?:\* *\* *\*|- *- *-|_ *_ *_)[ \*\-\_]*$/.test(currentLine) && !thematicLineHasPushed) {
        /* eslint-enable no-useless-escape */
        thematicLine = currentLine
        thematicLineHasPushed = true
      } else if (!thematicLineHasPushed) {
        preParagraphLines.push(currentLine)
      } else {
        postParagraphLines.push(currentLine)
      }
    }

    const thematicBlock = this.createBlock('hr')
    const thematicLineBlock = this.createBlock('span', {
      text: thematicLine,
      functionType: 'thematicBreakLine'
    })
    this.appendChild(thematicBlock, thematicLineBlock)
    this.insertBefore(thematicBlock, block)
    if (preParagraphLines.length) {
      const preBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preBlock, thematicBlock)
    }
    if (postParagraphLines.length) {
      const postBlock = this.createBlockP(postParagraphLines.join('\n'))
      this.insertAfter(postBlock, thematicBlock)
    }

    this.removeBlock(block)
    const { start, end } = this.cursor
    const key = thematicBlock.children[0].key
    const preParagraphLength = preParagraphLines.reduce((acc, item) => acc + item.length + 1, 0) // Add one, because the `\n`
    const startOffset = start.offset - preParagraphLength
    const endOffset = end.offset - preParagraphLength
    this.cursor = {
      start: { key, offset: startOffset },
      end: { key, offset: endOffset }
    }
    return thematicBlock
  }

  prototype.updateList = function (block: BlockLike, type: string, marker = '', line: BlockLike): BlockLike {
    const cleanMarker = marker ? marker.trim() : null
    const { preferLooseListItem } = this.muya.options
    const wrapperTag = type === 'order' ? 'ol' : 'ul' // `bullet` => `ul` and `order` => `ol`
    const { start, end } = this.cursor
    const startOffset = start.offset
    const endOffset = end.offset
    const newListItemBlock = this.createBlock('li')
    const LIST_ITEM_REG = /^ {0,3}(?:[*+-]|\d{1,9}(?:\.|\))) {0,4}/
    const text = line.text
    const lines = text.split('\n')

    const preParagraphLines: string[] = []
    let listItemLines: string[] = []
    let isPushedListItemLine = false
    if (marker) {
      for (const currentLine of lines) {
        if (LIST_ITEM_REG.test(currentLine) && !isPushedListItemLine) {
          listItemLines.push(currentLine.replace(LIST_ITEM_REG, ''))
          isPushedListItemLine = true
        } else if (!isPushedListItemLine) {
          preParagraphLines.push(currentLine)
        } else {
          listItemLines.push(currentLine)
        }
      }
    } else {
      // From front menu click.
      listItemLines = lines
    }

    const pBlock = this.createBlockP(listItemLines.join('\n'))
    this.insertBefore(pBlock, block)

    if (preParagraphLines.length > 0) {
      const preParagraphBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preParagraphBlock, pBlock)
    }

    this.removeBlock(block)

    // important!
    block = pBlock

    const preSibling = this.getPreSibling(block)
    const nextSibling = this.getNextSibling(block)
    newListItemBlock.listItemType = type
    newListItemBlock.isLooseListItem = preferLooseListItem

    let bulletMarkerOrDelimiter: string | undefined
    if (type === 'order') {
      bulletMarkerOrDelimiter = (cleanMarker && cleanMarker.length >= 2) ? cleanMarker.slice(-1) : '.'
    } else {
      const { bulletListMarker } = this.muya.options
      bulletMarkerOrDelimiter = marker ? marker.charAt(0) : bulletListMarker
    }
    newListItemBlock.bulletMarkerOrDelimiter = bulletMarkerOrDelimiter

    // Special cases for CommonMark 264 and 265: Changing the bullet or ordered list delimiter starts a new list.
    // Same list type or new list
    if (
      preSibling &&
      this.checkSameMarkerOrDelimiter(preSibling, bulletMarkerOrDelimiter) &&
      nextSibling &&
      this.checkSameMarkerOrDelimiter(nextSibling, bulletMarkerOrDelimiter)
    ) {
      this.appendChild(preSibling, newListItemBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(child => this.appendChild(preSibling, child))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
      const isLooseListItem = preSibling.children.some(child => child.isLooseListItem)
      preSibling.children.forEach(child => {
        child.isLooseListItem = isLooseListItem
      })
    } else if (
      preSibling &&
      this.checkSameMarkerOrDelimiter(preSibling, bulletMarkerOrDelimiter)
    ) {
      this.appendChild(preSibling, newListItemBlock)
      this.removeBlock(block)
      const isLooseListItem = preSibling.children.some(child => child.isLooseListItem)
      preSibling.children.forEach(child => {
        child.isLooseListItem = isLooseListItem
      })
    } else if (
      nextSibling &&
      this.checkSameMarkerOrDelimiter(nextSibling, bulletMarkerOrDelimiter)
    ) {
      this.insertBefore(newListItemBlock, nextSibling.children[0])
      this.removeBlock(block)
      const isLooseListItem = nextSibling.children.some(child => child.isLooseListItem)
      nextSibling.children.forEach(child => {
        child.isLooseListItem = isLooseListItem
      })
    } else {
      // Create a new list when changing list type, bullet or list delimiter
      const listBlock = this.createBlock(wrapperTag, {
        listType: type
      })

      if (wrapperTag === 'ol') {
        const orderedListStart = cleanMarker ? cleanMarker.slice(0, -1) : 1
        listBlock.start = /^\d+$/.test(String(orderedListStart)) ? orderedListStart : 1
      }

      this.appendChild(listBlock, newListItemBlock)
      this.insertBefore(listBlock, block)
      this.removeBlock(block)
    }

    // key point
    this.appendChild(newListItemBlock, block)
    const TASK_LIST_REG = /^\[[x ]\] {1,4}/i
    const listItemText = block.children[0].text
    const { key } = block.children[0]
    const delta = marker.length + preParagraphLines.join('\n').length + 1
    this.cursor = {
      start: {
        key,
        offset: Math.max(0, startOffset - delta)
      },
      end: {
        key,
        offset: Math.max(0, endOffset - delta)
      }
    }
    if (TASK_LIST_REG.test(listItemText)) {
      const [, , tasklist] = listItemText.match(INLINE_UPDATE_REG) || []
      return this.updateTaskListItem(block, 'tasklist', tasklist)
    } else {
      return block
    }
  }

  prototype.updateTaskListItem = function (block: BlockLike, _type: string, marker = ''): BlockLike {
    const { preferLooseListItem } = this.muya.options
    const parent = this.getParent(block) as BlockLike
    const grandpa = this.getParent(parent) as BlockLike
    const checked = /\[x\]\s/i.test(marker) // use `i` flag to ignore upper case or lower case
    const checkbox = this.createBlock('input', {
      checked
    })
    const { start, end } = this.cursor

    this.insertBefore(checkbox, block)
    block.children[0].text = block.children[0].text.substring(marker.length)
    parent.listItemType = 'task'
    parent.isLooseListItem = preferLooseListItem

    let taskListWrapper: BlockLike | null = null
    if (this.isOnlyChild(parent)) {
      grandpa.listType = 'task'
    } else if (this.isFirstChild(parent) || this.isLastChild(parent)) {
      taskListWrapper = this.createBlock('ul', {
        listType: 'task'
      })

      this.isFirstChild(parent) ? this.insertBefore(taskListWrapper, grandpa) : this.insertAfter(taskListWrapper, grandpa)
      this.removeBlock(parent)
      this.appendChild(taskListWrapper, parent)
    } else {
      taskListWrapper = this.createBlock('ul', {
        listType: 'task'
      })

      const bulletListWrapper = this.createBlock('ul', {
        listType: 'bullet'
      })

      let preSibling = this.getPreSibling(parent)
      while (preSibling) {
        this.removeBlock(preSibling)
        if (bulletListWrapper.children.length) {
          const firstChild = bulletListWrapper.children[0]
          this.insertBefore(preSibling, firstChild)
        } else {
          this.appendChild(bulletListWrapper, preSibling)
        }
        preSibling = this.getPreSibling(preSibling)
      }

      this.removeBlock(parent)
      this.appendChild(taskListWrapper, parent)
      this.insertBefore(taskListWrapper, grandpa)
      this.insertBefore(bulletListWrapper, taskListWrapper)
    }

    this.cursor = {
      start: {
        key: start.key,
        offset: Math.max(0, start.offset - marker.length)
      },
      end: {
        key: end.key,
        offset: Math.max(0, end.offset - marker.length)
      }
    }
    return taskListWrapper || grandpa
  }

  // ATX heading doesn't support soft line break and hard line break.
  prototype.updateAtxHeader = function (block: BlockLike, header: string, line: BlockLike): BlockLike | null {
    const newType = `h${header.length}`
    const headingStyle = 'atx'
    if (block.type === newType && block.headingStyle === headingStyle) {
      return null
    }
    const text = line.text
    const lines = text.split('\n')
    const preParagraphLines: string[] = []
    let atxLine = ''
    const postParagraphLines: string[] = []
    let atxLineHasPushed = false

    for (const currentLine of lines) {
      if (/^ {0,3}#{1,6}(?=\s{1,}|$)/.test(currentLine) && !atxLineHasPushed) {
        atxLine = currentLine
        atxLineHasPushed = true
      } else if (!atxLineHasPushed) {
        preParagraphLines.push(currentLine)
      } else {
        postParagraphLines.push(currentLine)
      }
    }

    const atxBlock = this.createBlock(newType, {
      headingStyle
    })
    const atxLineBlock = this.createBlock('span', {
      text: atxLine,
      functionType: 'atxLine'
    })
    this.appendChild(atxBlock, atxLineBlock)
    this.insertBefore(atxBlock, block)
    if (preParagraphLines.length) {
      const preBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preBlock, atxBlock)
    }
    if (postParagraphLines.length) {
      const postBlock = this.createBlockP(postParagraphLines.join('\n'))
      this.insertAfter(postBlock, atxBlock)
    }

    this.removeBlock(block)

    const { start, end } = this.cursor
    const key = atxBlock.children[0].key
    this.cursor = {
      start: { key, offset: start.offset },
      end: { key, offset: end.offset }
    }
    return atxBlock
  }

  prototype.updateSetextHeader = function (block: BlockLike, marker: string, line: BlockLike): BlockLike | null {
    const newType = /=/.test(marker) ? 'h1' : 'h2'
    const headingStyle = 'setext'
    if (block.type === newType && block.headingStyle === headingStyle) {
      return null
    }

    const text = line.text
    const lines = text.split('\n')
    const setextLines: string[] = []
    const postParagraphLines: string[] = []
    let setextLineHasPushed = false

    for (const currentLine of lines) {
      if (/^ {0,3}(?:={3,}|-{3,})(?= {1,}|$)/.test(currentLine) && !setextLineHasPushed) {
        setextLineHasPushed = true
      } else if (!setextLineHasPushed) {
        setextLines.push(currentLine)
      } else {
        postParagraphLines.push(currentLine)
      }
    }

    const setextBlock = this.createBlock(newType, {
      headingStyle,
      marker
    })
    const setextLineBlock = this.createBlock('span', {
      text: setextLines.join('\n'),
      functionType: 'paragraphContent'
    })
    this.appendChild(setextBlock, setextLineBlock)
    this.insertBefore(setextBlock, block)

    if (postParagraphLines.length) {
      const postBlock = this.createBlockP(postParagraphLines.join('\n'))
      this.insertAfter(postBlock, setextBlock)
    }

    this.removeBlock(block)

    const key = setextBlock.children[0].key
    const offset = setextBlock.children[0].text.length

    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }

    return setextBlock
  }

  prototype.updateBlockQuote = function (block: BlockLike, line: BlockLike): BlockLike {
    const text = line.text
    const lines = text.split('\n')
    const preParagraphLines: string[] = []
    const quoteLines: string[] = []
    let quoteLinesHasPushed = false

    for (const currentLine of lines) {
      if (/^ {0,3}>/.test(currentLine) && !quoteLinesHasPushed) {
        quoteLinesHasPushed = true
        quoteLines.push(currentLine.trimStart().substring(1).trimStart())
      } else if (!quoteLinesHasPushed) {
        preParagraphLines.push(currentLine)
      } else {
        quoteLines.push(currentLine)
      }
    }
    let quoteParagraphBlock: BlockLike
    if (/^h\d/.test(block.type)) {
      quoteParagraphBlock = this.createBlock(block.type, {
        headingStyle: block.headingStyle
      })
      if (block.headingStyle === 'setext') {
        quoteParagraphBlock.marker = block.marker
      }
      const headerContent = this.createBlock('span', {
        text: quoteLines.join('\n'),
        functionType: block.headingStyle === 'setext' ? 'paragraphContent' : 'atxLine'
      })
      this.appendChild(quoteParagraphBlock, headerContent)
    } else {
      quoteParagraphBlock = this.createBlockP(quoteLines.join('\n'))
    }

    const quoteBlock = this.createBlock('blockquote')
    this.appendChild(quoteBlock, quoteParagraphBlock)
    this.insertBefore(quoteBlock, block)

    if (preParagraphLines.length) {
      const preParagraphBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preParagraphBlock, quoteBlock)
    }

    this.removeBlock(block)

    const key = quoteParagraphBlock.children[0].key
    const { start, end } = this.cursor

    this.cursor = {
      start: { key, offset: Math.max(0, start.offset - 1) },
      end: { key, offset: Math.max(0, end.offset - 1) }
    }
    return quoteBlock
  }

  prototype.updateIndentCode = function (block: BlockLike, line?: BlockLike): BlockLike {
    const lang = ''
    const codeBlock = this.createBlock('code', {
      lang
    })
    const inputBlock = this.createBlock('span', {
      functionType: 'languageInput'
    })
    const preBlock = this.createBlock('pre', {
      functionType: 'indentcode',
      lang
    })

    const text = line ? line.text : block.text

    const lines = text.split('\n')
    const codeLines: string[] = []
    const paragraphLines: string[] = []
    let canBeCodeLine = true

    for (const currentLine of lines) {
      if (/^ {4,}/.test(currentLine) && canBeCodeLine) {
        codeLines.push(currentLine.replace(/^ {4}/, ''))
      } else {
        canBeCodeLine = false
        paragraphLines.push(currentLine)
      }
    }
    const codeContent = this.createBlock('span', {
      text: codeLines.join('\n'),
      functionType: 'codeContent',
      lang
    })

    this.appendChild(codeBlock, codeContent)
    this.appendChild(preBlock, inputBlock)
    this.appendChild(preBlock, codeBlock)
    this.insertBefore(preBlock, block)

    if (paragraphLines.length > 0 && line) {
      const newLine = this.createBlock('span', {
        text: paragraphLines.join('\n')
      })
      this.insertBefore(newLine, line)
      this.removeBlock(line)
    } else {
      this.removeBlock(block)
    }

    const key = codeBlock.children[0].key
    const { start, end } = this.cursor
    this.cursor = {
      start: { key, offset: start.offset - 4 },
      end: { key, offset: end.offset - 4 }
    }
    return preBlock
  }

  prototype.updateToParagraph = function (block: BlockLike | null, line: BlockLike): BlockLike | null {
    const targetBlock = block as BlockLike
    if (/^h\d$/.test(targetBlock.type) && targetBlock.headingStyle === 'setext') {
      return null
    }

    const newType = 'p'
    if (targetBlock.type !== newType) {
      const newBlock = this.createBlockP(line.text)
      this.insertBefore(newBlock, targetBlock)
      this.removeBlock(targetBlock)
      const { start, end } = this.cursor
      const key = newBlock.children[0].key
      this.cursor = {
        start: { key, offset: start.offset },
        end: { key, offset: end.offset }
      }
      return targetBlock
    }
    return null
  }
}

export default updateCtrl
