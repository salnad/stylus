<template>
  <div
    class="source-code"
    ref="sourceCode"
  >
  </div>
</template>

<script lang="ts">
import Vue, { type PropType } from 'vue'
import codeMirror, { setMode, setCursorAtLastLine, setTextDirection } from '../../codeMirror'
import { wordCount as getWordCount } from 'muya/lib/utils'
import { adjustCursor, type CodeMirrorCursorLike } from '../../util'
import bus from '../../bus'
import { oneDarkThemes, railscastsThemes } from '@/config'
import type { DocumentState, WordCount } from '@/store/help'
import type { PreferencesState } from '@/store/preferences'

type CodeMirrorEditor = any

interface SourceCodeCursorSelection {
  anchor: CodeMirrorCursorLike | null
  focus: CodeMirrorCursorLike | null
}

interface SourceCodeCursorPayload {
  anchor?: CodeMirrorCursorLike | null
  focus?: CodeMirrorCursorLike | null
}

interface FileChangedPayload {
  id: string | null
  markdown?: string
  cursor?: SourceCodeCursorPayload | null
}

interface ImageActionPayload {
  id: string
  result: string
  alt: string
}

interface SourceCodeStoreState {
  preferences: Pick<PreferencesState, 'theme' | 'sourceCode'>
  editor: {
    currentFile: DocumentState
  }
}

interface SourceCodeVm extends Vue {
  markdown?: string
  cursor?: SourceCodeCursorPayload | null
  textDirection: string
  theme: string
  sourceCode: boolean
  currentTab: DocumentState
  editor: CodeMirrorEditor | null
  commitTimer: ReturnType<typeof setTimeout> | null
  viewDestroyed: boolean
  tabId: string | null
}

const hasSelectionCursor = (cursor: SourceCodeCursorPayload | null | undefined): cursor is Required<SourceCodeCursorPayload> => {
  return !!cursor && !!cursor.anchor && !!cursor.focus
}

