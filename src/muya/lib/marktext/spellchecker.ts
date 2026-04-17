// __MARKTEXT_ONLY__
import { deepClone } from '../utils'

// Source: https://github.com/Microsoft/vscode/blob/master/src/vs/editor/common/model/wordHelper.ts
// /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/
/* eslint-disable no-useless-escape */
const WORD_SEPARATORS = /(?:[`~!@#$%^&*()-=+[{\]}\\|;:'",\.<>\/?\s])/g
const WORD_DEFINITION = /(?:-?\d*\.\d\w*)|(?:[^`~!@#$%^&*()-=+[{\]}\\|;:'",\.<>\/?\s]+)/g
/* eslint-enable no-useless-escape */

interface CursorPosition {
  key: string
  offset: number
  [key: string]: unknown
}

interface CursorRangeLike {
  start: CursorPosition
  end: CursorPosition
}

interface BlockLike {
  functionType?: string
  lang?: unknown
  [key: string]: unknown
}

interface SelectionCursorPosition extends CursorPosition {
  block?: BlockLike
}

interface SelectionLike {
  start: SelectionCursorPosition
  end: SelectionCursorPosition
  affiliation?: Array<{ type?: string }>
  [key: string]: unknown
}

interface WordCursor {
  start: CursorPosition
  end: CursorPosition
}

interface ExtractedWord {
  left: number
  right: number
  word: string
}

export type { CursorRangeLike, SelectionLike, ExtractedWord }

/**
 * Translate a left and right offset from a word in `line` into a cursor with
 * the given line cursor.
 *
 * @param lineCursor The original line cursor.
 * @param left Start offset/index of word in `lineCursor`.
 * @param right End offset/index of word in `lineCursor`.
 * @returns Return a cursor of the word selected in `lineCursor`(e.g.
 *              "foo >bar< foo" where `>`/`<` start and end offset).
 */
export const offsetToWordCursor = (lineCursor: CursorRangeLike, left: number, right: number): WordCursor => {
  // Deep clone cursor start and end
  const start = deepClone(lineCursor.start)
  const end = deepClone(lineCursor.end)
  start.offset = left
  end.offset = right
  return { start, end }
}

/**
 * Validate whether the selection is valid for spelling correction.
 *
 * @param selection The preview editor selection range.
 */
export const validateLineCursor = (selection: SelectionLike | null | undefined): boolean => {
  // Validate selection range.
  if (!selection || !selection.start || !Object.prototype.hasOwnProperty.call(selection.start, 'offset') ||
    !selection.end || !Object.prototype.hasOwnProperty.call(selection.end, 'offset')) {
    return false
  }

  // Allow only single lines
  const { start: startCursor, end: endCursor } = selection
  if (startCursor.key !== endCursor.key || !startCursor.block) {
    return false
  }

  // Don't correct words in code blocks or editors for HTML, LaTex and diagrams.
  if (startCursor.block.functionType === 'codeContent' &&
    startCursor.block.lang !== undefined) {
    return false
  }

  // Don't correct words in code blocks or pre elements such as language identifier.
  if (selection.affiliation && selection.affiliation.length === 1 &&
    selection.affiliation[0].type === 'pre') {
    return false
  }
  return true
}

/**
 * Extract the word at the given offset from the text.
 *
 * @param text Text
 * @param offset Normalized cursor offset (e.g. ab<cursor>c def --> 2)
 */
export const extractWord = (text: string | null | undefined, offset: number): ExtractedWord | null => {
  if (!text || text.length === 0) {
    return null
  } else if (offset < 0) {
    offset = 0
  } else if (offset >= text.length) {
    offset = text.length - 1
  }

  // Matches all words starting at a good position.
  WORD_DEFINITION.lastIndex = text.lastIndexOf(' ', offset - 1) + 1
  let match: RegExpExecArray | null = null
  let left = -1
  while ((match = WORD_DEFINITION.exec(text))) {
    if (match && match.index <= offset) {
      if (WORD_DEFINITION.lastIndex > offset) {
        left = match.index
      }
    } else {
      break
    }
  }
  WORD_DEFINITION.lastIndex = 0

  // Cursor is between two word separators (e.g "*<cursor>*" or " <cursor>*")
  if (left <= -1) {
    return null
  }

  // Find word ending.
  WORD_SEPARATORS.lastIndex = offset
  match = WORD_SEPARATORS.exec(text)
  let right = -1
  if (match) {
    right = match.index
  }
  WORD_SEPARATORS.lastIndex = 0

  // The last word in the string is a special case.
  if (right < 0) {
    return {
      left,
      right: text.length,
      word: text.slice(left)
    }
  }
  return {
    left,
    right,
    word: text.slice(left, right)
  }
}
