import selection from '../selection'

interface CursorPointLike {
  key: string
  offset: number
}

interface CursorRangeLike {
  start: CursorPointLike
  end: CursorPointLike
}

interface TextBlockLike {
  key: string
  type: string
  text: string
  functionType?: string
}

interface ContentStateLike {
  selectedImage: unknown
  selectedTableCells: unknown
  getBlock(key: string): TextBlockLike
  findNextBlockInLocation(block: TextBlockLike): TextBlockLike | null
  deleteImage(image: unknown): void
  deleteSelectedTableCells(): void
  getParent(block: TextBlockLike): TextBlockLike | null
  isOnlyRemoveableChild(block: TextBlockLike): boolean
  removeBlock(block: TextBlockLike): void
  singleRender(block: TextBlockLike): void
  render(): void
  cursor: CursorRangeLike
}

const deleteCtrl = (ContentState: {
  prototype: ContentStateLike & {
    docDeleteHandler(event: KeyboardEvent): void
    deleteHandler(event: KeyboardEvent): void
  }
}): void => {
  ContentState.prototype.docDeleteHandler = function (event: KeyboardEvent): void {
    const { selectedImage } = this
    if (selectedImage) {
      event.preventDefault()
      this.selectedImage = null
      this.deleteImage(selectedImage)
      return
    }
    if (this.selectedTableCells) {
      event.preventDefault()
      this.deleteSelectedTableCells()
    }
  }

  ContentState.prototype.deleteHandler = function (event: KeyboardEvent): void {
    const { start, end } = selection.getCursorRange() as {
      start?: CursorPointLike | null
      end?: CursorPointLike | null
    }
    if (!start || !end) {
      return
    }
    const startBlock = this.getBlock(start.key)
    const nextBlock = this.findNextBlockInLocation(startBlock)

    if (startBlock.type === 'figure') event.preventDefault()
    if (start.key !== end.key || start.offset !== end.offset) {
      return
    }

    const { type, text, key } = startBlock
    if (/span/.test(type) && start.offset === 0 && text[1] === '\n') {
      event.preventDefault()
      startBlock.text = text.substring(2)
      this.cursor = {
        start: { key, offset: 0 },
        end: { key, offset: 0 }
      }
      this.singleRender(startBlock)
      return
    }
    if (/h\d|span/.test(type) && start.offset === text.length) {
      event.preventDefault()
      if (nextBlock && /h\d|span/.test(nextBlock.type)) {
        if (nextBlock.functionType === 'codeContent' && startBlock.functionType === 'languageInput') {
          return
        }

        startBlock.text += nextBlock.text

        const toBeRemoved: TextBlockLike[] = [nextBlock]

        let parent = this.getParent(nextBlock)
        let target = nextBlock

        while (parent && this.isOnlyRemoveableChild(target)) {
          toBeRemoved.push(parent)
          target = parent
          parent = this.getParent(parent)
        }

        toBeRemoved.forEach(block => this.removeBlock(block))

        const offset = start.offset
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.render()
      }
    }
  }
}

export default deleteCtrl
