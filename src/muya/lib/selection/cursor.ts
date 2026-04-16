import { compareParagraphsOrder } from './dom'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorConstructorOptions {
  anchor?: CursorPosition
  focus?: CursorPosition
  start?: CursorPosition
  end?: CursorPosition
  noHistory?: boolean
}

class Cursor {
  anchor?: CursorPosition
  focus?: CursorPosition
  start?: CursorPosition
  end?: CursorPosition
  noHistory: boolean

  constructor ({ anchor, focus, start, end, noHistory = false }: CursorConstructorOptions) {
    if (anchor && focus && start && end) {
      this.anchor = anchor
      this.focus = focus
      this.start = start
      this.end = end
    } else if (anchor && focus) {
      this.anchor = anchor
      this.focus = focus
      if (anchor.key === focus.key) {
        if (anchor.offset <= focus.offset) {
          this.start = this.anchor
          this.end = this.focus
        } else {
          this.start = this.focus
          this.end = this.anchor
        }
      } else {
        const anchorParagraph = document.querySelector<HTMLElement>(`#${anchor.key}`)
        const focusParagraph = document.querySelector<HTMLElement>(`#${focus.key}`)
        let order = 1
        if (anchorParagraph && focusParagraph) {
          order = compareParagraphsOrder(anchorParagraph, focusParagraph)
        }

        if (order) {
          this.start = this.anchor
          this.end = this.focus
        } else {
          this.start = this.focus
          this.end = this.anchor
        }
      }
    } else {
      this.anchor = start
      this.start = start
      this.focus = end
      this.end = end
    }
    this.noHistory = noHistory
  }
}

export default Cursor
