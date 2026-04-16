import ContentState from './contentState'
import EventCenter from './eventHandler/event'
import MouseEvent from './eventHandler/mouseEvent'
import Clipboard from './eventHandler/clipboard'
import Keyboard from './eventHandler/keyboard'
import DragDrop from './eventHandler/dragDrop'
import Resize from './eventHandler/resize'
import ClickEvent from './eventHandler/clickEvent'
import { CLASS_OR_ID, MUYA_DEFAULT_OPTION } from './config'
import { wordCount } from './utils'
import ExportMarkdown from './utils/exportMarkdown'
import ExportHtml from './utils/exportHtml'
import ToolTip from './ui/tooltip'
import './assets/styles/index.css'

type ListIndentation = number | 'dfm'

interface CursorPosition {
  key: string
  offset: number
  [key: string]: unknown
}

interface CursorRangeLike extends Record<string, unknown> {
  anchor?: CursorPosition
  focus?: CursorPosition
}

interface CursorMarkdownResult {
  markdown: string
  isValid: boolean
}

interface HistorySnapshot {
  stack: unknown[]
  index: number
}

interface StateRenderLike {
  setContainer(container: Element | null): void
  invalidateImageCache(): void
}

interface HistoryLike {
  clearHistory(): void
  undo(): void
  redo(): void
}

interface FormatDescriptor {
  type: string
  [key: string]: unknown
}

interface SelectionFormatsResult {
  formats: FormatDescriptor[]
}

interface SearchMatches extends Record<string, unknown> {
  index: number
  matches: unknown[]
  value: string
}

interface SelectionSnapshotLike extends Record<string, unknown> {
  cursorCoords: {
    y: number
    [key: string]: unknown
  }
}

interface TableCheckerLike {
  rows: number
  columns: number
  [key: string]: unknown
}

interface ImageInfoLike extends Record<string, unknown> {
  src: string
}

interface FontOptions {
  fontSize?: number
  lineHeight?: number
}

interface SearchOptionsLike extends Record<string, unknown> {
  isCaseSensitive?: boolean
  isWholeWord?: boolean
  isRegexp?: boolean
  isSingle?: boolean
  selectHighlight?: boolean
}

interface ContentStateLike {
  stateRender: StateRenderLike
  history: HistoryLike
  searchMatches: SearchMatches
  turndownConfig: Record<string, unknown>
  listIndentation: ListIndentation
  isGitlabCompatibilityEnabled: boolean
  selectedImage: unknown
  selectedTableCells: unknown
  tabSize: number
  getBlocks(): unknown[]
  getHistory(): HistorySnapshot
  setHistory(history: HistorySnapshot): void
  getTOC(): unknown
  selectionChange(): unknown
  selectionFormats(): SelectionFormatsResult
  getCodeMirrorCursor(): unknown
  addCursorToMarkdown(markdown: string, cursor: CursorRangeLike): CursorMarkdownResult
  importMarkdown(markdown: string): void
  importCursor(cursor: unknown): void
  render(isRenderCursor?: boolean, clearCache?: boolean): void
  setCursor(): void
  createTable(tableChecker: TableCheckerLike): void
  updateParagraph(type: string): void
  duplicate(): void
  deleteParagraph(): void
  insertParagraph(location: string, text?: string, outMost?: boolean): void
  editTable(data: unknown): void
  format(type: string): void
  insertImage(imageInfo: ImageInfoLike): void
  search(value: string, options: SearchOptionsLike): void
  replace(value: string, options: SearchOptionsLike): void
  find(action: string): void
  selectAll(): void
  extractImages(markdown: string): unknown
  clear(): void
  replaceWordInline(line: unknown, wordCursor: unknown, replacement: string, setCursor?: boolean): void
  _replaceCurrentWordInlineUnsafe(word: string, replacement: string): boolean
}

interface DestroyableLike {
  destroy(): void
}

interface ClipboardLike {
  copyAsMarkdown(): void
  copyAsHtml(): void
  pasteAsPlainText(): void
  copy(type: string, info: unknown): unknown
}

interface KeyboardLike {
  hideAllFloatTools(): void
}

type ListIndentationInput = number | string

