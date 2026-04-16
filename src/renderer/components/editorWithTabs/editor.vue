<template>
  <div
    class="editor-wrapper"
    :class="[{ 'typewriter': typewriter, 'focus': focus, 'source': sourceCode }]"
    :style="{ 'lineHeight': lineHeight, 'fontSize': `${fontSize}px`,
    'font-family': editorFontFamily ? `${editorFontFamily}, ${defaultFontFamily}` : `${defaultFontFamily}` }"
    :dir="textDirection"
  >
    <div
      ref="editor"
      class="editor-component"
    ></div>
    <div
      class="image-viewer"
      v-show="imageViewerVisible"
    >
      <span class="icon-close" @click="setImageViewerVisible(false)">
        <svg :viewBox="CloseIcon.viewBox">
          <use :xlink:href="CloseIcon.url"></use>
        </svg>
      </span>
      <div
        ref="imageViewer"
      >
      </div>
    </div>
    <el-dialog
      :visible.sync="dialogTableVisible"
      :show-close="isShowClose"
      :modal="true"
      custom-class="ag-dialog-table"
      width="454px"
      center
      dir='ltr'
    >
      <div slot="title" class="dialog-title">
        Insert Table
      </div>
      <el-form :model="tableChecker" :inline="true">
        <el-form-item label="Rows">
          <el-input-number
            ref="rowInput"
            size="mini"
            v-model="tableChecker.rows"
            controls-position="right"
            :min="1"
            :max="30"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number
            size="mini"
            v-model="tableChecker.columns"
            controls-position="right"
            :min="1"
            :max="20"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogTableVisible = false">
          Cancel
        </el-button>
        <el-button type="primary" @click="handleDialogTableConfirm">
          OK
        </el-button>
      </div>
    </el-dialog>
    <search
      v-if="!sourceCode"
    ></search>
  </div>
</template>

