import { loadLanguage } from '../prism/index'
import { escapeHTML } from '../utils'
import selection from '../selection'

const CODE_UPDATE_REP = /^`{3,}(.*)/

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  start?: CursorPosition | null
}

interface BlockLike {
  key: string
  type: string
  text: string
  lang?: string
  history?: unknown
  functionType?: string
  children: BlockLike[]
}

interface ParagraphLike extends HTMLElement {
  id: string
}

interface SelectionLike {
  getCursorRange(): CursorRangeLike
}

interface ClipboardLike {
  copy(type: string, data: string): void
}

interface MuyaLike {
  clipboard: ClipboardLike
}

interface ContentStateLike {
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  muya: MuyaLike
  isGitlabCompatibilityEnabled: boolean
  getBlock(key: string): BlockLike
  getParent(block: BlockLike): BlockLike
  getNextSibling(block: BlockLike): BlockLike
  updateMathBlock(block: BlockLike): unknown
  partialRender(): void
  createBlock(type: string, extras?: Record<string, unknown>): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
}

interface CodeBlockCtrlMethods {
  checkEditLanguage(): {
    lang: string
    paragraph: ParagraphLike | null
  }
  selectLanguage(paragraph: ParagraphLike, lang: string): void
  updateCodeLanguage(block: BlockLike, lang: string): void
  codeBlockUpdate(block: BlockLike, code?: string, lang?: string): boolean
  copyCodeBlock(event: MouseEvent): void
  resizeLineNumber(): void
}

type ContentStateConstructor = {
  prototype: unknown
}

const selectionApi = selection as unknown as SelectionLike

const codeBlockCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & CodeBlockCtrlMethods

  prototype.checkEditLanguage = function () {
    const { start } = selectionApi.getCursorRange()
    if (!start) {
      return { lang: '', paragraph: null }
    }

    const startBlock = this.getBlock(start.key)
    const paragraph = document.querySelector<ParagraphLike>(`#${start.key}`)
    let lang = ''
    const { text } = startBlock
    if (startBlock.type === 'span') {
      if (startBlock.functionType === 'languageInput') {
        lang = text.trim()
      } else if (startBlock.functionType === 'paragraphContent') {
        const token = text.match(/(^`{3,})([^`]+)/)
        if (token) {
          const len = token[1].length
          if (start.offset >= len) {
            lang = token[2].trim()
          }
        }
      }
    }

    return { lang, paragraph }
  }

  prototype.selectLanguage = function (paragraph: ParagraphLike, lang: string) {
    const block = this.getBlock(paragraph.id)
    if (lang === 'math' && this.isGitlabCompatibilityEnabled && this.updateMathBlock(block)) {
      return
    }

    this.updateCodeLanguage(block, lang)
  }

  prototype.updateCodeLanguage = function (block: BlockLike, lang: string) {
    if (!lang || typeof lang !== 'string') {
      console.error('Invalid code block language string:', lang)
      lang = ''
    }

    lang = escapeHTML(lang)
    if (lang !== '') {
      loadLanguage(lang)
    }

    if (block.functionType === 'languageInput') {
      const preBlock = this.getParent(block)
      const nextSibling = this.getNextSibling(block)

      if (block.text !== lang || preBlock.text !== lang || nextSibling.text !== lang) {
        block.text = lang
        preBlock.lang = lang
        preBlock.functionType = 'fencecode'
        nextSibling.lang = lang
        nextSibling.children.forEach(child => {
          child.lang = lang
        })
      }

      const { key } = nextSibling.children[0]
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    } else {
      block.text = block.text.replace(/^(`+)([^`]+$)/g, `$1${lang}`)
      this.codeBlockUpdate(block)
    }
    this.partialRender()
  }

  prototype.codeBlockUpdate = function (block: BlockLike, code = '', lang?: string) {
    if (block.type === 'span') {
      block = this.getParent(block)
    }

    if (block.type !== 'p') return false
    if (block.children.length !== 1) return false

    const { text } = block.children[0]
    const match = CODE_UPDATE_REP.exec(text)
    if (match || lang) {
      const language = lang || (match ? match[1] : '')
      const codeBlock = this.createBlock('code', {
        lang: language
      })
      const codeContent = this.createBlock('span', {
        text: code,
        lang: language,
        functionType: 'codeContent'
      })
      const inputBlock = this.createBlock('span', {
        text: language,
        functionType: 'languageInput'
      })

      if (language) {
        loadLanguage(language)
      }

      block.type = 'pre'
      block.functionType = 'fencecode'
      block.lang = language
      block.text = ''
      block.history = null
      block.children = []

      this.appendChild(codeBlock, codeContent)
      this.appendChild(block, inputBlock)
      this.appendChild(block, codeBlock)
      const { key } = codeContent
      const offset = code.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return true
    }
    return false
  }

  prototype.copyCodeBlock = function (event: MouseEvent) {
    const target = event.target as HTMLElement | null
    const preElement = target?.closest('pre')
    if (!preElement) {
      return
    }

    const preBlock = this.getBlock(preElement.id)
    const codeBlock = preBlock.children.find(child => child.type === 'code')
    const codeContent = codeBlock?.children[0]?.text
    if (typeof codeContent === 'string') {
      this.muya.clipboard.copy('copyCodeContent', codeContent)
    }
  }

  prototype.resizeLineNumber = function () {
  }
}

export default codeBlockCtrl
