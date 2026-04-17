import selection from '../selection'
import { CLASS_OR_ID } from '../config'
import { escapeHTML } from '../utils'
import { getSanitizeHtml } from '../utils/exportHtml'
import ExportMarkdown from '../utils/exportMarkdown'
import marked from '../parser/marked'

interface RangeLike {
  start: number
  end: number
}

interface TokenLike {
  raw?: string
  range?: RangeLike
  [key: string]: unknown
}

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRange {
  start?: CursorPosition | null
  end?: CursorPosition | null
}

interface BlockLike {
  key: string
  text: string
  type: string
  lang?: string
  functionType?: string
  children: BlockLike[]
  [key: string]: unknown
}

interface TableCellContentLike {
  text: string
  align: string
}

interface SelectedTableCellsLike {
  row: number
  column: number
  cells: TableCellContentLike[]
}

interface SelectedImageLike {
  key: string
  token: TokenLike
}

interface StateRenderLike {
  urlMap: Map<unknown, unknown>
}

interface MuyaLike {
  options: {
    superSubScript?: boolean
    footnote?: boolean
    isGitlabCompatibilityEnabled?: boolean
    [key: string]: unknown
  }
}

interface ContentStateLike {
  selectedTableCells: SelectedTableCellsLike | null
  selectedImage: SelectedImageLike | null
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  stateRender: StateRenderLike
  muya: MuyaLike
  isGitlabCompatibilityEnabled: boolean
  listIndentation: number | string
  deleteSelectedTableCells(isCut?: boolean): unknown
  deleteImage(image: Pick<SelectedImageLike, 'key' | 'token'>): void
  getBlock(key: string | null | undefined): BlockLike | null
  removeBlocks(before: BlockLike, after: BlockLike): void
  checkInlineUpdate(block: BlockLike): unknown
  partialRender(): unknown
  htmlToMarkdown(html: string): string
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  createTableInFigure(
    options: { rows: number, columns: number },
    tableContents?: TableCellContentLike[][]
  ): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  getAnchor(block: BlockLike): BlockLike | null
}

interface ClipboardResult {
  html: string
  text: string
}

type CopyHandlerType = 'normal' | 'copyAsMarkdown' | 'copyAsHtml' | 'copyBlock' | 'copyCodeContent'

interface CopyCutCtrlMethods {
  docCutHandler(event: ClipboardEvent): unknown
  cutHandler(): void
  getClipBoardData(): ClipboardResult
  docCopyHandler(event: ClipboardEvent): void
  copyHandler(event: ClipboardEvent, type: CopyHandlerType, copyInfo?: string | BlockLike | null): void
}

interface SelectionLike {
  getCursorRange(): CursorRange
  getSelectionHtml(): string
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

type GetSanitizeHtml = (markdown: string, options: Record<string, unknown>) => string

const selectionApi = selection as unknown as SelectionLike
const ExportMarkdownCtor = ExportMarkdown as unknown as ExportMarkdownConstructor
const getSanitizeHtmlFn = getSanitizeHtml as GetSanitizeHtml
const classOrId = CLASS_OR_ID as Record<string, string | undefined>

const copyCutCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & CopyCutCtrlMethods

  prototype.docCutHandler = function (event: ClipboardEvent): unknown {
    const { selectedTableCells } = this
    if (selectedTableCells) {
      event.preventDefault()
      return this.deleteSelectedTableCells(true)
    }
  }

  prototype.cutHandler = function (): void {
    if (this.selectedTableCells) {
      return
    }

    const { selectedImage } = this
    if (selectedImage) {
      const { key, token } = selectedImage
      this.deleteImage({ key, token })
      this.selectedImage = null
      return
    }

    const { start, end } = selectionApi.getCursorRange()
    if (!start || !end) {
      return
    }

    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    if (!startBlock || !endBlock) {
      return
    }

    startBlock.text = startBlock.text.substring(0, start.offset) + endBlock.text.substring(end.offset)
    if (start.key !== end.key) {
      this.removeBlocks(startBlock, endBlock)
    }
    this.cursor = {
      start,
      end: start
    }
    this.checkInlineUpdate(startBlock)
    this.partialRender()
  }

