import { deepCopy } from '../utils'
import { UNDO_DEPTH } from '../config'

interface CursorLike {
  noHistory?: boolean
  [key: string]: unknown
}

interface HistoryStateSnapshot {
  blocks: unknown
  cursor: CursorLike
  renderRange: unknown
}

interface ContentStateLike {
  blocks: unknown
  renderRange: unknown
  cursor: CursorLike
  render(): void
}

class History {
  public stack: HistoryStateSnapshot[]
  public index: number
  public contentState: ContentStateLike
  public pending: HistoryStateSnapshot | null

  constructor (contentState: ContentStateLike) {
    this.stack = []
    this.index = -1
    this.contentState = contentState
    this.pending = null
  }

  undo (): void {
    this.commitPending()
    if (this.index > 0) {
      this.index = this.index - 1

      const state = deepCopy(this.stack[this.index]) as HistoryStateSnapshot
      const { blocks, cursor, renderRange } = state
      cursor.noHistory = true
      this.contentState.blocks = blocks
      this.contentState.renderRange = renderRange
      this.contentState.cursor = cursor
      this.contentState.render()
    }
  }

  redo (): void {
    this.pending = null
    const { index, stack } = this
    const len = stack.length
    if (index < len - 1) {
      this.index = index + 1
      const state = deepCopy(stack[this.index]) as HistoryStateSnapshot
      const { blocks, cursor, renderRange } = state
      cursor.noHistory = true
      this.contentState.blocks = blocks
      this.contentState.renderRange = renderRange
      this.contentState.cursor = cursor
      this.contentState.render()
    }
  }

  push (state: HistoryStateSnapshot): void {
    this.pending = null
    this.stack.splice(this.index + 1)
    const copyState = deepCopy(state) as HistoryStateSnapshot
    this.stack.push(copyState)
    if (this.stack.length > UNDO_DEPTH) {
      this.stack.shift()
      this.index = this.index - 1
    }
    this.index = this.index + 1
  }

  pushPending (state: HistoryStateSnapshot): void {
    this.pending = state
  }

  commitPending (): void {
    if (this.pending) {
      this.push(this.pending)
    }
  }

  clearHistory (): void {
    this.stack = []
    this.index = -1
    this.pending = null
  }
}

export default History
