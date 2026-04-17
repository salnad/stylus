// __MARKTEXT_ONLY__

import {
  extractWord,
  offsetToWordCursor,
  validateLineCursor
} from '../marktext/spellchecker'
import type {
  CursorRangeLike as SpellcheckerCursorRangeLike,
  ExtractedWord,
  SelectionLike as SpellcheckerSelectionLike
} from '../marktext/spellchecker'
import selection from '../selection'

interface SelectionCursorPosition {
  key: string
  offset: number
  block?: {
    text: string
  }
  [key: string]: unknown
}

interface SelectionCursorRange extends SpellcheckerSelectionLike {
  start: SelectionCursorPosition
  end: SelectionCursorPosition
}

interface ContentStateLike {
  cursor: SpellcheckerCursorRangeLike
  getBlock(key: string): unknown
  replaceWordInline(
    line: SelectionCursorRange,
    wordRange: unknown,
    replacement: string,
    setCursor: boolean
  ): void
}

type ContentStateConstructor = {
  prototype: ContentStateLike & {
    _replaceCurrentWordInlineUnsafe(word: string, replacement: string): boolean
  }
}

const marktextApi = (ContentState: ContentStateConstructor): void => {
  ContentState.prototype._replaceCurrentWordInlineUnsafe = function (word: string, replacement: string): boolean {
    const { start, end } = selection.getCursorRange() as unknown as SelectionCursorRange
    const cursor = Object.assign({}, { start, end }) as SelectionCursorRange & {
      start: SelectionCursorPosition
    }
    cursor.start.block = this.getBlock(start.key) as SelectionCursorPosition['block']

    if (!validateLineCursor(cursor)) {
      console.warn('Unable to replace word: multiple lines are selected.', JSON.stringify(cursor))
      return false
    }

    const { start: startCursor } = cursor
    const { offset: lineOffset } = startCursor
    const { text = '' } = startCursor.block ?? {}
    const wordInfo = extractWord(text, lineOffset) as ExtractedWord | null
    if (wordInfo) {
      const { left, right, word: selectedWord } = wordInfo
      if (selectedWord !== word) {
        console.warn(`Unable to replace word: Chromium selection mismatch (expected "${selectedWord}" but found "${word}").`)
        return false
      }

      const wordRange = offsetToWordCursor(this.cursor, left, right)
      this.replaceWordInline(cursor, wordRange, replacement, true)
      return true
    }
    return false
  }
}

export default marktextApi