  prototype.getClipBoardData = function (): ClipboardResult {
    const { start, end } = selectionApi.getCursorRange()
    if (!start || !end) {
      return { html: '', text: '' }
    }

    if (start.key === end.key) {
      const startBlock = this.getBlock(start.key)
      if (startBlock) {
        const { type, text, functionType } = startBlock
        // Fix issue #942
        if (type === 'span' && functionType === 'codeContent') {
          const selectedText = text.substring(start.offset, end.offset)
          return {
            html: marked(selectedText, this.muya.options),
            text: selectedText
          }
        }
      }
    }

    const html = selectionApi.getSelectionHtml()
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const removedElements = wrapper.querySelectorAll(
      `.${classOrId.AG_TOOL_BAR},
      .${classOrId.AG_MATH_RENDER},
      .${classOrId.AG_RUBY_RENDER},
      .${classOrId.AG_HTML_PREVIEW},
      .${classOrId.AG_MATH_PREVIEW},
      .${classOrId.AG_COPY_REMOVE},
      .${classOrId.AG_LANGUAGE_INPUT},
      .${classOrId.AG_HTML_TAG} br,
      .${classOrId.AG_FRONT_ICON}`
    )

    for (const element of Array.from(removedElements)) {
      element.remove()
    }

    // Fix #1678 copy task list, and the first list item is not task list item.
    const taskListItems = wrapper.querySelectorAll<HTMLLIElement>('li.ag-task-list-item')
    for (const item of Array.from(taskListItems)) {
      const firstChild = item.firstElementChild
      if (firstChild && firstChild.nodeName !== 'INPUT') {
        const originItem = document.querySelector<HTMLElement>(`#${item.id}`)
        let checked = false
        const originFirstChild = originItem?.firstElementChild
        if (originFirstChild instanceof HTMLInputElement) {
          checked = originFirstChild.checked
        }

        const input = document.createElement('input')
        input.setAttribute('type', 'checkbox')
        if (checked) {
          input.setAttribute('checked', 'true')
        }

        item.insertBefore(input, firstChild)
      }
    }

    const images = wrapper.querySelectorAll<HTMLImageElement>('span.ag-inline-image img')
    for (const image of Array.from(images)) {
      const src = image.getAttribute('src')
      let originSrc: string | null = null
      for (const [sSrc, tSrc] of this.stateRender.urlMap.entries()) {
        if (tSrc === src) {
          originSrc = typeof sSrc === 'string' ? sSrc : null
          break
        }
      }

      if (originSrc) {
        image.setAttribute('src', originSrc)
      }
    }

    const hrs = wrapper.querySelectorAll<HTMLElement>('[data-role=hr]')
    for (const hr of Array.from(hrs)) {
      hr.replaceWith(document.createElement('hr'))
    }

    const headers = wrapper.querySelectorAll<HTMLElement>('[data-head]')
    for (const header of Array.from(headers)) {
      const p = document.createElement('p')
      p.textContent = header.textContent
      header.replaceWith(p)
    }

    // replace inline rule element: code, a, strong, em, del, auto_link to span element
    // in order to escape turndown translation
    const inlineRuleElements = wrapper.querySelectorAll<HTMLElement>(
      `a.${classOrId.AG_INLINE_RULE},
      code.${classOrId.AG_INLINE_RULE},
      strong.${classOrId.AG_INLINE_RULE},
      em.${classOrId.AG_INLINE_RULE},
      del.${classOrId.AG_INLINE_RULE}`
    )
    for (const element of Array.from(inlineRuleElements)) {
      const span = document.createElement('span')
      span.textContent = element.textContent
      element.replaceWith(span)
    }

    const aLinks = wrapper.querySelectorAll<HTMLElement>(`.${classOrId.AG_A_LINK}`)
    for (const link of Array.from(aLinks)) {
      const span = document.createElement('span')
      span.innerHTML = link.innerHTML
      link.replaceWith(span)
    }

    const codefense = wrapper.querySelectorAll<HTMLElement>("pre[data-role$='code']")
    for (const codeFence of Array.from(codefense)) {
      const id = codeFence.id
      const block = this.getBlock(id) as BlockLike
      const language = typeof block?.lang === 'string' ? block.lang : ''
      const codeContent = codeFence.querySelector<HTMLElement>('.ag-code-content')
      const value = escapeHTML(codeContent?.textContent ?? '')
      codeFence.innerHTML = `<code class="language-${language}">${value}</code>`
    }

    const tightListItems = wrapper.querySelectorAll<HTMLElement>('.ag-tight-list-item')
    for (const li of Array.from(tightListItems)) {
      for (const item of Array.from(li.childNodes)) {
        if (
          item instanceof HTMLElement &&
          item.tagName === 'P' &&
          item.childElementCount === 1 &&
          item.classList.contains('ag-paragraph') &&
          item.firstElementChild
        ) {
          li.replaceChild(item.firstElementChild, item)
        }
      }
    }

    const htmlBlocks = wrapper.querySelectorAll<HTMLElement>("figure[data-role='HTML']")
    for (const htmlBlock of Array.from(htmlBlocks)) {
      const codeContent = htmlBlock.querySelector<HTMLElement>('.ag-code-content')
      const pre = document.createElement('pre')
      pre.textContent = codeContent?.textContent ?? ''
      htmlBlock.replaceWith(pre)
    }

    // Just work for turndown, turndown will add `leading` and `traling` space in line-break.
    const lineBreaks = wrapper.querySelectorAll<HTMLElement>('span.ag-soft-line-break, span.ag-hard-line-break')
    for (const lineBreak of Array.from(lineBreaks)) {
      lineBreak.innerHTML = ''
    }

    const mathBlocks = wrapper.querySelectorAll<HTMLElement>('figure.ag-container-block')
    for (const mathBlock of Array.from(mathBlocks)) {
      const preElement = mathBlock.querySelector<HTMLElement>('pre[data-role]')
      const functionType = preElement?.getAttribute('data-role')
      const codeContent = mathBlock.querySelector<HTMLElement>('.ag-code-content')
      const value = codeContent?.textContent ?? ''
      let pre: HTMLPreElement
      switch (functionType) {
        case 'multiplemath':
          pre = document.createElement('pre')
          pre.classList.add('multiple-math')
          pre.textContent = value
          mathBlock.replaceWith(pre)
          break
        case 'mermaid':
        case 'flowchart':
        case 'sequence':
        case 'plantuml':
        case 'vega-lite':
          pre = document.createElement('pre')
          pre.innerHTML = `<code class="language-${functionType}">${value}</code>`
          mathBlock.replaceWith(pre)
          break
      }
    }

    let htmlData = wrapper.innerHTML
    const textData = this.htmlToMarkdown(htmlData)
    htmlData = marked(textData)

    return { html: htmlData, text: textData }
  }