interface MuyaOptions {
  fontSize: number
  lineHeight: number
  focusMode: boolean
  markdown: string
  trimUnnecessaryCodeBlockEmptyLines: boolean
  preferLooseListItem: boolean
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  bulletListMarker: string
  orderListDelimiter: string
  tabSize: number
  codeBlockLineNumbers: boolean
  listIndentation: ListIndentationInput
  frontmatterType: string
  sequenceTheme: string
  mermaidTheme: string
  vegaTheme: string
  hideQuickInsertHint: boolean
  hideLinkPopup: boolean
  autoCheck: boolean
  spellcheckEnabled: boolean
  imageAction: ((image: never, id?: string, alt?: string) => Promise<string>) | null
  imagePathPicker: (() => string | Promise<string>) | null
  clipboardFilePath: (...args: unknown[]) => string
  imagePathAutoComplete: (src: string) => Promise<unknown[]>
  superSubScript: boolean
  footnote: boolean
  isGitlabCompatibilityEnabled: boolean
  disableHtml: boolean
}

type MuyaOptionsInput = Partial<MuyaOptions>

interface MuyaInstance extends Record<string, unknown> {
  container: HTMLElement
  options: MuyaOptions
  eventCenter: EventCenter
  contentState: ContentStateLike
  keyboard?: KeyboardLike
  dispatchChange(): void
  dispatchSelectionChange(): void
  blur(isRemoveAllRange?: boolean, unSelect?: boolean): void
}

interface MuyaPluginConstructor {
  new (muya: MuyaInstance, options?: Record<string, unknown>): unknown
  pluginName: string
}

interface PluginRegistration {
  plugin: MuyaPluginConstructor
  options: Record<string, unknown>
}

type ContentStateConstructor = new (muya: MuyaInstance, options: MuyaOptions) => ContentStateLike

type ExportMarkdownConstructor = new (
  blocks: unknown[],
  listIndentation?: ListIndentation,
  isGitlabCompatibilityEnabled?: boolean
) => {
  generate(): string
}

type ExportHtmlConstructor = new (markdown: string, muya: MuyaInstance) => {
  generate(options: Record<string, unknown>): Promise<string>
  renderHtml(): Promise<string>
}

type ClipboardConstructor = new (muya: MuyaInstance) => ClipboardLike
type KeyboardConstructor = new (muya: MuyaInstance) => KeyboardLike
type DestroyableConstructor = new (muya: MuyaInstance) => unknown
type ToolTipConstructor = new (muya: MuyaInstance) => unknown

const ContentStateCtor = ContentState as unknown as ContentStateConstructor
const ClipboardCtor = Clipboard as unknown as ClipboardConstructor
const KeyboardCtor = Keyboard as unknown as KeyboardConstructor
const MouseEventCtor = MouseEvent as unknown as DestroyableConstructor
const DragDropCtor = DragDrop as unknown as DestroyableConstructor
const ResizeCtor = Resize as unknown as DestroyableConstructor
const ClickEventCtor = ClickEvent as unknown as DestroyableConstructor
const ExportMarkdownCtor = ExportMarkdown as unknown as ExportMarkdownConstructor
const ExportHtmlCtor = ExportHtml as unknown as ExportHtmlConstructor
const ToolTipCtor = ToolTip as unknown as ToolTipConstructor

// Preserve the legacy defaults until `config/index.ts` reaches parity with `config/index.js`.
const MUYA_RUNTIME_DEFAULT_OPTION = Object.freeze({
  ...(MUYA_DEFAULT_OPTION as Partial<MuyaOptions>),
  codeBlockLineNumbers: false,
  listIndentation: 1 as ListIndentationInput,
  frontmatterType: '-',
  spellcheckEnabled: false,
  imageAction: null,
  imagePathPicker: null,
  clipboardFilePath: () => '',
  imagePathAutoComplete: async () => [],
  superSubScript: false,
  footnote: false,
  isGitlabCompatibilityEnabled: false,
  disableHtml: true
}) as MuyaOptions

class Muya {
  static plugins: PluginRegistration[] = []

  options: MuyaOptions
  markdown: string
  container: HTMLDivElement
  eventCenter: EventCenter
  tooltip: unknown
  contentState: ContentStateLike
  clipboard: ClipboardLike
  clickEvent: unknown
  keyboard: KeyboardLike
  dragdrop: unknown
  resize: unknown
  mouseEvent: unknown
  quickInsert!: DestroyableLike
  codePicker!: DestroyableLike
  tablePicker!: DestroyableLike
  emojiPicker!: DestroyableLike
  imagePathPicker!: DestroyableLike

