interface LineCursorPosition {
  key: string
  offset: number
  block: {
    text: string
  }
}

interface LineCursorRange {
  start: LineCursorPosition
  end: LineCursorPosition
}

interface WordCursorPosition {
  key: string
  offset: number
}

interface WordCursorRange {
  start: WordCursorPosition
  end: WordCursorPosition
}

interface ContentStateLike {
  partialRender(): void
  muya: {
    dispatchSelectionChange(): void
    dispatchChange(): void
  }
  cursor: {
    start: WordCursorPosition
    end: WordCursorPosition
  }
}

type ContentStateConstructor = {
  prototype: ContentStateLike & {
    replaceWordInline(
      line: LineCursorRange,
      wordCursor: WordCursorRange,
      replacement: string,
      setCursor?: boolean
    ): void
  }
}

const coreApi = (ContentState: ContentStateConstructor): void => {
  ContentState.prototype.replaceWordInline = function (
    line: LineCursorRange,
    wordCursor: WordCursorRange,
    replacement: string,
    setCursor = false
  ) {
    const { start: lineStart, end: lineEnd } = line
    const { start: wordStart, end: wordEnd } = wordCursor

    if (wordStart.key !== wordEnd.key) {
      throw new Error('Expect a single line word cursor: "start.key" is not equal to "end.key".')
    } else if (lineStart.key !== lineEnd.key) {
      throw new Error('Expect a single line line cursor: "start.key" is not equal to "end.key".')
    } else if (wordStart.offset > wordEnd.offset) {
      throw new Error(`Invalid word cursor offset: ${wordStart.offset} should be less ${wordEnd.offset}.`)
    } else if (lineStart.key !== wordEnd.key) {
      throw new Error(`Cursor mismatch: Expect the same line but got ${lineStart.key} and ${wordEnd.key}.`)
    } else if (lineStart.block.text.length < wordEnd.offset) {
      throw new Error('Invalid cursor: Replacement length is larger than line length.')
    }

    const { block } = lineStart
    const { offset: left } = wordStart
    const { offset: right } = wordEnd

    block.text = block.text.substr(0, left) + replacement + block.text.substr(right)

    if (setCursor) {
      const cursor = Object.assign({}, wordStart, {
        offset: left + replacement.length
      })
      line.start = cursor as LineCursorPosition
      line.end = cursor as LineCursorPosition
      this.cursor = {
        start: cursor,
        end: cursor
      }
    }

    this.partialRender()
    this.muya.dispatchSelectionChange()
    this.muya.dispatchChange()
  }
}

export default coreApi
