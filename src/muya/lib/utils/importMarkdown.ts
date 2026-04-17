/**
 * translate markdown format to content state used by MarkText
 * there is some difference when parse loose list item and tight lsit item.
 * Both of them add a p block in li block, use the CSS style to distinguish loose and tight.
 */
import StateRender from '../parser/render'
import { tokenizer } from '../parser'
import { getImageInfo } from '../utils'
import { Lexer } from '../parser/marked'
import ExportMarkdown from './exportMarkdown'
import TurndownService, { usePluginAddRules } from './turndownService'
import { loadLanguage } from '../prism/index'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { CURSOR_ANCHOR_DNA, CURSOR_FOCUS_DNA } from '../config'

type TableAlignment = 'left' | 'center' | 'right' | '' | null | string
type KeepSelector = string

interface BlockLike {
  key: string | null
  type: string
  text: string
  parent: string | null
  preSibling: string | null
  nextSibling: string | null
  children: BlockLike[]
  editable?: boolean
  functionType?: string
  lang?: string
  style?: string
  headingStyle?: 'atx' | 'setext' | string
  marker?: string
  mathStyle?: string
  align?: TableAlignment
  column?: number
  row?: number
  listType?: string
  listItemType?: string
  bulletMarkerOrDelimiter?: string
  isLooseListItem?: boolean
  checked?: boolean
  start?: number | string
  [key: string]: unknown
}

type BlockExtras = Partial<BlockLike> & Record<string, unknown>

interface MuyaOptionsLike {
  footnote: boolean
  isGitlabCompatibilityEnabled: boolean
  superSubScript: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  [key: string]: unknown
}

interface MuyaLike {
  options: MuyaOptionsLike
}

interface CursorPosition {
  key: string
  offset: number
}

interface SelectionCursor {
  anchor: CursorPosition
  focus: CursorPosition
  start?: CursorPosition
  end?: CursorPosition
  noHistory?: boolean
}

interface MutableSelectionCursor {
  anchor: CursorPosition | null
  focus: CursorPosition | null
}

interface CodeMirrorPosition {
  line: number
  ch: number
}

interface CodeMirrorCursor {
  anchor: CodeMirrorPosition
  focus: CodeMirrorPosition
}

interface MarkdownCursorPayload {
  anchor?: CodeMirrorPosition | null
  focus?: CodeMirrorPosition | null
}

interface CursorMarkdownResult {
  markdown: string
  isValid: boolean
}

interface ReferenceDefinition {
  href: string
  title?: string
}

interface StateRenderLike {
  labels: Map<string, ReferenceDefinition>
  collectLabels(blocks: BlockLike[]): void
}

interface TokenizerConfig {
  hasBeginRules?: boolean
  labels?: Map<string, ReferenceDefinition>
}

interface TokenBacklash {
  first: string
  second: string
}

interface InlineToken {
  type: string
  attrs?: Record<string, string>
  children?: InlineToken[] | ''
  tag?: string
  label?: string
  backlash?: TokenBacklash | string
}

interface ImageInfo {
  isUnknownType: boolean
  src: string
}

interface LoadLanguageResult {
  lang: string
  status: 'noexist' | 'cached' | 'loaded'
}

interface FrontmatterToken {
  type: 'frontmatter'
  text: string
  lang?: string
  style?: string
}

interface HrToken {
  type: 'hr'
  marker: string
}

interface HeadingToken {
  type: 'heading'
  headingStyle: 'atx' | 'setext'
  depth: number
  text: string
  marker?: string
}

interface MultipleMathToken {
  type: 'multiplemath'
  text: string
  mathStyle?: string
}

interface CodeToken {
  type: 'code'
  codeBlockStyle: 'indented' | 'fenced'
  text: string
  lang?: string
}

interface TableToken {
  type: 'table'
  header: string[]
  align: Array<TableAlignment | null>
  cells: string[][]
}

interface HtmlToken {
  type: 'html'
  text: string
}

interface TextToken {
  type: 'text'
  text: string
}

interface ParagraphToken {
  type: 'paragraph'
  text: string
}