  static use (plugin: MuyaPluginConstructor, options: Record<string, unknown> = {}): void {
    this.plugins.push({
      plugin,
      options
    })
  }

  constructor (container: HTMLElement, options: MuyaOptionsInput = {}) {
    const muya = this as unknown as MuyaInstance
    this.options = Object.assign({}, MUYA_RUNTIME_DEFAULT_OPTION, options)
    const { markdown } = this.options
    this.markdown = markdown
    this.container = getContainer(container, this.options)
    this.eventCenter = new EventCenter()
    this.tooltip = new ToolTipCtor(muya)
    if (Muya.plugins.length) {
      const pluginHost = this as Muya & Record<string, unknown>
      for (const { plugin: Plugin, options: pluginOptions } of Muya.plugins) {
        pluginHost[Plugin.pluginName] = new Plugin(muya, pluginOptions)
      }
    }

    this.contentState = new ContentStateCtor(muya, this.options)
    this.clipboard = new ClipboardCtor(muya)
    this.clickEvent = new ClickEventCtor(muya)
    this.keyboard = new KeyboardCtor(muya)
    this.dragdrop = new DragDropCtor(muya)
    this.resize = new ResizeCtor(muya)
    this.mouseEvent = new MouseEventCtor(muya)
    this.init()
  }

