/* eslint-disable no-useless-escape */
const FOOTNOTE_REG = /^\[\^([^\^\[\]\s]+?)(?<!\\)\]: /
/* eslint-enable no-useless-escape */

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  start: CursorPosition
  end: CursorPosition
}

interface BlockLike {
  key: string
  text: string
  children: BlockLike[]
  functionType?: string
  [key: string]: unknown
}

interface ContentStateLike {
  blocks: BlockLike[]
  cursor: CursorRangeLike
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  createBlockP(text?: string): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  removeBlock(block: BlockLike): void
  updateFootnote(block: BlockLike, line: BlockLike): BlockLike
  isCollapse(): boolean
  checkInlineUpdate(block: BlockLike): void
  render(): void
}

interface FootnoteCtrlMethods {
  updateFootnote(block: BlockLike, line: BlockLike): BlockLike
  createFootnote(identifier: string): void
}

type ContentStateConstructor = {
  prototype: unknown
}

const footnoteCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & FootnoteCtrlMethods

  prototype.updateFootnote = function (block: BlockLike, line: BlockLike): BlockLike {
    const { start, end } = this.cursor
    const { text } = line
    const match = FOOTNOTE_REG.exec(text) as RegExpExecArray
    const footnoteIdentifer = match[1]
    const sectionWrapper = this.createBlock('figure', {
      functionType: 'footnote'
    })
    const footnoteInput = this.createBlock('span', {
      text: footnoteIdentifer,
      functionType: 'footnoteInput'
    })
    const pBlock = this.createBlockP(text.substring(match[0].length))
    this.appendChild(sectionWrapper, footnoteInput)
    this.appendChild(sectionWrapper, pBlock)
    this.insertBefore(sectionWrapper, block)
    this.removeBlock(block)

    const { key } = pBlock.children[0]
    this.cursor = {
      start: {
        key,
        offset: Math.max(0, start.offset - footnoteIdentifer.length)
      },
      end: {
        key,
        offset: Math.max(0, end.offset - footnoteIdentifer.length)
      }
    }

    if (this.isCollapse()) {
      this.checkInlineUpdate(pBlock.children[0])
    }

    this.render()
    return sectionWrapper
  }

  prototype.createFootnote = function (identifier: string): void {
    const { blocks } = this
    const lastBlock = blocks[blocks.length - 1]
    const newBlock = this.createBlockP(`[^${identifier}]: `)
    this.insertAfter(newBlock, lastBlock)
    const key = newBlock.children[0].key
    const offset = newBlock.children[0].text.length
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    const sectionWrapper = this.updateFootnote(newBlock, newBlock.children[0])
    const id = sectionWrapper.key
    const footnoteEle = document.querySelector<HTMLElement>(`#${id}`)
    if (footnoteEle) {
      footnoteEle.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

export default footnoteCtrl
