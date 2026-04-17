import selection from '../selection'
import { getTextContent } from '../selection/dom'
import { beginRules } from '../parser/rules'
import { tokenizer } from '../parser'
import { CLASS_OR_ID } from '../config'

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
  range: RangeLike
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
  lang?: string
  [key: string]: unknown
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
  [key: string]: unknown
}

interface EventCenterLike {
  dispatch(...args: unknown[]): unknown
}

interface MuyaOptions {
  autoPairBracket?: boolean
  autoPairMarkdownSyntax?: boolean
  autoPairQuote?: boolean
  [key: string]: unknown
}

interface MuyaLike {
  options: MuyaOptions
  eventCenter: EventCenterLike
}

interface SelectionLike {
  getCursorRange(): CursorRangeLike
}

interface ContentStateLike {
  blocks: BlockLike[]
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  muya: MuyaLike
  getBlock(key: string | null | undefined): BlockLike | null
  getParent(block: BlockLike | null | undefined): BlockLike | null
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  removeBlocks(before: BlockLike, after: BlockLike, isRemoveAfter?: boolean, isRecursion?: boolean): void
  removeBlock(block: BlockLike): void
  findOutMostBlock(block: BlockLike): BlockLike
  getPositionReference(): PositionReferenceLike
  singleRender(block: BlockLike): void
  partialRender(): void
  render(): void
  checkNeedRender(): boolean
  checkInlineUpdate(block: BlockLike): BlockLike | null | false
  isCollapse(): boolean
}

interface InputHandlerEventLike {
  type: string
  inputType: string
  data: string
  preventDefault(): void
}

interface InputCtrlMethods {
  checkQuickInsert(block: BlockLike): boolean
  checkCursorInTokenType(functionType: string | undefined, text: string, offset: number, type: string): boolean
  checkNotSameToken(functionType: string | undefined, oldText: string, text: string): boolean
  inputHandler(event: InputHandlerEventLike, notEqual?: boolean): void
}

type ContentStateConstructor = {
  prototype: unknown
}

type BeginRulesLike = {
  reference_definition: RegExp
}

const BRACKET_HASH: Record<string, string> = {
  '{': '}',
  '[': ']',
  '(': ')',
  '*': '*',
  _: '_',
  '"': '"',
  '\'': '\'',
  $: '$',
  '~': '~'
}

const BACK_HASH: Record<string, string> = {
  '}': '{',
  ']': '[',
  ')': '(',
  '*': '*',
  _: '_',
  '"': '"',
  '\'': '\'',
  $: '$',
  '~': '~'
}

const selectionApi = selection as unknown as SelectionLike
const beginRuleSet = beginRules as BeginRulesLike

// TODO: refactor later.
let renderCodeBlockTimer: ReturnType<typeof setTimeout> | null = null

const inputCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & InputCtrlMethods

  // Input @ to quick insert paragraph
  prototype.checkQuickInsert = function (block: BlockLike): boolean {
    const { type, text, functionType } = block
    if (type !== 'span' || functionType !== 'paragraphContent') return false
    return /^@\S*$/.test(text)
  }

  prototype.checkCursorInTokenType = function (
    functionType: string | undefined,
    text: string,
    offset: number,
    type: string
  ): boolean {
    if (!/atxLine|paragraphContent|cellContent/.test(functionType || '')) {
      return false
    }

    const tokens = tokenizer(text, {
      hasBeginRules: false,
      options: this.muya.options
    }) as TokenLike[]
    return tokens.filter(t => t.type === type).some(t => offset >= t.range.start && offset <= t.range.end)
  }

  prototype.checkNotSameToken = function (
    functionType: string | undefined,
    oldText: string,
    text: string
  ): boolean {
    if (!/atxLine|paragraphContent|cellContent/.test(functionType || '')) {
      return false
    }

    const oldTokens = tokenizer(oldText, {
      options: this.muya.options
    }) as TokenLike[]
    const tokens = tokenizer(text, {
      options: this.muya.options
    }) as TokenLike[]

    const oldCache: Record<string, number> = {}
    const cache: Record<string, number> = {}

    for (const { type } of oldTokens) {
      if (oldCache[type]) {
        oldCache[type]++
      } else {
        oldCache[type] = 1
      }
    }

    for (const { type } of tokens) {
      if (cache[type]) {
        cache[type]++
      } else {
        cache[type] = 1
      }
    }

    if (Object.keys(oldCache).length !== Object.keys(cache).length) {
      return true
    }

    for (const key of Object.keys(oldCache)) {
      if (!cache[key] || oldCache[key] !== cache[key]) {
        return true
      }
    }

    return false
  }

  prototype.inputHandler = function (event: InputHandlerEventLike, notEqual = false): void {
    const { start, end } = selectionApi.getCursorRange()
    if (!start || !end) {
      return
    }

    const { start: oldStart, end: oldEnd } = this.cursor
    const key = start.key
    const block = this.getBlock(key) as BlockLike
    const paragraph = document.querySelector<HTMLElement>(`#${key}`) as HTMLElement

    // Fix issue 1447
    // Fixme: any better solution?
    if (
      oldStart.key === oldEnd.key &&
      oldStart.offset === oldEnd.offset &&
      block.text.endsWith('\n') &&
      oldStart.offset === block.text.length &&
      event.inputType === 'insertText'
    ) {
      event.preventDefault()
      block.text += event.data
      const offset = block.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.singleRender(block)
      return this.inputHandler(event, true)
    }

    let text = getTextContent(paragraph, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER])

    let needRender = false
    let needRenderAll = false
    if (oldStart.key !== oldEnd.key) {
      const startBlock = this.getBlock(oldStart.key) as BlockLike
      const startOutmostBlock = this.findOutMostBlock(startBlock)
      const endBlock = this.getBlock(oldEnd.key) as BlockLike
      const endOutmostBlock = this.findOutMostBlock(endBlock)
      if (startBlock.functionType === 'languageInput') {
        // fix #918.
        if (startOutmostBlock === endOutmostBlock && !endBlock.nextSibling) {
          this.removeBlocks(startBlock, endBlock, false)
          endBlock.text = ''
        } else if (startOutmostBlock !== endOutmostBlock) {
          const preBlock = this.getParent(startBlock) as BlockLike
          const pBlock = this.createBlock('p')
          this.removeBlocks(startBlock, endBlock)
          startBlock.functionType = 'paragraphContent'
          this.appendChild(pBlock, startBlock)
          this.insertBefore(pBlock, preBlock)
          this.removeBlock(preBlock)
        } else {
          this.removeBlocks(startBlock, endBlock)
        }
      } else if (
        startBlock.functionType === 'paragraphContent' &&
        start.key === end.key &&
        oldStart.key === start.key &&
        oldEnd.key !== end.key
      ) {
        // GH#2269: The end block will lose all soft-lines when removing multiple paragraphs and `oldEnd`
        //          includes soft-line breaks. The normal text from `oldEnd` is moved into the `start`
        //          block but the remaining soft-lines (separated by \n) not. We have to append the
        //          remaining text (soft-lines) to the new start block.
        const matchBreak = /(?<=.)\n./.exec(endBlock.text)
        if (matchBreak && matchBreak.index > 0) {
          // Skip if end block is fully selected and the cursor is in the next line (e.g. via keyboard).
          const lineOffset = matchBreak.index
          if (oldEnd.offset <= lineOffset) {
            text += endBlock.text.substring(lineOffset)
          }
        }
        this.removeBlocks(startBlock, endBlock)
      } else {
        this.removeBlocks(startBlock, endBlock)
      }
      if (this.blocks.length === 1) {
        needRenderAll = true
      }
      needRender = true
    }

    // auto pair (not need to auto pair in math block)
    if (block && (block.text !== text || notEqual)) {
      if (
        start.key === end.key &&
        start.offset === end.offset &&
        event.type === 'input'
      ) {
        const { offset } = start
        const { autoPairBracket, autoPairMarkdownSyntax, autoPairQuote } = this.muya.options
        const inputChar = text.charAt(+offset - 1)
        const preInputChar = text.charAt(+offset - 2)
        const prePreInputChar = text.charAt(+offset - 3)
        const postInputChar = text.charAt(+offset)

        if (/^delete/.test(event.inputType)) {
          // handle `deleteContentBackward` or `deleteContentForward`
          const deletedChar = block.text[offset]
          if (event.inputType === 'deleteContentBackward' && postInputChar === BRACKET_HASH[deletedChar]) {
            needRender = true
            text = text.substring(0, offset) + text.substring(offset + 1)
          }
          if (event.inputType === 'deleteContentForward' && inputChar === BACK_HASH[deletedChar]) {
            needRender = true
            start.offset -= 1
            end.offset -= 1
            text = text.substring(0, offset - 1) + text.substring(offset)
          }
          /* eslint-disable no-useless-escape */
        } else if (
          (event.inputType.indexOf('delete') === -1) &&
          (inputChar === postInputChar) &&
          (
            (autoPairQuote && /[']{1}/.test(inputChar)) ||
            (autoPairQuote && /["]{1}/.test(inputChar)) ||
            (autoPairBracket && /[\}\]\)]{1}/.test(inputChar)) ||
            (autoPairMarkdownSyntax && /[$]{1}/.test(inputChar)) ||
            (autoPairMarkdownSyntax && /[*$`~_]{1}/.test(inputChar)) && /[_*~]{1}/.test(prePreInputChar)
          )
        ) {
          needRender = true
          text = text.substring(0, offset) + text.substring(offset + 1)
        } else {
          /* eslint-disable no-useless-escape */
          // Not Unicode aware, since things like \p{Alphabetic} or \p{L} are not supported yet
          const isInInlineMath = this.checkCursorInTokenType(block.functionType, text, offset, 'inline_math')
          const isInInlineCode = this.checkCursorInTokenType(block.functionType, text, offset, 'inline_code')
          if (
            // Issue 2566: Do not complete markdown syntax if the previous character is
            // alphanumeric.
            !/\\/.test(preInputChar) &&
            ((autoPairQuote && /[']{1}/.test(inputChar) && !(/[\S]{1}/.test(postInputChar)) && !(/[a-zA-Z\d]{1}/.test(preInputChar))) ||
              (autoPairQuote && /["]{1}/.test(inputChar) && !(/[\S]{1}/.test(postInputChar))) ||
              (autoPairBracket && /[\{\[\(]{1}/.test(inputChar) && !(/[\S]{1}/.test(postInputChar))) ||
              (block.functionType !== 'codeContent' && !isInInlineMath && !isInInlineCode && autoPairMarkdownSyntax && !/[a-z0-9]{1}/i.test(preInputChar) && /[*$`~_]{1}/.test(inputChar)))
          ) {
            needRender = true
            text = BRACKET_HASH[event.data]
              ? text.substring(0, offset) + BRACKET_HASH[inputChar] + text.substring(offset)
              : text
          }
          /* eslint-enable no-useless-escape */
          // Delete the last `*` of `**` when you insert one space between `**` to create a bullet list.
          if (
            /\s/.test(event.data) &&
            /^\* /.test(text) &&
            preInputChar === '*' &&
            postInputChar === '*'
          ) {
            text = text.substring(0, offset) + text.substring(offset + 1)
            needRender = true
          }
        }
      }

      if (this.checkNotSameToken(block.functionType, block.text, text)) {
        needRender = true
      }

      // Just work for `Shift + Enter` to create a soft and hard line break.
      if (
        block.text.endsWith('\n') &&
        start.offset === text.length &&
        (event.inputType === 'insertText' || event.type === 'compositionend')
      ) {
        block.text += event.data
        start.offset++
        end.offset++
      } else if (
        block.text.length === oldStart.offset &&
        block.text[oldStart.offset - 2] === '\n' &&
        event.inputType === 'deleteContentBackward'
      ) {
        block.text = block.text.substring(0, oldStart.offset - 1)
        start.offset = block.text.length
        end.offset = block.text.length
      } else {
        block.text = text
      }

      // Update code block language when modify code block identifer
      if (block.functionType === 'languageInput') {
        const parent = this.getParent(block) as BlockLike
        parent.lang = block.text
      }

      if (beginRuleSet.reference_definition.test(text)) {
        needRenderAll = true
      }
    }

    // show quick insert
    const rect = paragraph.getBoundingClientRect()
    const checkQuickInsert = this.checkQuickInsert(block)
    const reference = this.getPositionReference()
    reference.getBoundingClientRect = function () {
      const { x, y, left, top, height, bottom } = rect

      return Object.assign({}, {
        left,
        x,
        top,
        y,
        bottom,
        height,
        width: 0,
        right: left
      })
    }

    this.muya.eventCenter.dispatch('muya-quick-insert', reference, block, !!checkQuickInsert)

    this.cursor = { start, end }

    // Throttle render if edit in code block.
    if (block && block.type === 'span' && block.functionType === 'codeContent') {
      if (renderCodeBlockTimer) {
        clearTimeout(renderCodeBlockTimer)
      }
      if (needRender) {
        this.partialRender()
      } else {
        renderCodeBlockTimer = setTimeout(() => {
          this.partialRender()
        }, 300)
      }
      return
    }

    const checkMarkedUpdate = /atxLine|paragraphContent|cellContent/.test(block.functionType || '')
      ? this.checkNeedRender()
      : false
    let inlineUpdatedBlock: BlockLike | null | false = null
    if (/atxLine|paragraphContent|cellContent|thematicBreakLine/.test(block.functionType || '')) {
      inlineUpdatedBlock = this.isCollapse() && this.checkInlineUpdate(block)
    }

    // just for fix #707,need render All if in combines pre list and next list into one list.
    if (inlineUpdatedBlock) {
      const liBlock = this.getParent(inlineUpdatedBlock)
      if (liBlock && liBlock.type === 'li' && liBlock.preSibling && liBlock.nextSibling) {
        needRenderAll = true
      }
    }

    if (checkMarkedUpdate || inlineUpdatedBlock || needRender) {
      return needRenderAll ? this.render() : this.partialRender()
    }
  }
}

export default inputCtrl
