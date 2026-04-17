import selection from '../selection'
import { tokenizer, generator } from '../parser'
import { FORMAT_MARKER_MAP, FORMAT_TYPES } from '../config'
import { getImageInfo } from '../utils/getImageInfo'

interface PositionLike {
  offset: number
  delata?: number
  [key: string]: unknown
}

interface CursorPosition extends PositionLike {
  key: string
}

interface CursorRangeLike {
  start?: CursorPosition | null
  end?: CursorPosition | null
  [key: string]: unknown
}

interface RangeLike {
  start: number
  end: number
}

interface MarkerPair {
  open: string
  close: string
}

interface BlockLike {
  key: string
  type: string
  text: string
  functionType?: string
  [key: string]: unknown
}

interface FormatToken {
  type: string
  raw: string
  parent: FormatToken[]
  range: RangeLike
  marker?: string
  content?: string
  tag?: string
  anchor?: string
  alt?: string
  src?: string
  children?: FormatToken[] | ''
  [key: string]: unknown
}

interface SelectionFormatsResult {
  formats: FormatToken[]
  tokens: FormatToken[]
  neighbors: FormatToken[]
}

interface EventCenterLike {
  dispatch(event: string, payload: unknown): unknown
}

interface MuyaLike {
  options: Record<string, unknown>
  eventCenter: EventCenterLike
}

interface ContentStateLike {
  muya: MuyaLike
  cursor: {
    start: CursorPosition
    end: CursorPosition
    [key: string]: unknown
  }
  getBlock(key: string): BlockLike | null
  findNextBlockInLocation(block: BlockLike): BlockLike | null | undefined
  partialRender(): void
}

interface FormatCtrlMethods {
  selectionFormats(cursor?: CursorRangeLike): SelectionFormatsResult
  clearBlockFormat(block: BlockLike, cursor?: CursorRangeLike, type?: string): false | void
  format(type: string): void
}

interface SelectionLike {
  getCursorRange(): CursorRangeLike
  getSelectionStart(): Node | null
}

type ContentStateConstructor = {
  prototype: unknown
}

const selectionApi = selection as unknown as SelectionLike
const formatTypes = FORMAT_TYPES as readonly string[]

const getMarkerPair = (type: string): MarkerPair => {
  return FORMAT_MARKER_MAP[type] as MarkerPair
}

const getMarker = (type: string): string => {
  return FORMAT_MARKER_MAP[type] as string
}

const getOffset = (offset: number, token: FormatToken): number | undefined => {
  const {
    range: { start, end },
    type,
    tag,
    anchor = '',
    alt = ''
  } = token
  const dis = offset - start
  const len = end - start
  switch (type) {
    case 'strong':
    case 'del':
    case 'em':
    case 'inline_code':
    case 'inline_math': {
      const markerLength = type === 'strong' || type === 'del' ? 2 : 1
      if (dis < 0) return 0
      if (dis >= 0 && dis < markerLength) return -dis
      if (dis >= markerLength && dis <= len - markerLength) return -markerLength
      if (dis > len - markerLength && dis <= len) return len - dis - 2 * markerLength
      if (dis > len) return -2 * markerLength
      break
    }
    case 'html_tag': { // handle underline, sup, sub
      const { open, close } = getMarkerPair(tag as string)
      const openMarkerLength = open.length
      const closeMarkerLength = close.length
      if (dis < 0) return 0
      if (dis >= 0 && dis < openMarkerLength) return -dis
      if (dis >= openMarkerLength && dis <= len - closeMarkerLength) return -openMarkerLength
      if (dis > len - closeMarkerLength && dis <= len) return len - dis - openMarkerLength - closeMarkerLength
      if (dis > len) return -openMarkerLength - closeMarkerLength
      break
    }
    case 'link': {
      const markerLength = 1
      if (dis < markerLength) return 0
      if (dis >= markerLength && dis <= markerLength + anchor.length) return -1
      if (dis > markerLength + anchor.length) return anchor.length - dis
      break
    }
    case 'image': {
      const markerLength = 1
      if (dis < markerLength) return 0
      if (dis >= markerLength && dis < markerLength * 2) return -1
      if (dis >= markerLength * 2 && dis <= markerLength * 2 + alt.length) return -2
      if (dis > markerLength * 2 + alt.length) return alt.length - dis
      break
    }
  }
}