  prototype.docCopyHandler = function (event: ClipboardEvent): void {
    const { selectedTableCells } = this
    if (selectedTableCells) {
      event.preventDefault()
      const clipboardData = event.clipboardData as DataTransfer
      const { row, column, cells } = selectedTableCells
      const tableContents: TableCellContentLike[][] = []

      for (let i = 0; i < row; i++) {
        const rowWrapper: TableCellContentLike[] = []
        for (let j = 0; j < column; j++) {
          const cell = cells[i * column + j] as TableCellContentLike
          rowWrapper.push({
            text: cell.text,
            align: cell.align
          })
        }
        tableContents.push(rowWrapper)
      }

      if (row === 1 && column === 1) {
        // Copy cells text if only one is selected
        if (tableContents[0]?.[0]?.text.length > 0) {
          clipboardData.setData('text/html', '')
          clipboardData.setData('text/plain', tableContents[0][0].text)
        }
      } else {
        // Copy as markdown table
        const figureBlock = this.createBlock('figure', {
          functionType: 'table'
        })
        const table = this.createTableInFigure({ rows: row, columns: column }, tableContents)
        this.appendChild(figureBlock, table)
        const { isGitlabCompatibilityEnabled, listIndentation } = this
        const markdown = new ExportMarkdownCtor([figureBlock], listIndentation, isGitlabCompatibilityEnabled).generate()
        if (markdown.length > 0) {
          clipboardData.setData('text/html', '')
          clipboardData.setData('text/plain', markdown)
        }
      }
    }
  }

  prototype.copyHandler = function (
    event: ClipboardEvent,
    type: CopyHandlerType,
    copyInfo: string | BlockLike | null = null
  ): void {
    if (this.selectedTableCells) {
      // Hand over to docCopyHandler
      return
    }

    event.preventDefault()
    const clipboardData = event.clipboardData as DataTransfer
    const { selectedImage } = this
    if (selectedImage) {
      const { token } = selectedImage
      if (typeof token.raw === 'string' && token.raw.length > 0) {
        clipboardData.setData('text/html', token.raw)
        clipboardData.setData('text/plain', token.raw)
      }
      return
    }

    const { html, text } = this.getClipBoardData()
    switch (type) {
      case 'normal': {
        if (text.length > 0) {
          clipboardData.setData('text/html', html)
          clipboardData.setData('text/plain', text)
        }
        break
      }
      case 'copyAsMarkdown': {
        if (text.length > 0) {
          clipboardData.setData('text/html', '')
          clipboardData.setData('text/plain', text)
        }
        break
      }
      case 'copyAsHtml': {
        if (text.length > 0) {
          clipboardData.setData('text/html', '')
          clipboardData.setData('text/plain', getSanitizeHtmlFn(text, {
            superSubScript: this.muya.options.superSubScript,
            footnote: this.muya.options.footnote,
            isGitlabCompatibilityEnabled: this.muya.options.isGitlabCompatibilityEnabled
          }))
        }
        break
      }
      case 'copyBlock': {
        const block = typeof copyInfo === 'string'
          ? this.getBlock(copyInfo)
          : copyInfo
        if (!block) return
        const anchor = this.getAnchor(block) as BlockLike
        const { isGitlabCompatibilityEnabled, listIndentation } = this
        const markdown = new ExportMarkdownCtor([anchor], listIndentation, isGitlabCompatibilityEnabled).generate()
        if (markdown.length > 0) {
          clipboardData.setData('text/html', '')
          clipboardData.setData('text/plain', markdown)
        }
        break
      }
      case 'copyCodeContent': {
        const codeContent = copyInfo
        if (typeof codeContent !== 'string') {
          return
        }
        if (codeContent.length > 0) {
          clipboardData.setData('text/html', '')
          clipboardData.setData('text/plain', codeContent)
        }
      }
    }
  }
}

export default copyCutCtrl