  init (): void {
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0] ?? null)
    eventCenter.subscribe('stateChange', this.dispatchChange)
    const { markdown } = this
    const { focusMode } = this.options
    this.setMarkdown(markdown)
    this.setFocusMode(focusMode)
    this.mutationObserver()
    eventCenter.attachDOMEvent(container, 'focus', () => {
      eventCenter.dispatch('focus')
    })
    eventCenter.attachDOMEvent(container, 'blur', () => {
      eventCenter.dispatch('blur')
    })
  }

  mutationObserver (): void {
    const { container, eventCenter } = this
    const config: MutationObserverInit = { childList: true, subtree: true }
    const callback: MutationCallback = mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          const { removedNodes, target } = mutation
          if (removedNodes.length) {
            const hasTable = Array.from(removedNodes).some(node => {
              return node instanceof Element && !!node.closest('table.ag-paragraph')
            })
            if (hasTable) {
              eventCenter.dispatch('crashed')
              console.warn('There was a problem with the table deletion.')
            }
          }

          if (
            target instanceof Element &&
            target.getAttribute('id') === 'ag-editor-id' &&
            target.childElementCount === 0
          ) {
            eventCenter.dispatch('crashed')
            console.warn('editor crashed, and can not be input any more.')
          }
        }
      }
    }

    const observer = new MutationObserver(callback)
    observer.observe(container, config)
  }

  dispatchChange = (): void => {
    const { eventCenter } = this
    const markdown = this.markdown = this.getMarkdown()
    const currentWordCount = this.getWordCount(markdown)
    const cursor = this.getCursor()
    const history = this.getHistory()
    const toc = this.getTOC()

    eventCenter.dispatch('change', {
      markdown,
      wordCount: currentWordCount,
      cursor,
      history,
      toc
    })
  }

  dispatchSelectionChange = (): void => {
    const selectionChanges = this.contentState.selectionChange()
    this.eventCenter.dispatch('selectionChange', selectionChanges)
  }

  dispatchSelectionFormats = (): void => {
    const { formats } = this.contentState.selectionFormats()
    this.eventCenter.dispatch('selectionFormats', formats)
  }

  getMarkdown (): string {
    const blocks = this.contentState.getBlocks()
    const { isGitlabCompatibilityEnabled, listIndentation } = this.contentState
    return new ExportMarkdownCtor(blocks, listIndentation, isGitlabCompatibilityEnabled).generate()
  }

  getHistory (): HistorySnapshot {
    return this.contentState.getHistory()
  }

  getTOC (): unknown {
    return this.contentState.getTOC()
  }

  setHistory (history: HistorySnapshot): void {
    return this.contentState.setHistory(history)
  }

  clearHistory (): void {
    return this.contentState.history.clearHistory()
  }

  exportStyledHTML (options: Record<string, unknown>): Promise<string> {
    const { markdown } = this
    return new ExportHtmlCtor(markdown, this as unknown as MuyaInstance).generate(options)
  }

  exportHtml (): Promise<string> {
    const { markdown } = this
    return new ExportHtmlCtor(markdown, this as unknown as MuyaInstance).renderHtml()
  }

  getWordCount (markdown: string): ReturnType<typeof wordCount> {
    return wordCount(markdown)
  }

  getCursor (): unknown {
    return this.contentState.getCodeMirrorCursor()
  }

  setMarkdown (markdown: string, cursor?: CursorRangeLike | null, isRenderCursor = true): void {
    let newMarkdown = markdown
    let isValid = false
    if (cursor && cursor.anchor && cursor.focus) {
      const cursorInfo = this.contentState.addCursorToMarkdown(markdown, cursor)
      newMarkdown = cursorInfo.markdown
      isValid = cursorInfo.isValid
    }
    this.contentState.importMarkdown(newMarkdown)
    this.contentState.importCursor(cursor && isValid)
    this.contentState.render(isRenderCursor)
    setTimeout(() => {
      this.dispatchChange()
    }, 0)
  }

  setCursor (cursor: CursorRangeLike): void {
    const markdown = this.getMarkdown()
    return this.setMarkdown(markdown, cursor, true)
  }

  createTable (tableChecker: TableCheckerLike): unknown {
    return this.contentState.createTable(tableChecker)
  }

  getSelection (): SelectionSnapshotLike {
    return this.contentState.selectionChange() as SelectionSnapshotLike
  }

  setFocusMode (bool: boolean): void {
    const { container } = this
    const { focusMode } = this.options
    if (bool && !focusMode) {
      container.classList.add(CLASS_OR_ID.AG_FOCUS_MODE)
    } else {
      container.classList.remove(CLASS_OR_ID.AG_FOCUS_MODE)
    }
    this.options.focusMode = bool
  }

  setFont ({ fontSize, lineHeight }: FontOptions): void {
    if (fontSize) {
      this.options.fontSize = fontSize
    }
    if (lineHeight) {
      this.options.lineHeight = lineHeight
    }
    this.contentState.render(false)
  }

  setTabSize (tabSize: number): void {
    if (!tabSize || typeof tabSize !== 'number') {
      tabSize = 4
    } else if (tabSize < 1) {
      tabSize = 1
    } else if (tabSize > 4) {
      tabSize = 4
    }
    this.contentState.tabSize = tabSize
  }

  setListIndentation (listIndentation: MuyaOptions['listIndentation']): void {
    if (typeof listIndentation === 'number') {
      if (listIndentation < 1 || listIndentation > 4) {
        listIndentation = 1
      }
    } else if (listIndentation !== 'dfm') {
      listIndentation = 1
    }
    this.contentState.listIndentation = listIndentation
  }

  updateParagraph (type: string): void {
    this.contentState.updateParagraph(type)
  }

  duplicate (): void {
    this.contentState.duplicate()
  }

  deleteParagraph (): void {
    this.contentState.deleteParagraph()
  }

  insertParagraph (location: string, text = '', outMost = false): void {
    this.contentState.insertParagraph(location, text, outMost)
  }

  editTable (data: unknown): void {
    this.contentState.editTable(data)
  }

  hasFocus (): boolean {
    return document.activeElement === this.container
  }

  focus (): void {
    this.contentState.setCursor()
    this.container.focus()
  }

  blur (isRemoveAllRange = false, unSelect = false): void {
    if (isRemoveAllRange) {
      const selection = document.getSelection()
      if (selection) {
        selection.removeAllRanges()
      }
    }

    if (unSelect) {
      this.contentState.selectedImage = null
      this.contentState.selectedTableCells = null
    }

    this.hideAllFloatTools()
    this.container.blur()
  }

  format (type: string): void {
    this.contentState.format(type)
  }

  insertImage (imageInfo: ImageInfoLike): void {
    this.contentState.insertImage(imageInfo)
  }

  search (value: string, options: SearchOptionsLike = {}): SearchMatches {
    const { selectHighlight } = options
    this.contentState.search(value, options)
    this.contentState.render(!!selectHighlight)
    return this.contentState.searchMatches
  }

  replace (value: string, options: SearchOptionsLike = {}): SearchMatches {
    this.contentState.replace(value, options)
    this.contentState.render(false)
    return this.contentState.searchMatches
  }

  find (action: string): SearchMatches {
    this.contentState.find(action)
    this.contentState.render(false)
    return this.contentState.searchMatches
  }

  on (event: string, listener: (...args: unknown[]) => void): void {
    this.eventCenter.subscribe(event, listener)
  }

  off (event: string, listener: (...args: unknown[]) => void): void {
    this.eventCenter.unsubscribe(event, listener)
  }

  once (event: string, listener: (...args: unknown[]) => void): void {
    this.eventCenter.subscribeOnce(event, listener)
  }

  invalidateImageCache (): void {
    this.contentState.stateRender.invalidateImageCache()
    this.contentState.render(true)
  }

  undo (): void {
    this.contentState.history.undo()
    this.dispatchSelectionChange()
    this.dispatchSelectionFormats()
    this.dispatchChange()
  }

  redo (): void {
    this.contentState.history.redo()
    this.dispatchSelectionChange()
    this.dispatchSelectionFormats()
    this.dispatchChange()
  }

  selectAll (): void {
    if (!this.hasFocus() && !this.contentState.selectedTableCells) {
      return
    }
    this.contentState.selectAll()
  }

  extractImages (markdown = this.markdown): unknown {
    return this.contentState.extractImages(markdown)
  }

  copyAsMarkdown (): void {
    this.clipboard.copyAsMarkdown()
  }

  copyAsHtml (): void {
    this.clipboard.copyAsHtml()
  }

  pasteAsPlainText (): void {
    this.clipboard.pasteAsPlainText()
  }

  copy (info: unknown): unknown {
    return this.clipboard.copy('copyBlock', info)
  }

  setOptions (options: MuyaOptionsInput, needRender = false): void {
    if (options.codeBlockLineNumbers) {
      options.codeBlockLineNumbers = false
    }

    Object.assign(this.options, options)
    if (needRender) {
      this.contentState.render(false, true)
    }

    const { hideQuickInsertHint, spellcheckEnabled, bulletListMarker } = options
    if (typeof hideQuickInsertHint !== 'undefined') {
      const hasClass = this.container.classList.contains('ag-show-quick-insert-hint')
      if (hideQuickInsertHint && hasClass) {
        this.container.classList.remove('ag-show-quick-insert-hint')
      } else if (!hideQuickInsertHint && !hasClass) {
        this.container.classList.add('ag-show-quick-insert-hint')
      }
    }

    if (typeof spellcheckEnabled !== 'undefined') {
      this.container.setAttribute('spellcheck', String(!!spellcheckEnabled))
    }

    if (bulletListMarker) {
      this.contentState.turndownConfig.bulletListMarker = bulletListMarker
    }
  }

  hideAllFloatTools (): void {
    return this.keyboard.hideAllFloatTools()
  }

  replaceWordInline (line: unknown, wordCursor: unknown, replacement: string, setCursor = false): void {
    this.contentState.replaceWordInline(line, wordCursor, replacement, setCursor)
  }

  _replaceCurrentWordInlineUnsafe (word: string, replacement: string): boolean {
    return this.contentState._replaceCurrentWordInlineUnsafe(word, replacement)
  }

  destroy (): void {
    this.contentState.clear()
    this.quickInsert.destroy()
    this.codePicker.destroy()
    this.tablePicker.destroy()
    this.emojiPicker.destroy()
    this.imagePathPicker.destroy()
    this.eventCenter.detachAllDomEvents()
  }
}

function getContainer (
  originContainer: HTMLElement,
  options: Pick<MuyaOptions, 'hideQuickInsertHint' | 'spellcheckEnabled'>
): HTMLDivElement {
  const { hideQuickInsertHint, spellcheckEnabled } = options
  const container = document.createElement('div')
  const rootDom = document.createElement('div')
  const attrs = originContainer.attributes
  Array.from(attrs).forEach(attr => {
    container.setAttribute(attr.name, attr.value)
  })

  if (!hideQuickInsertHint) {
    container.classList.add('ag-show-quick-insert-hint')
  }

  container.setAttribute('contenteditable', String(true))
  container.setAttribute('autocorrect', String(false))
  container.setAttribute('autocomplete', 'off')
  container.setAttribute('spellcheck', String(!!spellcheckEnabled))
  container.appendChild(rootDom)
  originContainer.replaceWith(container)
  return container
}

export default Muya