interface TocToken {
  type: 'toc'
  text: string
}

interface BlockquoteStartToken {
  type: 'blockquote_start'
}

interface BlockquoteEndToken {
  type: 'blockquote_end'
}

interface FootnoteStartToken {
  type: 'footnote_start'
  identifier: string
}

interface FootnoteEndToken {
  type: 'footnote_end'
}

interface ListStartToken {
  type: 'list_start'
  ordered: boolean
  listType: string
  start: number | string
}

interface ListEndToken {
  type: 'list_end'
}

interface ListItemStartToken {
  type: 'list_item_start' | 'loose_item_start'
  listItemType: string
  bulletMarkerOrDelimiter: string
  checked?: boolean
}

interface ListItemEndToken {
  type: 'list_item_end'
}

interface SpaceToken {
  type: 'space'
}

type LexerToken =
  | FrontmatterToken
  | HrToken
  | HeadingToken
  | MultipleMathToken
  | CodeToken
  | TableToken
  | HtmlToken
  | TextToken
  | ParagraphToken
  | TocToken
  | BlockquoteStartToken
  | BlockquoteEndToken
  | FootnoteStartToken
  | FootnoteEndToken
  | ListStartToken
  | ListEndToken
  | ListItemStartToken
  | ListItemEndToken
  | SpaceToken

interface LexerOptions {
  disableInline?: boolean
  footnote?: boolean
  isGitlabCompatibilityEnabled?: boolean
  superSubScript?: boolean
}

interface LexerInstance {
  lex(markdown: string): LexerToken[]
}

interface ContentStateLike {
  muya: MuyaLike
  turndownConfig: Record<string, unknown>
  blocks: BlockLike[]
  cursor: SelectionCursor
  isGitlabCompatibilityEnabled: boolean
  listIndentation: number | string
  createBlock(type?: string, extras?: BlockExtras): BlockLike
  createBlockP(text?: string): BlockLike
  createContainerBlock(functionType: string, value?: string, style?: string): BlockLike
  createHtmlBlock(code: string): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  getBlocks(): BlockLike[]
  getBlock(key: string | null | undefined): BlockLike | null
  getLastBlock(): BlockLike
  render(): void
}

interface ImportMarkdownMethods {
  markdownToState(markdown: string): BlockLike[]
  htmlToMarkdown(html: string, keeps?: KeepSelector[]): string
  html2State(html: string): BlockLike[]
  getCodeMirrorCursor(): CodeMirrorCursor
  addCursorToMarkdown(markdown: string, cursor: MarkdownCursorPayload): CursorMarkdownResult | void
  importCursor(hasCursor: boolean): void
  importMarkdown(markdown: string): void
  extractImages(markdown: string): string[]
}

type ContentStateConstructor = {
  prototype: unknown
}

type StateRenderConstructor = new (muya: MuyaLike) => StateRenderLike
type TokenizerFn = (src: string, config?: TokenizerConfig) => InlineToken[]
type GetImageInfoFn = (src: string, baseUrl?: string) => ImageInfo
type LexerConstructor = new (options?: LexerOptions) => LexerInstance
type ExportMarkdownConstructor = new (
  blocks: BlockLike[],
  listIndentation?: number | string,
  isGitlabCompatibilityEnabled?: boolean
) => {
  generate(): string
}
type TurndownServiceConstructor = new (options: Record<string, unknown>) => {
  turndown(html: string): string
}
type UsePluginAddRulesFn = (
  turndownService: { turndown(html: string): string },
  keeps: KeepSelector[]
) => void
type LoadLanguageFn = (langs?: string[] | string) => Promise<LoadLanguageResult[]>

const StateRenderCtor = StateRender as unknown as StateRenderConstructor
const tokenizerFn = tokenizer as unknown as TokenizerFn
const getImageInfoFn = getImageInfo as unknown as GetImageInfoFn
const LexerCtor = Lexer as unknown as LexerConstructor
const ExportMarkdownCtor = ExportMarkdown as unknown as ExportMarkdownConstructor
const TurndownServiceCtor = TurndownService as unknown as TurndownServiceConstructor
const usePluginAddRulesFn = usePluginAddRules as unknown as UsePluginAddRulesFn
const loadLanguageFn = loadLanguage as unknown as LoadLanguageFn