<script lang="ts">
import Vue, { type PropType } from 'vue'
import { shell } from 'electron'
import path from 'path'
import log from 'electron-log'
// import ViewImage from 'view-image'
import { isChildOfDirectory } from 'common/filesystem/paths'
import Muya from 'muya/lib'
import TablePicker from 'muya/lib/ui/tablePicker'
import QuickInsert from 'muya/lib/ui/quickInsert'
import CodePicker from 'muya/lib/ui/codePicker'
import EmojiPicker from 'muya/lib/ui/emojiPicker'
import ImagePathPicker from 'muya/lib/ui/imagePicker'
import ImageSelector from 'muya/lib/ui/imageSelector'
import ImageToolbar from 'muya/lib/ui/imageToolbar'
import Transformer from 'muya/lib/ui/transformer'
import FormatPicker from 'muya/lib/ui/formatPicker'
import LinkTools from 'muya/lib/ui/linkTools'
import FootnoteTool from 'muya/lib/ui/footnoteTool'
import TableBarTools from 'muya/lib/ui/tableTools'
import FrontMenu from 'muya/lib/ui/frontMenu'
import Search from '../search/index.vue'
import bus from '@/bus'
import { DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import notice from '@/services/notification'
import Printer from '@/services/printService'
import { SpellcheckerLanguageCommand } from '@/commands'
import { SpellChecker } from '@/spellchecker'
import { isOsx, animatedScrollTo } from '@/util'
import { moveImageToFolder, moveToRelativeFolder, uploadImage } from '@/util/fileSystem'
import { guessClipboardFilePath } from '@/util/clipboard'
import { getCssForOptions, getHtmlToc } from '@/util/pdf'
import { addCommonStyle, setEditorWidth } from '@/util/theme'
import type { TextDirection } from 'common/types/preferences'
import type { DocumentState, HistoryState, SearchMatches, WordCount } from '@/store/help'
import type { PreferencesState } from '@/store/preferences'
import type { TreeFolderEntry } from '@/store/treeCtrl'

import 'muya/themes/default.css'
import '@/assets/themes/codemirror/one-dark.css'
// import 'view-image/lib/imgViewer.css'
import CloseIcon from '@/assets/icons/close.svg'

const STANDAR_Y = 320

type ImageInput = Parameters<typeof moveImageToFolder>[1]
type UploadPreferences = Parameters<typeof uploadImage>[2]
type PdfHelperOptions = Parameters<typeof getCssForOptions>[0]
type CopyPasteAction = 'copyAsMarkdown' | 'copyAsHtml' | 'pasteAsPlainText'
type FindAction = 'prev' | 'next'
type ParagraphAction = 'duplicate' | 'createParagraph' | 'deleteParagraph'

interface EditorStoreState {
  preferences: PreferencesState
  editor: {
    currentFile: DocumentState
  }
  project: {
    projectTree: TreeFolderEntry | null
  }
}

interface EditorCursorPayload extends Record<string, unknown> {
  anchor?: unknown
  focus?: unknown
}

interface TableChecker {
  rows: number
  columns: number
}

interface SearchOptions {
  isCaseSensitive?: boolean
  isWholeWord?: boolean
  isRegexp?: boolean
  selectHighlight?: boolean
}

interface ReplaceOptions extends SearchOptions {
  isSingle?: boolean
}

interface LinkInfo {
  href: string
}

interface DestroyableLike {
  destroy(): void
}

interface ReplaceMisspellingPayload {
  word: string
  replacement: string
}

interface ImageAutoPathEntry {
  file: string
  type: 'directory' | 'image'
}

interface ImageAutoPathOption extends ImageAutoPathEntry {
  iconClass: 'icon-folder' | 'icon-image'
  text: string
}

interface EditorSelectionSnapshot {
  cursorCoords: {
    y: number
  }
}

interface EditorSelectionChangePayload extends Record<string, unknown> {
  cursorCoords: {
    y: number
  }
}

interface TocItem {
  lvl: number
  content: string
  [key: string]: unknown
}

interface MuyaChangePayload {
  markdown: string
  wordCount: WordCount
  cursor: EditorCursorPayload | null
  history: HistoryState
  toc: TocItem[]
}

interface FormatClickPayload {
  event: MouseEvent
  formatType: string
  data: unknown
}

type ExportOptions = PdfHelperOptions & {
  type: string
  header?: string
  footer?: string
  headerFooterStyled?: boolean
  htmlTitle?: string
  pageSize?: unknown
  pageSizeWidth?: unknown
  pageSizeHeight?: unknown
  isLandscape?: boolean
}

interface FileLoadedPayload {
  markdown: string
  cursor?: EditorCursorPayload | null
}

interface FileChangedPayload {
  markdown?: string
  cursor?: EditorCursorPayload | null
  renderCursor?: boolean
  history?: HistoryState
}

interface ThemeOptions {
  mermaidTheme: 'dark' | 'default'
  vegaTheme: 'dark' | 'latimes'
}

interface MuyaOptions extends ThemeOptions {
  focusMode: boolean
  markdown: string
  preferLooseListItem: boolean
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  autoPairQuote: boolean
  bulletListMarker: string
  orderListDelimiter: string
  tabSize: number
  fontSize: number
  lineHeight: number
  codeBlockLineNumbers: boolean
  listIndentation: PreferencesState['listIndentation']
  frontmatterType: string
  superSubScript: boolean
  footnote: boolean
  disableHtml: boolean
  isGitlabCompatibilityEnabled: boolean
  hideQuickInsertHint: boolean
  hideLinkPopup: boolean
  autoCheck: boolean
  sequenceTheme: string
  spellcheckEnabled: boolean
  imageAction: (image: ImageInput, id?: string, alt?: string) => Promise<string>
    imagePathPicker: () => string | Promise<string>
  clipboardFilePath: typeof guessClipboardFilePath
  imagePathAutoComplete: (src: string) => Promise<ImageAutoPathOption[]>
}

interface MuyaLike {
  container: HTMLElement
  contentState: {
    selectedTableCells: unknown
  }
  setFocusMode(value: boolean): void
  setFont(options: { fontSize?: number, lineHeight?: number }): void
  setOptions(options: Record<string, unknown>, needRender?: boolean): void
  setTabSize(value: number): void
  setListIndentation(value: PreferencesState['listIndentation']): void
  hideAllFloatTools(): void
  invalidateImageCache(): void
  _replaceCurrentWordInlineUnsafe(word: string, replacement: string): boolean
  undo(): void
  redo(): void
  hasFocus(): boolean
  selectAll(): void
  copyAsMarkdown(): void
  copyAsHtml(): void
  pasteAsPlainText(): void
  insertImage(imageInfo: { src: string }): void
  search(value: string, opt?: SearchOptions): SearchMatches
  replace(value: string, opt?: ReplaceOptions): SearchMatches
  getSelection(): EditorSelectionSnapshot
  find(action: FindAction): SearchMatches
  getTOC(): TocItem[]
  exportStyledHTML(options: Record<string, unknown>): Promise<string>
  updateParagraph(type: string): void
  duplicate(): void
  insertParagraph(location: string, text?: string, outMost?: boolean): void
  deleteParagraph(): void
  format(type: string): void
  createTable(tableChecker: TableChecker): void
  clearHistory(): void
  setMarkdown(markdown: string, cursor?: EditorCursorPayload | null, isRenderCursor?: boolean): void
  setHistory(history: HistoryState): void
  setCursor(cursor: EditorCursorPayload): void
  blur(isRemoveAllRange?: boolean, unSelect?: boolean): void
  focus(): void
  destroy(): void
  on(event: 'change', listener: (changes: MuyaChangePayload) => void): void
  on(event: 'format-click', listener: (payload: FormatClickPayload) => void): void
  on(event: 'selectionChange', listener: (changes: EditorSelectionChangePayload) => void): void
  on(event: 'selectionFormats', listener: (formats: Array<{ type: string }>) => void): void
}

const getStoreState = (vm: Vue): EditorStoreState => vm.$store.state as EditorStoreState

const getThemeOptions = (theme: string): ThemeOptions => {
  return /dark/i.test(theme)
    ? { mermaidTheme: 'dark', vegaTheme: 'dark' }
    : { mermaidTheme: 'default', vegaTheme: 'latimes' }
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const isTextInputElement = (element: Element | null): element is HTMLInputElement | HTMLTextAreaElement => {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
}

export default Vue.extend({
  components: {
    Search
  },

  props: {
    markdown: {
      type: String,
      default: ''
    },
    cursor: {
      type: Object as PropType<EditorCursorPayload | null>,
      default: null
    },
    textDirection: {
      type: String as PropType<TextDirection>,
      required: true
    },
    platform: {
      type: String,
      default: ''
    }
  },

  computed: {
    preferences (): PreferencesState {
      return getStoreState(this).preferences
    },
    preferLooseListItem (): boolean {
      return this.preferences.preferLooseListItem
    },
    autoPairBracket (): boolean {
      return this.preferences.autoPairBracket
    },
    autoPairMarkdownSyntax (): boolean {
      return this.preferences.autoPairMarkdownSyntax
    },
    autoPairQuote (): boolean {
      return this.preferences.autoPairQuote
    },
    bulletListMarker (): string {
      return this.preferences.bulletListMarker
    },
    orderListDelimiter (): string {
      return this.preferences.orderListDelimiter
    },
    tabSize (): number {
      return this.preferences.tabSize
    },
    listIndentation (): PreferencesState['listIndentation'] {
      return this.preferences.listIndentation
    },
    frontmatterType (): string {
      return this.preferences.frontmatterType
    },
    superSubScript (): boolean {
      return this.preferences.superSubScript
    },
    footnote (): boolean {
      return this.preferences.footnote
    },
    isHtmlEnabled (): boolean {
      return this.preferences.isHtmlEnabled
    },
    isGitlabCompatibilityEnabled (): boolean {
      return this.preferences.isGitlabCompatibilityEnabled
    },
    lineHeight (): number {
      return this.preferences.lineHeight
    },
    fontSize (): number {
      return this.preferences.fontSize
    },
    codeFontSize (): number {
      return this.preferences.codeFontSize
    },
    codeFontFamily (): string {
      return this.preferences.codeFontFamily
    },
    codeBlockLineNumbers (): boolean {
      return this.preferences.codeBlockLineNumbers
    },
    trimUnnecessaryCodeBlockEmptyLines (): boolean {
      return this.preferences.trimUnnecessaryCodeBlockEmptyLines
    },
    editorFontFamily (): string {
      return this.preferences.editorFontFamily
    },
    hideQuickInsertHint (): boolean {
      return this.preferences.hideQuickInsertHint
    },
    hideLinkPopup (): boolean {
      return this.preferences.hideLinkPopup
    },
    autoCheck (): boolean {
      return this.preferences.autoCheck
    },
    editorLineWidth (): string {
      return this.preferences.editorLineWidth
    },
    imageInsertAction (): string {
      return this.preferences.imageInsertAction
    },
    imagePreferRelativeDirectory (): boolean {
      return this.preferences.imagePreferRelativeDirectory
    },
    imageRelativeDirectoryName (): string {
      return this.preferences.imageRelativeDirectoryName
    },
    imageFolderPath (): string {
      return this.preferences.imageFolderPath
    },
    theme (): string {
      return this.preferences.theme
    },
    sequenceTheme (): string {
      return this.preferences.sequenceTheme
    },
    hideScrollbar (): boolean {
      return this.preferences.hideScrollbar
    },
    spellcheckerEnabled (): boolean {
      return this.preferences.spellcheckerEnabled
    },
    spellcheckerNoUnderline (): boolean {
      return this.preferences.spellcheckerNoUnderline
    },
    spellcheckerLanguage (): string {
      return this.preferences.spellcheckerLanguage
    },
    currentFile (): DocumentState {
      return getStoreState(this).editor.currentFile as DocumentState
    },
    projectTree (): TreeFolderEntry | null {
      return getStoreState(this).project.projectTree
    },
    typewriter (): boolean {
      return this.preferences.typewriter
    },
    focus (): boolean {
      return this.preferences.focus
    },
    sourceCode (): boolean {
      return this.preferences.sourceCode
    }
  },

  data () {
    return {
      defaultFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      CloseIcon,
      selectionChange: null as EditorSelectionChangePayload | null,
      editor: null as MuyaLike | null,
      pathname: '',
      isShowClose: false,
      dialogTableVisible: false,
      imageViewerVisible: false,
      imageViewer: null as DestroyableLike | null,
      printer: null as Printer | null,
      spellchecker: null as SpellChecker | null,
      switchLanguageCommand: null as SpellcheckerLanguageCommand | null,
      tableChecker: {
        rows: 4,
        columns: 3
      } as TableChecker
    }
  },

  watch: {
    typewriter (value: boolean) {
      if (value) {
        this.scrollToCursor()
      }
    },

    focus (value: boolean) {
      this.editor?.setFocusMode(value)
    },

    fontSize (value: number, oldValue: number) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setFont({ fontSize: value })
      }
    },

    lineHeight (value: number, oldValue: number) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setFont({ lineHeight: value })
      }
    },

    preferLooseListItem (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ preferLooseListItem: value })
      }
    },

    tabSize (value: number, oldValue: number) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setTabSize(value)
      }
    },

    theme (value: string, oldValue: string) {
      const { editor } = this
      if (value !== oldValue && editor) {
        // Agreement：Any black series theme needs to contain dark `word`.
        editor.setOptions({ ...getThemeOptions(value) }, true)
      }
    },

    sequenceTheme (value: string, oldValue: string) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ sequenceTheme: value }, true)
      }
    },

    listIndentation (value: PreferencesState['listIndentation'], oldValue: PreferencesState['listIndentation']) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setListIndentation(value)
      }
    },

    frontmatterType (value: string, oldValue: string) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ frontmatterType: value })
      }
    },

    superSubScript (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ superSubScript: value }, true)
      }
    },

    footnote (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ footnote: value }, true)
      }
    },

    isHtmlEnabled (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ disableHtml: !value }, true)
      }
    },

    isGitlabCompatibilityEnabled (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ isGitlabCompatibilityEnabled: value }, true)
      }
    },

    hideQuickInsertHint (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ hideQuickInsertHint: value })
      }
    },

    editorLineWidth (value: string, oldValue: string) {
      if (value !== oldValue) {
        setEditorWidth(value)
      }
    },

    autoPairBracket (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairBracket: value })
      }
    },

    autoPairMarkdownSyntax (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairMarkdownSyntax: value })
      }
    },

    autoPairQuote (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairQuote: value })
      }
    },

    trimUnnecessaryCodeBlockEmptyLines (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ trimUnnecessaryCodeBlockEmptyLines: value })
      }
    },

    bulletListMarker (value: string, oldValue: string) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ bulletListMarker: value })
      }
    },

    orderListDelimiter (value: string, oldValue: string) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ orderListDelimiter: value })
      }
    },

    hideLinkPopup (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ hideLinkPopup: value })
      }
    },

    autoCheck (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoCheck: value })
      }
    },

    codeFontSize (value: number, oldValue: number) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: value,
          codeFontFamily: this.codeFontFamily,
          hideScrollbar: this.hideScrollbar
        })
      }
    },

    codeBlockLineNumbers (value: boolean, oldValue: boolean) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ codeBlockLineNumbers: value }, true)
      }
    },

    codeFontFamily (value: string, oldValue: string) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: this.codeFontSize,
          codeFontFamily: value,
          hideScrollbar: this.hideScrollbar
        })
      }
    },

    hideScrollbar (value: boolean, oldValue: boolean) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: this.codeFontSize,
          codeFontFamily: this.codeFontFamily,
          hideScrollbar: value
        })
      }
    },

    spellcheckerEnabled (value: boolean, oldValue: boolean) {
      if (value !== oldValue) {
        const { editor, spellchecker, spellcheckerLanguage } = this
        if (!editor || !spellchecker) {
          return
        }

        // Set Muya's spellcheck container attribute.
        editor.setOptions({ spellcheckEnabled: value })

        // Disable native spell checker
        if (value) {
          spellchecker.activateSpellchecker(spellcheckerLanguage)
        } else {
          spellchecker.deactivateSpellchecker()
        }
      }
    },

    spellcheckerNoUnderline (value: boolean, oldValue: boolean) {
      if (value !== oldValue) {
        // Set Muya's spellcheck container attribute.
        this.editor?.setOptions({ spellcheckEnabled: !value })
      }
    },

    spellcheckerLanguage (value: string, oldValue: string) {
      if (value !== oldValue && this.spellchecker) {
        this.spellchecker.lang = value
      }
    },

    currentFile (value: DocumentState, oldValue: DocumentState) {
      if (value && value !== oldValue) {
        this.scrollToCursor(0)
        // Hide float tools if needed.
        this.editor?.hideAllFloatTools()
      }
    },

    sourceCode (value: boolean, oldValue: boolean) {
      if (value && value !== oldValue) {
        this.editor?.hideAllFloatTools()
      }
    }
  },

  created () {
    this.$nextTick(() => {
      this.printer = new Printer()
      const editorElement = this.$refs.editor as HTMLElement | undefined
      if (!editorElement) {
        return
      }

      const {
        focus: focusMode,
        markdown,
        preferLooseListItem,
        typewriter,
        autoPairBracket,
        autoPairMarkdownSyntax,
        autoPairQuote,
        trimUnnecessaryCodeBlockEmptyLines,
        bulletListMarker,
        orderListDelimiter,
        tabSize,
        fontSize,
        lineHeight,
        codeBlockLineNumbers,
        listIndentation,
        frontmatterType,
        superSubScript,
        footnote,
        isHtmlEnabled,
        isGitlabCompatibilityEnabled,
        hideQuickInsertHint,
        editorLineWidth,
        theme,
        sequenceTheme,
        spellcheckerEnabled,
        spellcheckerLanguage,
        hideLinkPopup,
        autoCheck
      } = this

      // use muya UI plugins
      Muya.use(TablePicker)
      Muya.use(QuickInsert)
      Muya.use(CodePicker)
      Muya.use(EmojiPicker)
      Muya.use(ImagePathPicker)
      Muya.use(ImageSelector, {
        unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
        photoCreatorClick: this.photoCreatorClick
      })
      Muya.use(Transformer)
      Muya.use(ImageToolbar)
      Muya.use(FormatPicker)
      Muya.use(FrontMenu)
      Muya.use(LinkTools, {
        jumpClick: this.jumpClick
      })
      Muya.use(FootnoteTool)
      Muya.use(TableBarTools)

      const options: MuyaOptions = {
        focusMode,
        markdown,
        preferLooseListItem,
        autoPairBracket,
        autoPairMarkdownSyntax,
        trimUnnecessaryCodeBlockEmptyLines,
        autoPairQuote,
        bulletListMarker,
        orderListDelimiter,
        tabSize,
        fontSize,
        lineHeight,
        codeBlockLineNumbers,
        listIndentation,
        frontmatterType,
        superSubScript,
        footnote,
        disableHtml: !isHtmlEnabled,
        isGitlabCompatibilityEnabled,
        hideQuickInsertHint,
        hideLinkPopup,
        autoCheck,
        sequenceTheme,
        spellcheckEnabled: spellcheckerEnabled,
        imageAction: this.imageAction.bind(this),
        imagePathPicker: this.imagePathPicker.bind(this),
        clipboardFilePath: guessClipboardFilePath,
        imagePathAutoComplete: this.imagePathAutoComplete.bind(this),
        ...getThemeOptions(theme)
      }

      const editor = new Muya(editorElement, options) as MuyaLike
      this.editor = editor
      const { container } = editor

      // Create spell check wrapper and enable spell checking if preferred.
      this.spellchecker = new SpellChecker(spellcheckerEnabled, spellcheckerLanguage)

      // Register command palette entry for switching spellchecker language.
      this.switchLanguageCommand = new SpellcheckerLanguageCommand(this.spellchecker)
      setTimeout(() => bus.$emit('cmd::register-command', this.switchLanguageCommand), 100)

      if (typewriter) {
        this.scrollToCursor()
      }

      // listen for bus events.
      bus.$on('file-loaded', this.setMarkdownToEditor)
      bus.$on('invalidate-image-cache', this.handleInvalidateImageCache)
      bus.$on('undo', this.handleUndo)
      bus.$on('redo', this.handleRedo)
      bus.$on('selectAll', this.handleSelectAll)
      bus.$on('export', this.handleExport)
      bus.$on('print-service-clearup', this.handlePrintServiceClearup)
      bus.$on('paragraph', this.handleEditParagraph)
      bus.$on('format', this.handleInlineFormat)
      bus.$on('searchValue', this.handleSearch)
      bus.$on('replaceValue', this.handReplace)
      bus.$on('find-action', this.handleFindAction)
      bus.$on('insert-image', this.insertImage)
      bus.$on('image-uploaded', this.handleUploadedImage)
      bus.$on('file-changed', this.handleFileChange)
      bus.$on('editor-blur', this.blurEditor)
      bus.$on('editor-focus', this.focusEditor)
      bus.$on('copyAsMarkdown', this.handleCopyPaste)
      bus.$on('copyAsHtml', this.handleCopyPaste)
      bus.$on('pasteAsPlainText', this.handleCopyPaste)
      bus.$on('duplicate', this.handleParagraph)
      bus.$on('createParagraph', this.handleParagraph)
      bus.$on('deleteParagraph', this.handleParagraph)
      bus.$on('insertParagraph', this.handleInsertParagraph)
      bus.$on('scroll-to-header', this.scrollToHeader)
      bus.$on('screenshot-captured', this.handleScreenShot)
      bus.$on('switch-spellchecker-language', this.switchSpellcheckLanguage)
      bus.$on('open-command-spellchecker-switch-language', this.openSpellcheckerLanguageCommand)
      bus.$on('replace-misspelling', this.replaceMisspelling)

      editor.on('change', changes => {
        // WORKAROUND: "id: 'muya'"
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', Object.assign(changes, { id: 'muya' }))
      })

      editor.on('format-click', ({ event, formatType, data }) => {
        const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
        if (formatType === 'link' && ctrlOrMeta) {
          this.$store.dispatch('FORMAT_LINK_CLICK', { data, dirname: window.DIRNAME })
        } else if (formatType === 'image' && ctrlOrMeta) {
          this.imageViewer?.destroy()

          // Disabled due to #2120.
          // this.imageViewer = new ViewImage(this.$refs.imageViewer, {
          //   url: data,
          //   snapView: true
          // })

          this.setImageViewerVisible(true)
        }
      })

      // Disabled due to #2120.
      // editor.on('preview-image', ({ data }) => {
      //   if (this.imageViewer) {
      //     this.imageViewer.destroy()
      //   }
      //
      //   this.imageViewer = new ViewImage(this.$refs.imageViewer, {
      //     url: data,
      //     snapView: true
      //   })
      //
      //   this.setImageViewerVisible(true)
      // })

      editor.on('selectionChange', changes => {
        const { y } = changes.cursorCoords
        if (this.typewriter) {
          const startPosition = container.scrollTop
          const toPosition = startPosition + y - STANDAR_Y

          // Prevent micro shakes and unnecessary scrolling.
          if (Math.abs(startPosition - toPosition) > 2) {
            animatedScrollTo(container, toPosition, 100)
          }
        }

        // Used to fix #628: auto scroll cursor to visible if the cursor is too low.
        if (container.clientHeight - y < 100) {
          // editableHeight is the lowest cursor position(till to top) that editor allowed.
          const editableHeight = container.clientHeight - 100
          animatedScrollTo(container, container.scrollTop + (y - editableHeight), 0)
        }

        this.selectionChange = changes
        this.$store.dispatch('SELECTION_CHANGE', changes)
      })

      editor.on('selectionFormats', formats => {
        this.$store.dispatch('SELECTION_FORMATS', formats)
      })

      document.addEventListener('keyup', this.keyup)

      setEditorWidth(editorLineWidth)
    })
  },
  methods: {
    photoCreatorClick (url: string) {
      shell.openExternal(url)
    },

    jumpClick (linkInfo: LinkInfo) {
      const { href } = linkInfo
      this.$store.dispatch('FORMAT_LINK_CLICK', { data: { href }, dirname: window.DIRNAME })
    },

    async imagePathAutoComplete (src: string): Promise<ImageAutoPathOption[]> {
      const files = await (this.$store.dispatch('ASK_FOR_IMAGE_AUTO_PATH', src) as Promise<ImageAutoPathEntry[]> | ImageAutoPathEntry[])
      return files.map((file): ImageAutoPathOption => {
        const iconClass = file.type === 'directory' ? 'icon-folder' : 'icon-image'
        return {
          ...file,
          iconClass,
          text: file.file + (file.type === 'directory' ? '/' : '')
        }
      })
    },

    async imageAction (image: ImageInput, id?: string, alt = ''): Promise<string> {
      // TODO(Refactor): Refactor this method.
      const {
        imageInsertAction,
        imageFolderPath,
        imagePreferRelativeDirectory,
        imageRelativeDirectoryName,
        preferences
      } = this
      const {
        filename,
        pathname
      } = this.currentFile

      // Save an image relative to the file if the relative image directory include the filename variable.
      // The image is save relative to the root folder without a variable.
      const saveRelativeToFile = () => {
        return /\${filename}/.test(imageRelativeDirectoryName)
      }

      // Figure out the current working directory.
      const isTabSavedOnDisk = !!pathname
      let relativeBasePath = isTabSavedOnDisk ? path.dirname(pathname) : null
      if (isTabSavedOnDisk && !saveRelativeToFile() && this.projectTree) {
        const { pathname: rootPath } = this.projectTree
        if (rootPath && isChildOfDirectory(rootPath, pathname)) {
          // Save assets relative to root directory.
          relativeBasePath = rootPath
        }
      }

      const getResolvedImagePath = (imagePath: string): string => {
        const replacement = isTabSavedOnDisk
          // Filename w/o extension
          ? filename.replace(/\.[^/.]+$/, '')
          : ''
        return imagePath.replace(/\${filename}/g, replacement)
      }

      const resolvedImageFolderPath = getResolvedImagePath(imageFolderPath)
      const resolvedImageRelativeDirectoryName = getResolvedImagePath(imageRelativeDirectoryName)
      const relativeFolderBasePath = relativeBasePath || path.dirname(pathname)
      let destImagePath = ''

      switch (imageInsertAction) {
        case 'upload': {
          try {
            destImagePath = await uploadImage(pathname, image, preferences as UploadPreferences)
          } catch (error) {
            notice.notify({
              title: 'Upload Image',
              type: 'warning',
              message: getErrorMessage(error)
            })
            destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)
          }
          break
        }
        case 'folder': {
          destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)
          if (isTabSavedOnDisk && imagePreferRelativeDirectory) {
            destImagePath = await moveToRelativeFolder(relativeFolderBasePath, resolvedImageRelativeDirectoryName, pathname, destImagePath)
          }
          break
        }
        case 'path': {
          if (typeof image === 'string') {
            // Input is a local path.
            destImagePath = image
          } else {
            // Save and move image to image folder if input is binary.
            destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)

            // Respect user preferences if tab exists on disk.
            if (isTabSavedOnDisk && imagePreferRelativeDirectory) {
              destImagePath = await moveToRelativeFolder(relativeFolderBasePath, resolvedImageRelativeDirectoryName, pathname, destImagePath)
            }
          }
          break
        }
      }

      if (id && this.sourceCode) {
        bus.$emit('image-action', {
          id,
          result: destImagePath,
          alt
        })
      }
      return destImagePath
    },

    imagePathPicker (): string {
      return this.$store.dispatch('ASK_FOR_IMAGE_PATH') as unknown as string
    },

    keyup (event: KeyboardEvent) {
      if (event.key === 'Escape') {
        this.setImageViewerVisible(false)
      }
    },

    setImageViewerVisible (status: boolean) {
      this.imageViewerVisible = status
    },

    switchSpellcheckLanguage (languageCode: string) {
      const { spellchecker } = this
      if (!spellchecker) {
        return
      }

      const { isEnabled } = spellchecker

      // This method is also called from bus, so validate state before continuing.
      if (!isEnabled) {
        throw new Error('Cannot switch language because spell checker is disabled!')
      }

      spellchecker.switchLanguage(languageCode)
        .then(langCode => {
          if (!langCode) {
            // Unable to switch language due to missing dictionary. The spell checker is now in an invalid state.
            notice.notify({
              title: 'Spelling',
              type: 'warning',
              message: `Unable to switch to language "${languageCode}". Requested language dictionary is missing.`
            })
          }
        })
        .catch(error => {
          log.error(`Error while switching to language "${languageCode}":`)
          log.error(error)

          notice.notify({
            title: 'Spelling',
            type: 'error',
            message: `Error while switching to "${languageCode}": ${getErrorMessage(error)}`
          })
        })
    },

    handleInvalidateImageCache () {
      this.editor?.invalidateImageCache()
    },

    openSpellcheckerLanguageCommand () {
      if (!isOsx && this.switchLanguageCommand) {
        bus.$emit('show-command-palette', this.switchLanguageCommand)
      }
    },

    replaceMisspelling ({ word, replacement }: ReplaceMisspellingPayload) {
      this.editor?._replaceCurrentWordInlineUnsafe(word, replacement)
    },

    handleUndo () {
      this.editor?.undo()
    },

    handleRedo () {
      this.editor?.redo()
    },

    handleSelectAll () {
      if (this.sourceCode) {
        return
      }

      const { editor } = this
      if (editor && (editor.hasFocus() || editor.contentState.selectedTableCells)) {
        editor.selectAll()
      } else {
        const activeElement = document.activeElement
        if (isTextInputElement(activeElement)) {
          activeElement.select()
        }
      }
    },

    // Custom copyAsMarkdown copyAsHtml pasteAsPlainText
    handleCopyPaste (type: CopyPasteAction) {
      const { editor } = this
      if (editor) {
        editor[type]()
      }
    },

    insertImage (src: string) {
      if (!this.sourceCode) {
        this.editor?.insertImage({ src })
      }
    },

    handleSearch (value: string, opt: SearchOptions) {
      const { editor } = this
      if (!editor) {
        return
      }

      const searchMatches = editor.search(value, opt)
      this.$store.dispatch('SEARCH', searchMatches)
      this.scrollToHighlight()
    },

    handReplace (value: string, opt: ReplaceOptions) {
      const { editor } = this
      if (!editor) {
        return
      }

      const searchMatches = editor.replace(value, opt)
      this.$store.dispatch('SEARCH', searchMatches)
    },

    handleUploadedImage (url: string, deletionUrl: string) {
      this.insertImage(url)
      this.$store.dispatch('SHOW_IMAGE_DELETION_URL', deletionUrl)
    },

    scrollToCursor (duration = 300) {
      this.$nextTick(() => {
        const { editor } = this
        if (!editor) {
          return
        }

        const { container } = editor
        const { y } = editor.getSelection().cursorCoords
        animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
      })
    },

    scrollToHighlight () {
      this.scrollToElement('.ag-highlight')
    },

    scrollToHeader (slug: string) {
      this.scrollToElement(`#${slug}`)
    },

    scrollToElement (selector: string) {
      // Scroll to search highlight word
      const { editor } = this
      if (!editor) {
        return
      }

      const { container } = editor
      const anchor = document.querySelector(selector)
      if (anchor) {
        const { y } = anchor.getBoundingClientRect()
        const DURATION = 300
        animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, DURATION)
      }
    },

    handleFindAction (action: FindAction) {
      const { editor } = this
      if (!editor) {
        return
      }

      const searchMatches = editor.find(action)
      this.$store.dispatch('SEARCH', searchMatches)
      this.scrollToHighlight()
    },

    async handleExport (options: ExportOptions): Promise<void> {
      const { editor, printer } = this
      if (!editor || !printer) {
        return
      }

      const {
        type,
        header,
        footer,
        headerFooterStyled,
        htmlTitle
      } = options

      if (!/^pdf|print|styledHtml$/.test(type)) {
        throw new Error(`Invalid type to export: "${type}".`)
      }

      const extraCss = getCssForOptions(options)
      const htmlToc = getHtmlToc(editor.getTOC(), options)

      switch (type) {
        case 'styledHtml': {
          try {
            const content = await editor.exportStyledHTML({
              title: htmlTitle || '',
              printOptimization: false,
              extraCss,
              toc: htmlToc
            })
            this.$store.dispatch('EXPORT', { type, content })
          } catch (error) {
            log.error('Failed to export document:', error)
            notice.notify({
              title: `Printing/Exporting ${htmlTitle || 'html'} failed`,
              type: 'error',
              message: getErrorMessage(error) || 'There is something wrong when exporting.'
            })
          }
          break
        }
        case 'pdf': {
          // NOTE: We need to set page size via Electron.
          try {
            const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = options
            const pageOptions = {
              pageSize,
              pageSizeWidth,
              pageSizeHeight,
              isLandscape
            }

            const html = await editor.exportStyledHTML({
              title: '',
              printOptimization: true,
              extraCss,
              toc: htmlToc,
              header,
              footer,
              headerFooterStyled
            })
            printer.renderMarkdown(html, true)
            this.$store.dispatch('EXPORT', { type, pageOptions })
          } catch (error) {
            log.error('Failed to export document:', error)
            notice.notify({
              title: 'Printing/Exporting failed',
              type: 'error',
              message: `There is something wrong when export ${htmlTitle || 'PDF'}.`
            })
            this.handlePrintServiceClearup()
          }
          break
        }
        case 'print': {
          // NOTE: Print doesn't support page size or orientation.
          try {
            const html = await editor.exportStyledHTML({
              title: '',
              printOptimization: true,
              extraCss,
              toc: htmlToc,
              header,
              footer,
              headerFooterStyled
            })
            printer.renderMarkdown(html, true)
            this.$store.dispatch('PRINT_RESPONSE')
          } catch (error) {
            log.error('Failed to export document:', error)
            notice.notify({
              title: 'Printing/Exporting failed',
              type: 'error',
              message: `There is something wrong when print ${htmlTitle || ''}.`
            })
            this.handlePrintServiceClearup()
          }
          break
        }
      }
    },

    handlePrintServiceClearup () {
      this.printer?.clearup()
    },

    handleEditParagraph (type: string) {
      if (type === 'table') {
        this.tableChecker = { rows: 4, columns: 3 }
        this.dialogTableVisible = true
        this.$nextTick(() => {
          const rowInput = this.$refs.rowInput as { focus?: (() => void) | undefined } | undefined
          if (rowInput?.focus) {
            rowInput.focus()
          }
        })
      } else if (this.editor) {
        this.editor.updateParagraph(type)
      }
    },

    // handle `duplicate`, `delete`, `create paragraph below`
    handleParagraph (type: ParagraphAction) {
      const { editor } = this
      if (editor) {
        switch (type) {
          case 'duplicate': {
            return editor.duplicate()
          }
          case 'createParagraph': {
            return editor.insertParagraph('after', '', true)
          }
          case 'deleteParagraph': {
            return editor.deleteParagraph()
          }
          default:
            console.error(`unknow paragraph edit type: ${type}`)
        }
      }
    },

    handleInlineFormat (type: string) {
      this.editor?.format(type)
    },

    handleDialogTableConfirm () {
      this.dialogTableVisible = false
      this.editor?.createTable(this.tableChecker)
    },

    // listen for `open-single-file` event, it will call this method only when open a new file.
    setMarkdownToEditor ({ markdown, cursor }: FileLoadedPayload) {
      const { editor } = this
      if (editor) {
        editor.clearHistory()
        if (cursor) {
          editor.setMarkdown(markdown, cursor, true)
        } else {
          editor.setMarkdown(markdown)
        }
      }
    },

    // listen for markdown change form source mode or change tabs etc
    handleFileChange ({ markdown, cursor, renderCursor, history }: FileChangedPayload) {
      const { editor } = this
      this.$nextTick(() => {
        if (editor) {
          if (history) {
            editor.setHistory(history)
          }
          if (typeof markdown === 'string') {
            editor.setMarkdown(markdown, cursor, renderCursor)
          } else if (cursor) {
            editor.setCursor(cursor)
          }
          if (renderCursor) {
            this.scrollToCursor(0)
          }
        }
      })
    },

    handleInsertParagraph (location: string) {
      this.editor?.insertParagraph(location)
    },

    blurEditor () {
      this.editor?.blur(false, true)
    },

    focusEditor () {
      this.editor?.focus()
    },

    handleScreenShot () {
      if (this.editor) {
        document.execCommand('paste')
      }
    }
  },
  beforeDestroy () {
    bus.$off('file-loaded', this.setMarkdownToEditor)
    bus.$off('invalidate-image-cache', this.handleInvalidateImageCache)
    bus.$off('undo', this.handleUndo)
    bus.$off('redo', this.handleRedo)
    bus.$off('selectAll', this.handleSelectAll)
    bus.$off('export', this.handleExport)
    bus.$off('print-service-clearup', this.handlePrintServiceClearup)
    bus.$off('paragraph', this.handleEditParagraph)
    bus.$off('format', this.handleInlineFormat)
    bus.$off('searchValue', this.handleSearch)
    bus.$off('replaceValue', this.handReplace)
    bus.$off('find-action', this.handleFindAction)
    bus.$off('insert-image', this.insertImage)
    bus.$off('image-uploaded', this.handleUploadedImage)
    bus.$off('file-changed', this.handleFileChange)
    bus.$off('editor-blur', this.blurEditor)
    bus.$off('editor-focus', this.focusEditor)
    bus.$off('copyAsMarkdown', this.handleCopyPaste)
    bus.$off('copyAsHtml', this.handleCopyPaste)
    bus.$off('pasteAsPlainText', this.handleCopyPaste)
    bus.$off('duplicate', this.handleParagraph)
    bus.$off('createParagraph', this.handleParagraph)
    bus.$off('deleteParagraph', this.handleParagraph)
    bus.$off('insertParagraph', this.handleInsertParagraph)
    bus.$off('scroll-to-header', this.scrollToHeader)
    bus.$off('screenshot-captured', this.handleScreenShot)
    bus.$off('switch-spellchecker-language', this.switchSpellcheckLanguage)
    bus.$off('open-command-spellchecker-switch-language', this.openSpellcheckerLanguageCommand)
    bus.$off('replace-misspelling', this.replaceMisspelling)

    document.removeEventListener('keyup', this.keyup)

    this.editor?.destroy()
    this.editor = null
  }
})
</script>

<style>
  .editor-wrapper {
    height: 100%;
    position: relative;
    flex: 1;
    color: var(--editorColor);
    & .ag-dialog-table {
      & .el-button {
        font-size: 13px;
        width: 70px;
      }
    }
  }

  .editor-wrapper.source {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    overflow: hidden;
  }

  .editor-component {
    height: 100%;
    overflow: auto;
    box-sizing: border-box;
    cursor: default;
  }

  .typewriter .editor-component {
    padding-top: calc(50vh - 136px);
    padding-bottom: calc(50vh - 54px);
  }

  .image-viewer {
    position: fixed;
    backdrop-filter: blur(5px);
    top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    background: rgba(0, 0, 0, .8);
    z-index: 11;
    & .icon-close {
      z-index: 1000;
      width: 30px;
      height: 30px;
      position: absolute;
      top: 50px;
      left: 50px;
      display: block;
      & svg {
        fill: #efefef;
        width: 100%;
        height: 100%;
      }
    }
  }

  .iv-container {
    width: 100%;
    height: 100%;
  }

  .iv-snap-view {
    opacity: 1;
    bottom: 20px;
    right: 20px;
    top: auto;
    left: auto;
  }
</style>
