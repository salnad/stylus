import { VOID_HTML_TAGS, HTML_TAGS } from '../config'
import { inlineRules } from '../parser/rules'

const HTML_BLOCK_REG = /^<([a-zA-Z\d-]+)(?=\s|>)[^<>]*?>$/

interface BlockLike {
  type: string
  functionType?: string
  text?: string
  children: BlockLike[]
}

interface ContentStateLike {
  createBlock(type?: string): BlockLike
  createPreAndPreview(type: string, code: string): { preBlock: BlockLike, preview: BlockLike }
  appendChild(parent: BlockLike, block: BlockLike): void
}

type ContentStateConstructor = {
  prototype: ContentStateLike & {
    createHtmlBlock(code: string): BlockLike
    initHtmlBlock(block: BlockLike): BlockLike
    updateHtmlBlock(block: BlockLike): BlockLike | false
  }
}

const htmlBlock = (ContentState: ContentStateConstructor): void => {
  ContentState.prototype.createHtmlBlock = function (code: string): BlockLike {
    const block = this.createBlock('figure')
    block.functionType = 'html'
    const { preBlock, preview } = this.createPreAndPreview('html', code)
    this.appendChild(block, preBlock)
    this.appendChild(block, preview)
    return block
  }

  ContentState.prototype.initHtmlBlock = function (block: BlockLike): BlockLike {
    let htmlContent = ''
    const text = block.children[0].text ?? ''
    const matches = inlineRules.html_tag.exec(text)
    if (matches) {
      const tag = matches[3]
      const content = matches[4] || ''
      const openTag = matches[2]
      const closeTag = matches[5]
      const isVoidTag = typeof tag === 'string' && (VOID_HTML_TAGS as readonly string[]).indexOf(tag) > -1
      if (closeTag) {
        htmlContent = text
      } else if (isVoidTag) {
        htmlContent = text
        if (content) {
          console.warn('Invalid html content.')
        }
      } else {
        htmlContent = `${openTag}\n${content}\n</${tag}>`
      }
    } else {
      htmlContent = `<div>\n${text}\n</div>`
    }

    block.type = 'figure'
    block.functionType = 'html'
    block.text = htmlContent
    block.children = []
    const { preBlock, preview } = this.createPreAndPreview('html', htmlContent)
    this.appendChild(block, preBlock)
    this.appendChild(block, preview)

    return preBlock
  }

  ContentState.prototype.updateHtmlBlock = function (block: BlockLike): BlockLike | false {
    const { type } = block
    if (type !== 'li' && type !== 'p') return false
    const text = block.children[0]?.text ?? ''
    const match = HTML_BLOCK_REG.exec(text)
    const tagName = match?.[1] && HTML_TAGS.find(tag => tag === match[1])
    return typeof tagName === 'string' && (VOID_HTML_TAGS as readonly string[]).indexOf(tagName) === -1
      ? this.initHtmlBlock(block)
      : false
  }
}

export default htmlBlock