export default Vue.extend({
  props: {
    markdown: String,
    cursor: {
      type: Object as PropType<SourceCodeCursorPayload | null>,
      default: null
    },
    textDirection: {
      type: String,
      required: true
    }
  },

  data () {
    return {
      editor: null as CodeMirrorEditor | null,
      commitTimer: null as ReturnType<typeof setTimeout> | null,
      viewDestroyed: false,
      tabId: null as string | null
    }
  },

  computed: {
    theme (): string {
      return (this.$store.state as SourceCodeStoreState).preferences.theme
    },
    sourceCode (): boolean {
      return (this.$store.state as SourceCodeStoreState).preferences.sourceCode
    },
    currentTab (): DocumentState {
      return (this.$store.state as SourceCodeStoreState).editor.currentFile
    }
  },

  watch: {
    textDirection (value: string, oldValue: string) {
      const vm = this as unknown as SourceCodeVm
      if (value !== oldValue && vm.editor) {
        setTextDirection(vm.editor, value)
      }
    }
  },

  created () {
    this.$nextTick(() => {
      const vm = this as unknown as SourceCodeVm
      const { id } = vm.currentTab
      const { markdown = '', theme, cursor, textDirection } = vm
      const container = this.$refs.sourceCode as HTMLElement | undefined
      if (!container) {
        return
      }

      const codeMirrorConfig: Record<string, unknown> = {
        value: markdown,
        lineNumbers: true,
        autofocus: true,
        lineWrapping: true,
        styleActiveLine: true,
        direction: textDirection,
        viewportMargin: Infinity,
        lineNumberFormatter (line: number) {
          return line % 10 === 0 || line === 1 ? line : ''
        }
      }

      if ((railscastsThemes as readonly string[]).includes(theme)) {
        codeMirrorConfig.theme = 'railscasts'
      } else if ((oneDarkThemes as readonly string[]).includes(theme)) {
        codeMirrorConfig.theme = 'one-dark'
      }

      const editor = codeMirror(container, codeMirrorConfig)
      vm.editor = editor

      bus.$on('file-loaded', this.handleFileChange)
      bus.$on('invalidate-image-cache', this.handleInvalidateImageCache)
      bus.$on('file-changed', this.handleFileChange)
      bus.$on('selectAll', this.handleSelectAll)
      bus.$on('image-action', this.handleImageAction)

      setMode(editor, 'markdown')
      this.listenChange()

      editor.on('contextmenu', (_cm: unknown, event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
      })

      if (hasSelectionCursor(cursor)) {
        const { anchor, focus } = cursor
        editor.setSelection(anchor, focus, { scroll: true })
      } else {
        setCursorAtLastLine(editor)
      }
      vm.tabId = id
    })
  },
  beforeDestroy () {
    const vm = this as unknown as SourceCodeVm
    vm.viewDestroyed = true
    if (vm.commitTimer) {
      clearTimeout(vm.commitTimer)
    }

    bus.$off('file-loaded', this.handleFileChange)
    bus.$off('invalidate-image-cache', this.handleInvalidateImageCache)
    bus.$off('file-changed', this.handleFileChange)
    bus.$off('selectAll', this.handleSelectAll)
    bus.$off('image-action', this.handleImageAction)

    if (vm.editor) {
      const { cursor, markdown } = this.getMarkdownAndCursor(vm.editor)
      bus.$emit('file-changed', { id: vm.tabId, markdown, cursor, renderCursor: true })
    }
  },
  methods: {
    handleImageAction (payload: ImageActionPayload) {
      const vm = this as unknown as SourceCodeVm
      const { editor } = vm
      if (!editor) {
        return
      }

      const { id, result, alt } = payload
      const value = editor.getValue()
      const focus = editor.getCursor('focus')
      const anchor = editor.getCursor('anchor')
      const lines = value.split('\n')
      const index = lines.findIndex((line: string) => line.indexOf(id) > 0)

      if (index > -1) {
        const oldLine = lines[index]
        lines[index] = oldLine.replace(new RegExp(`!\\[${id}\\]\\(.*\\)`), `![${alt}](${result})`)
        const newValue = lines.join('\n')
        editor.setValue(newValue)
        const match = /(!\[.*\]\(.*\))/.exec(oldLine)
        if (!match) {
          return
        }
        const range = {
          start: match.index,
          end: match.index + match[1].length
        }
        const delta = alt.length + result.length + 5 - match[1].length

        const adjust = (pointer: CodeMirrorCursorLike | null) => {
          if (!pointer) {
            return
          }
          if (pointer.line !== index) {
            return
          }
          if (pointer.ch > range.start && pointer.ch < range.end) {
            pointer.ch = range.start + alt.length + result.length + 5
          } else if (pointer.ch >= range.end) {
            pointer.ch += delta
          }
        }

        adjust(focus)
        adjust(anchor)
        if (focus && anchor) {
          editor.setSelection(anchor, focus, { scroll: true })
        } else {
          setCursorAtLastLine(editor)
        }
      }
    },
    listenChange () {
      const vm = this as unknown as SourceCodeVm
      const { editor } = vm
      if (!editor) {
        return
      }

      editor.on('cursorActivity', (cm: CodeMirrorEditor) => {
        const { cursor, markdown } = this.getMarkdownAndCursor(cm)
        const wordCount = getWordCount(markdown) as WordCount
        if (vm.commitTimer) {
          clearTimeout(vm.commitTimer)
        }
        vm.commitTimer = setTimeout(() => {
          if (!vm.viewDestroyed) {
            if (vm.tabId) {
              this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { id: vm.tabId, markdown, wordCount, cursor })
            } else {
              console.warn('LISTEN_FOR_CONTENT_CHANGE: Cannot commit changes because not tab id was set!')
            }
          }
        }, 1000)
      })
    },
    handleFileChange (payload: FileChangedPayload) {
      const vm = this as unknown as SourceCodeVm
      this.prepareTabSwitch()

      const { editor } = vm
      if (!editor) {
        return
      }

      const { id, markdown, cursor } = payload
      if (typeof markdown === 'string') {
        editor.setValue(markdown)
      }
      if (hasSelectionCursor(cursor)) {
        const { anchor, focus } = cursor
        editor.setSelection(anchor, focus, { scroll: true })
      } else {
        setCursorAtLastLine(editor)
      }
      vm.tabId = id
    },
    getMarkdownAndCursor (cm: CodeMirrorEditor): { cursor: SourceCodeCursorSelection, markdown: string } {
      let focus = cm.getCursor('head') as CodeMirrorCursorLike | null
      let anchor = cm.getCursor('anchor') as CodeMirrorCursorLike | null
      const markdown = cm.getValue() as string
      const convertToMuyaCursor = (cursorValue: CodeMirrorCursorLike | null): CodeMirrorCursorLike | null => {
        if (!cursorValue) {
          return null
        }
        const line = cm.getLine(cursorValue.line) as string
        const preLine = cm.getLine(cursorValue.line - 1) as string | undefined
        const nextLine = cm.getLine(cursorValue.line + 1) as string | undefined
        return adjustCursor(cursorValue, preLine, line, nextLine)
      }

      anchor = convertToMuyaCursor(anchor)
      focus = convertToMuyaCursor(focus)

      if (anchor && focus && anchor.line > focus.line) {
        const tempCursor = focus
        focus = anchor
        anchor = tempCursor
      }
      return { cursor: { focus, anchor }, markdown }
    },
    prepareTabSwitch () {
      const vm = this as unknown as SourceCodeVm
      if (vm.commitTimer) {
        clearTimeout(vm.commitTimer)
      }
      if (vm.tabId && vm.editor) {
        const { cursor, markdown } = this.getMarkdownAndCursor(vm.editor)
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { id: vm.tabId, markdown, cursor })
        vm.tabId = null
      }
    },

    handleSelectAll () {
      const vm = this as unknown as SourceCodeVm
      if (!vm.sourceCode) {
        return
      }

      const { editor } = vm
      if (editor && editor.hasFocus()) {
        editor.execCommand('selectAll')
      } else {
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          activeElement.select()
        }
      }
    },

    handleInvalidateImageCache () {
      const vm = this as unknown as SourceCodeVm
      vm.editor?.invalidateImageCache()
    }
  }
})
</script>

<style>
  .source-code {
    height: calc(100vh - var(--titleBarHeight));
    box-sizing: border-box;
    overflow: auto;
  }
  .source-code .CodeMirror {
    height: auto;
    margin: 50px auto;
    max-width: var(--editorAreaWidth);
    background: transparent;
  }
  .source-code .CodeMirror-gutters {
    border-right: none;
    background-color: transparent;
  }
  .source-code .CodeMirror-activeline-background,
  .source-code .CodeMirror-activeline-gutter {
    background: var(--floatHoverColor);
  }
</style>