const languageLoaded = new Set<string>()

// Just because turndown change `\n`(soft line break) to space, So we add `span.ag-soft-line-break` to workaround.
const turnSoftBreakToSpan = (html: string): string => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<x-mt id="turn-root">${html}</x-mt>`,
    'text/html'
  )
  const root = doc.querySelector('#turn-root')
  if (!root) {
    return html.trim()
  }

  const travel = (childNodes: NodeListOf<ChildNode>): void => {
    for (const node of childNodes) {
      if (node.nodeType === Node.TEXT_NODE && (node.parentNode as Element | null)?.tagName !== 'CODE') {
        let startLen = 0
        let endLen = 0
        const text = (node.nodeValue ?? '')
          .replace(/^(\n+)/, (_match, capture: string) => {
            startLen = capture.length
            return ''
          })
          .replace(/(\n+)$/, (_match, capture: string) => {
            endLen = capture.length
            return ''
          })

        if (/\n/.test(text)) {
          const tokens = text.split('\n')
          const params: Node[] = []
          let i = 0
          const len = tokens.length
          for (; i < len; i++) {
            let currentText = tokens[i] as string
            if (i === 0 && startLen !== 0) {
              currentText = '\n'.repeat(startLen) + currentText
            } else if (i === len - 1 && endLen !== 0) {
              currentText = currentText + '\n'.repeat(endLen)
            }
            params.push(document.createTextNode(currentText))
            if (i !== len - 1) {
              const softBreak = document.createElement('span')
              softBreak.classList.add('ag-soft-line-break')
              params.push(softBreak)
            }
          }
          node.replaceWith(...params)
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        travel(node.childNodes as NodeListOf<ChildNode>)
      }
    }
  }

  travel(root.childNodes)
  return root.innerHTML.trim()
}

const importRegister = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & ImportMarkdownMethods

  // turn markdown to blocks
  prototype.markdownToState = function (markdown: string): BlockLike[] {
    // mock a root block...
    const rootState: BlockLike = {
      key: null,
      type: 'root',
      text: '',
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }
    const {
      footnote,
      isGitlabCompatibilityEnabled,
      superSubScript,
      trimUnnecessaryCodeBlockEmptyLines
    } = this.muya.options

    const tokens = new LexerCtor({
      disableInline: true,
      footnote,
      isGitlabCompatibilityEnabled,
      superSubScript
    }).lex(markdown)

    let token: LexerToken | undefined
    let block!: BlockLike
    let value = ''
    const parentList: BlockLike[] = [rootState]
    const currentParent = (): BlockLike => parentList[0] as BlockLike

    while ((token = tokens.shift())) {
      switch (token.type) {
        case 'frontmatter': {
          const { lang, style } = token
          value = token.text
            .replace(/^\s+/, '')
            .replace(/\s$/, '')
          block = this.createBlock('pre', {
            functionType: token.type,
            lang,
            style
          })

          const codeBlock = this.createBlock('code', {
            lang
          })

          const codeContent = this.createBlock('span', {
            text: value,
            lang,
            functionType: 'codeContent'
          })

          this.appendChild(codeBlock, codeContent)
          this.appendChild(block, codeBlock)
          this.appendChild(currentParent(), block)
          break
        }

        case 'hr': {
          value = token.marker
          block = this.createBlock('hr')
          const thematicBreakContent = this.createBlock('span', {
            text: value,
            functionType: 'thematicBreakLine'
          })
          this.appendChild(block, thematicBreakContent)
          this.appendChild(currentParent(), block)
          break
        }

        case 'heading': {
          const { headingStyle, depth, text, marker } = token
          value = headingStyle === 'atx' ? '#'.repeat(Number(depth)) + ` ${text}` : text
          block = this.createBlock(`h${depth}`, {
            headingStyle
          })

          const headingContent = this.createBlock('span', {
            text: value,
            functionType: headingStyle === 'atx' ? 'atxLine' : 'paragraphContent'
          })

          this.appendChild(block, headingContent)

          if (marker) {
            block.marker = marker
          }

          this.appendChild(currentParent(), block)
          break
        }

        case 'multiplemath': {
          value = token.text
          block = this.createContainerBlock(token.type, value, token.mathStyle)
          this.appendChild(currentParent(), block)
          break
        }

        case 'code': {
          const { codeBlockStyle, text, lang: infostring = '' } = token

          // GH#697, markedjs#1387
          const lang = (infostring || '').match(/\S*/)?.[0] || ''

          value = text
          // Fix: #1265.
          if (trimUnnecessaryCodeBlockEmptyLines && (value.endsWith('\n') || value.startsWith('\n'))) {
            value = value.replace(/\n+$/, '')
              .replace(/^\n+/, '')
          }
          if (/mermaid|flowchart|vega-lite|sequence|plantuml/.test(lang)) {
            block = this.createContainerBlock(lang, value)
            this.appendChild(currentParent(), block)
          } else {
            block = this.createBlock('pre', {
              functionType: codeBlockStyle === 'fenced' ? 'fencecode' : 'indentcode',
              lang
            })
            const codeBlock = this.createBlock('code', {
              lang
            })
            const codeContent = this.createBlock('span', {
              text: value,
              lang,
              functionType: 'codeContent'
            })
            const inputBlock = this.createBlock('span', {
              text: lang,
              functionType: 'languageInput'
            })
            if (lang && !languageLoaded.has(lang)) {
              languageLoaded.add(lang)
              loadLanguageFn(lang)
                .then(infoList => {
                  if (!Array.isArray(infoList)) return
                  // There are three status `loaded`, `noexist` and `cached`.
                  // if the status is `loaded`, indicated that it's a new loaded language
                  const needRender = infoList.some(({ status }) => status === 'loaded')
                  if (needRender) {
                    this.render()
                  }
                })
                .catch(err => {
                  // if no parameter provided, will cause error.
                  console.warn(err)
                })
            }

            this.appendChild(codeBlock, codeContent)
            this.appendChild(block, inputBlock)
            this.appendChild(block, codeBlock)
            this.appendChild(currentParent(), block)
          }
          break
        }

        case 'table': {
          const { header, align, cells } = token
          const table = this.createBlock('table')
          const thead = this.createBlock('thead')
          const tbody = this.createBlock('tbody')
          const theadRow = this.createBlock('tr')
          const restoreTableEscapeCharacters = (text: string): string => {
            // NOTE: markedjs replaces all escaped "|" ("\|") characters inside a cell with "|".
            //       We have to re-escape the chraracter to not break the table.
            return text.replace(/\|/g, '\\|')
          }
          let i
          let j
          const headerLen = header.length
          for (i = 0; i < headerLen; i++) {
            const headText = header[i] as string
            const th = this.createBlock('th', {
              align: align[i] || '',
              column: i
            })
            const cellContent = this.createBlock('span', {
              text: restoreTableEscapeCharacters(headText),
              functionType: 'cellContent'
            })
            this.appendChild(th, cellContent)
            this.appendChild(theadRow, th)
          }
          const rowLen = cells.length
          for (i = 0; i < rowLen; i++) {
            const rowBlock = this.createBlock('tr')
            const rowContents = cells[i] as string[]
            const colLen = rowContents.length
            for (j = 0; j < colLen; j++) {
              const cell = rowContents[j] as string
              const td = this.createBlock('td', {
                align: align[j] || '',
                column: j
              })
              const cellContent = this.createBlock('span', {
                text: restoreTableEscapeCharacters(cell),
                functionType: 'cellContent'
              })

              this.appendChild(td, cellContent)
              this.appendChild(rowBlock, td)
            }
            this.appendChild(tbody, rowBlock)
          }

          table.row = cells.length
          table.column = header.length - 1
          block = this.createBlock('figure')
          block.functionType = 'table'
          this.appendChild(thead, theadRow)
          this.appendChild(block, table)
          this.appendChild(table, thead)
          if (tbody.children.length) {
            this.appendChild(table, tbody)
          }
          this.appendChild(currentParent(), block)
          break
        }

        case 'html': {
          const text = token.text.trim()
          // TODO: Treat html block which only contains one img as paragraph, we maybe add image block in the future.
          const isSingleImage = /^<img[^<>]+>$/.test(text)
          if (isSingleImage) {
            block = this.createBlock('p')
            const contentBlock = this.createBlock('span', {
              text
            })
            this.appendChild(block, contentBlock)
            this.appendChild(currentParent(), block)
          } else {
            block = this.createHtmlBlock(text)
            this.appendChild(currentParent(), block)
          }
          break
        }

        case 'text': {
          value = token.text
          while (tokens[0]?.type === 'text') {
            const nextToken = tokens.shift() as TextToken | undefined
            if (!nextToken) {
              break
            }
            value += `\n${nextToken.text}`
          }
          block = this.createBlock('p')
          const contentBlock = this.createBlock('span', {
            text: value
          })
          this.appendChild(block, contentBlock)
          this.appendChild(currentParent(), block)
          break
        }

        case 'toc':
        case 'paragraph': {
          value = token.text
          block = this.createBlock('p')
          const contentBlock = this.createBlock('span', {
            text: value
          })
          this.appendChild(block, contentBlock)
          this.appendChild(currentParent(), block)
          break
        }

        case 'blockquote_start': {
          block = this.createBlock('blockquote')
          this.appendChild(currentParent(), block)
          parentList.unshift(block)
          break
        }

        case 'blockquote_end': {
          // Fix #1735 the blockquote maybe empty.
          if (currentParent().children.length === 0) {
            const paragraphBlock = this.createBlockP()
            this.appendChild(currentParent(), paragraphBlock)
          }
          parentList.shift()
          break
        }

        case 'footnote_start': {
          block = this.createBlock('figure', {
            functionType: 'footnote'
          })
          const identifierInput = this.createBlock('span', {
            text: token.identifier,
            functionType: 'footnoteInput'
          })
          this.appendChild(block, identifierInput)
          this.appendChild(currentParent(), block)
          parentList.unshift(block)
          break
        }

        case 'footnote_end': {
          parentList.shift()
          break
        }

        case 'list_start': {
          const { ordered, listType, start } = token
          block = this.createBlock(ordered === true ? 'ol' : 'ul')
          block.listType = listType
          if (listType === 'order') {
            block.start = /^\d+$/.test(String(start)) ? start : 1
          }
          this.appendChild(currentParent(), block)
          parentList.unshift(block)
          break
        }

        case 'list_end': {
          parentList.shift()
          break
        }

        case 'loose_item_start':
        case 'list_item_start': {
          const { listItemType, bulletMarkerOrDelimiter, checked, type } = token
          block = this.createBlock('li', {
            listItemType: checked !== undefined ? 'task' : listItemType,
            bulletMarkerOrDelimiter,
            isLooseListItem: type === 'loose_item_start'
          })

          if (checked !== undefined) {
            const input = this.createBlock('input', {
              checked
            })

            this.appendChild(block, input)
          }
          this.appendChild(currentParent(), block)
          parentList.unshift(block)
          break
        }

        case 'list_item_end': {
          parentList.shift()
          break
        }

        case 'space': {
          break
        }

        default: {
          const unknownToken = token as { type: string }
          console.warn(`Unknown type ${unknownToken.type}`)
          break
        }
      }
    }

    return rootState.children.length ? rootState.children : [this.createBlockP()]
  }

  prototype.htmlToMarkdown = function (html: string, keeps: KeepSelector[] = []): string {
    // turn html to markdown
    const { turndownConfig } = this
    const turndownService = new TurndownServiceCtor(turndownConfig)
    usePluginAddRulesFn(turndownService, keeps)

    // fix #752, but I don't know why the &nbsp; vanlished.
    html = html.replace(/<span>&nbsp;<\/span>/g, String.fromCharCode(160))

    html = turnSoftBreakToSpan(html)
    const markdown = turndownService.turndown(html)

    return markdown
  }

  // turn html to blocks
  prototype.html2State = function (html: string): BlockLike[] {
    const markdown = this.htmlToMarkdown(html, ['ruby', 'rt', 'u', 'br'])
    return this.markdownToState(markdown)
  }

  prototype.getCodeMirrorCursor = function (): CodeMirrorCursor {
    const blocks = this.getBlocks()
    const { anchor, focus } = this.cursor
    const anchorBlock = this.getBlock(anchor.key) as BlockLike
    const focusBlock = this.getBlock(focus.key) as BlockLike
    const { text: anchorText } = anchorBlock
    const { text: focusText } = focusBlock
    if (anchor.key === focus.key) {
      const minOffset = Math.min(anchor.offset, focus.offset)
      const maxOffset = Math.max(anchor.offset, focus.offset)
      const firstTextPart = anchorText.substring(0, minOffset)
      const secondTextPart = anchorText.substring(minOffset, maxOffset)
      const thirdTextPart = anchorText.substring(maxOffset)
      anchorBlock.text = firstTextPart +
        (anchor.offset <= focus.offset ? CURSOR_ANCHOR_DNA : CURSOR_FOCUS_DNA) +
        secondTextPart +
        (anchor.offset <= focus.offset ? CURSOR_FOCUS_DNA : CURSOR_ANCHOR_DNA) +
        thirdTextPart
    } else {
      anchorBlock.text = anchorText.substring(0, anchor.offset) + CURSOR_ANCHOR_DNA + anchorText.substring(anchor.offset)
      focusBlock.text = focusText.substring(0, focus.offset) + CURSOR_FOCUS_DNA + focusText.substring(focus.offset)
    }

    const { isGitlabCompatibilityEnabled, listIndentation } = this
    const markdown = new ExportMarkdownCtor(blocks, listIndentation, isGitlabCompatibilityEnabled).generate()
    const cursor = markdown.split('\n').reduce<CodeMirrorCursor>((acc, line, index) => {
      const ach = line.indexOf(CURSOR_ANCHOR_DNA)
      const fch = line.indexOf(CURSOR_FOCUS_DNA)
      if (ach > -1 && fch > -1) {
        if (ach <= fch) {
          Object.assign(acc.anchor, { line: index, ch: ach })
          Object.assign(acc.focus, { line: index, ch: fch - CURSOR_ANCHOR_DNA.length })
        } else {
          Object.assign(acc.focus, { line: index, ch: fch })
          Object.assign(acc.anchor, { line: index, ch: ach - CURSOR_FOCUS_DNA.length })
        }
      } else if (ach > -1) {
        Object.assign(acc.anchor, { line: index, ch: ach })
      } else if (fch > -1) {
        Object.assign(acc.focus, { line: index, ch: fch })
      }
      return acc
    }, {
      anchor: {
        line: 0,
        ch: 0
      },
      focus: {
        line: 0,
        ch: 0
      }
    })
    // remove CURSOR_FOCUS_DNA and CURSOR_ANCHOR_DNA
    anchorBlock.text = anchorText
    focusBlock.text = focusText
    return cursor
  }

  prototype.addCursorToMarkdown = function (
    markdown: string,
    cursor: MarkdownCursorPayload
  ): CursorMarkdownResult | void {
    const { anchor, focus } = cursor
    if (!anchor || !focus) {
      return
    }
    const lines = markdown.split('\n')
    const anchorText = lines[anchor.line]
    const focusText = lines[focus.line]
    if (!anchorText || !focusText) {
      return {
        markdown: lines.join('\n'),
        isValid: false
      }
    }
    if (anchor.line === focus.line) {
      const minOffset = Math.min(anchor.ch, focus.ch)
      const maxOffset = Math.max(anchor.ch, focus.ch)
      const firstTextPart = anchorText.substring(0, minOffset)
      const secondTextPart = anchorText.substring(minOffset, maxOffset)
      const thirdTextPart = anchorText.substring(maxOffset)
      lines[anchor.line] = firstTextPart +
        (anchor.ch <= focus.ch ? CURSOR_ANCHOR_DNA : CURSOR_FOCUS_DNA) +
        secondTextPart +
        (anchor.ch <= focus.ch ? CURSOR_FOCUS_DNA : CURSOR_ANCHOR_DNA) +
        thirdTextPart
    } else {
      lines[anchor.line] = anchorText.substring(0, anchor.ch) + CURSOR_ANCHOR_DNA + anchorText.substring(anchor.ch)
      lines[focus.line] = focusText.substring(0, focus.ch) + CURSOR_FOCUS_DNA + focusText.substring(focus.ch)
    }

    return {
      markdown: lines.join('\n'),
      isValid: true
    }
  }

  prototype.importCursor = function (hasCursor: boolean): void {
    // set cursor
    const cursor: MutableSelectionCursor = {
      anchor: null,
      focus: null
    }

    let count = 0

    const travel = (blocks: BlockLike[]): void => {
      for (const block of blocks) {
        let { key, text, children, editable } = block
        if (text) {
          const offset = text.indexOf(CURSOR_ANCHOR_DNA)
          if (offset > -1) {
            block.text = text.substring(0, offset) + text.substring(offset + CURSOR_ANCHOR_DNA.length)
            text = block.text
            count++
            if (editable) {
              cursor.anchor = { key: key as string, offset }
            }
          }
          const focusOffset = text.indexOf(CURSOR_FOCUS_DNA)
          if (focusOffset > -1) {
            block.text = text.substring(0, focusOffset) + text.substring(focusOffset + CURSOR_FOCUS_DNA.length)
            count++
            if (editable) {
              cursor.focus = { key: key as string, offset: focusOffset }
            }
          }
          if (count === 2) {
            break
          }
        } else if (children.length) {
          travel(children)
        }
      }
    }
    if (hasCursor) {
      travel(this.blocks)
    } else {
      const lastBlock = this.getLastBlock()
      const key = lastBlock.key as string
      const offset = lastBlock.text.length
      cursor.anchor = { key, offset }
      cursor.focus = { key, offset }
    }
    if (cursor.anchor && cursor.focus) {
      this.cursor = cursor as SelectionCursor
    }
  }

  prototype.importMarkdown = function (markdown: string): void {
    this.blocks = this.markdownToState(markdown)
  }

  prototype.extractImages = function (markdown: string): string[] {
    const results = new Set<string>()
    const blocks = this.markdownToState(markdown)
    const render = new StateRenderCtor(this.muya)
    render.collectLabels(blocks)

    const travelToken = (token: InlineToken): void => {
      const { type, attrs, children, tag, label, backlash } = token
      if (/reference_image|image/.test(type) || type === 'html_tag' && tag === 'img') {
        if ((type === 'image' || type === 'html_tag') && attrs?.src) {
          results.add(attrs.src)
        } else if (type === 'reference_image' && label && backlash && typeof backlash !== 'string') {
          const rawSrc = label + backlash.second
          if (render.labels.has(rawSrc.toLowerCase())) {
            const { href } = render.labels.get(rawSrc.toLowerCase()) as ReferenceDefinition
            const { src } = getImageInfoFn(href)
            if (src) {
              results.add(src)
            }
          }
        }
      } else if (Array.isArray(children) && children.length) {
        for (const child of children) {
          travelToken(child)
        }
      }
    }

    const travel = (block: BlockLike): void => {
      const { text, children, type, functionType } = block
      if (children.length) {
        for (const childBlock of children) {
          travel(childBlock)
        }
      } else if (text && type === 'span' && /paragraphContent|atxLine|cellContent/.test(functionType || '')) {
        const tokens = tokenizerFn(text, {
          hasBeginRules: false,
          labels: render.labels
        })
        for (const token of tokens) {
          travelToken(token)
        }
      }
    }

    for (const block of blocks) {
      travel(block)
    }

    return Array.from(results)
  }
}

export default importRegister