const clearFormat = (
  token: FormatToken,
  { start, end }: { start?: PositionLike | null, end?: PositionLike | null }
): void => {
  if (start) {
    const deltaStart = getOffset(start.offset, token) as number
    start.delata = (start.delata as number) + deltaStart
  }
  if (end) {
    const deltaEnd = getOffset(end.offset, token) as number
    end.delata = (end.delata as number) + deltaEnd
  }

  switch (token.type) {
    case 'strong':
    case 'del':
    case 'em':
    case 'link':
    case 'html_tag': { // underline, sub, sup
      const { parent } = token
      const index = parent.indexOf(token)
      const childTokens = Array.isArray(token.children) ? token.children : []
      parent.splice(index, 1, ...childTokens)
      break
    }
    case 'image': {
      token.type = 'text'
      token.raw = token.alt || ''
      delete token.marker
      delete token.src
      break
    }
    case 'inline_math':
    case 'inline_code': {
      token.type = 'text'
      token.raw = token.content || ''
      delete token.marker
      break
    }
  }
}

const addFormat = (
  type: string,
  block: BlockLike,
  { start, end }: { start: PositionLike, end: PositionLike }
): false | void => {
  if (
    block.type !== 'span' ||
    (block.type === 'span' && !/paragraphContent|cellContent|atxLine/.test(block.functionType || ''))
  ) {
    return false
  }

  switch (type) {
    case 'em':
    case 'del':
    case 'inline_code':
    case 'strong':
    case 'inline_math': {
      const marker = getMarker(type)
      const oldText = block.text
      block.text = oldText.substring(0, start.offset) +
        marker + oldText.substring(start.offset, end.offset) +
        marker + oldText.substring(end.offset)
      start.offset += marker.length
      end.offset += marker.length
      break
    }
    case 'sub':
    case 'sup':
    case 'mark':
    case 'u': {
      const marker = getMarkerPair(type)
      const oldText = block.text
      block.text = oldText.substring(0, start.offset) +
        marker.open + oldText.substring(start.offset, end.offset) +
        marker.close + oldText.substring(end.offset)
      start.offset += marker.open.length
      end.offset += marker.open.length
      break
    }
    case 'link':
    case 'image': {
      const oldText = block.text
      const anchorTextLen = end.offset - start.offset
      block.text = oldText.substring(0, start.offset) +
        (type === 'link' ? '[' : '![') +
        oldText.substring(start.offset, end.offset) + ']()' +
        oldText.substring(end.offset)
      // put cursor between `()`
      start.offset += type === 'link' ? 3 + anchorTextLen : 4 + anchorTextLen
      end.offset = start.offset
      break
    }
  }
}

const checkTokenIsInlineFormat = (token: FormatToken): boolean => {
  const { type, tag } = token
  if (formatTypes.includes(type)) return true
  if (type === 'html_tag' && /^(?:u|sub|sup|mark)$/i.test(tag || '')) return true
  return false
}

const formatCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & FormatCtrlMethods

  prototype.selectionFormats = function ({ start, end } = selectionApi.getCursorRange()) {
    if (!start || !end) {
      return { formats: [], tokens: [], neighbors: [] }
    }

    const startBlock = this.getBlock(start.key) as BlockLike
    const formats: FormatToken[] = []
    const neighbors: FormatToken[] = []
    let tokens: FormatToken[] = []
    if (start.key === end.key) {
      const { text } = startBlock
      tokens = tokenizer(text, {
        options: this.muya.options
      }) as FormatToken[]

      const iterator = (nestedTokens: FormatToken[]): void => {
        for (const token of nestedTokens) {
          if (
            checkTokenIsInlineFormat(token) &&
            start.offset >= token.range.start &&
            end.offset <= token.range.end
          ) {
            formats.push(token)
          }
          if (
            checkTokenIsInlineFormat(token) &&
            (
              (start.offset >= token.range.start && start.offset <= token.range.end) ||
              (end.offset >= token.range.start && end.offset <= token.range.end) ||
              (start.offset <= token.range.start && token.range.end <= end.offset)
            )
          ) {
            neighbors.push(token)
          }
          if (Array.isArray(token.children) && token.children.length) {
            iterator(token.children)
          }
        }
      }

      iterator(tokens)
    }

    return { formats, tokens, neighbors }
  }

  prototype.clearBlockFormat = function (block: BlockLike, { start, end } = selectionApi.getCursorRange(), type?: string) {
    if (!start || !end) {
      return
    }
    if (block.type === 'pre') return false
    const { key } = block
    let tokens: FormatToken[] = []
    let neighbors: FormatToken[] = []

    if (start.key === end.key && start.key === key) {
      ({ tokens, neighbors } = this.selectionFormats({ start, end }))
    } else if (start.key !== end.key && start.key === key) {
      ({ tokens, neighbors } = this.selectionFormats({
        start,
        end: { key: start.key, offset: block.text.length }
      }))
    } else if (start.key !== end.key && end.key === key) {
      ({ tokens, neighbors } = this.selectionFormats({
        start: {
          key: end.key,
          offset: 0
        },
        end
      }))
    } else {
      ({ tokens, neighbors } = this.selectionFormats({
        start: {
          key,
          offset: 0
        },
        end: {
          key,
          offset: block.text.length
        }
      }))
    }

    neighbors = type
      ? neighbors.filter(neighbor => {
        return neighbor.type === type ||
          (neighbor.type === 'html_tag' && neighbor.tag === type)
      })
      : neighbors

    for (const neighbor of neighbors) {
      clearFormat(neighbor, { start, end })
    }
    start.offset += start.delata as number
    end.offset += end.delata as number
    block.text = generator(tokens)
  }

  prototype.format = function (type: string) {
    const { start, end } = selectionApi.getCursorRange()
    if (!start || !end) {
      return
    }

    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike
    start.delata = 0
    end.delata = 0

    if (start.key === end.key) {
      const { formats, tokens, neighbors } = this.selectionFormats()
      const currentFormats = formats.filter(format => {
        return format.type === type ||
          (format.type === 'html_tag' && format.tag === type)
      }).reverse()
      const currentNeightbors = neighbors.filter(format => {
        return format.type === type ||
          (format.type === 'html_tag' && format.tag === type)
      }).reverse()
      // cache delata
      if (type === 'clear') {
        for (const neighbor of neighbors) {
          clearFormat(neighbor, { start, end })
        }
        start.offset += start.delata as number
        end.offset += end.delata as number
        startBlock.text = generator(tokens)
      } else if (currentFormats.length) {
        for (const token of currentFormats) {
          clearFormat(token, { start, end })
        }
        start.offset += start.delata as number
        end.offset += end.delata as number
        startBlock.text = generator(tokens)
      } else {
        if (currentNeightbors.length) {
          for (const neighbor of currentNeightbors) {
            clearFormat(neighbor, { start, end })
          }
        }
        start.offset += start.delata as number
        end.offset += end.delata as number
        startBlock.text = generator(tokens)
        addFormat(type, startBlock, { start, end })
        if (type === 'image') {
          // Show image selector when create a inline image by menu/shortcut/or just input `![]()`
          requestAnimationFrame(() => {
            const startNode = selectionApi.getSelectionStart()
            if (startNode instanceof Element) {
              const imageWrapper = startNode.closest('.ag-inline-image') as HTMLElement | null
              if (imageWrapper && imageWrapper.classList.contains('ag-empty-image')) {
                const imageInfo = getImageInfo(imageWrapper)
                this.muya.eventCenter.dispatch('muya-image-selector', {
                  reference: imageWrapper,
                  imageInfo,
                  cb: () => {}
                })
              }
            }
          })
        }
      }
      this.cursor = { start, end }
      this.partialRender()
    } else {
      let nextBlock = startBlock
      const formatType = type !== 'clear' ? type : undefined
      while (nextBlock && nextBlock !== endBlock) {
        this.clearBlockFormat(nextBlock, { start, end }, formatType)
        nextBlock = this.findNextBlockInLocation(nextBlock) as BlockLike
      }
      this.clearBlockFormat(endBlock, { start, end }, formatType)

      if (type !== 'clear') {
        addFormat(type, startBlock, {
          start,
          end: { offset: startBlock.text.length }
        })
        nextBlock = this.findNextBlockInLocation(startBlock) as BlockLike
        while (nextBlock && nextBlock !== endBlock) {
          addFormat(type, nextBlock, {
            start: { offset: 0 },
            end: { offset: nextBlock.text.length }
          })
          nextBlock = this.findNextBlockInLocation(nextBlock) as BlockLike
        }
        addFormat(type, endBlock, {
          start: { offset: 0 },
          end
        })
      }

      this.cursor = { start, end }
      this.partialRender()
    }
  }
}

export default formatCtrl
