import { URL_REG, DATA_URL_REG } from '../config'
import { correctImageSrc } from '../utils/getImageInfo'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRange {
  start: CursorPosition
  end: CursorPosition
}

interface BlockLike {
  key: string
  type: string
  text: string
  functionType?: string
  children?: BlockLike[]
  [key: string]: unknown
}

interface ImageRange {
  start: number
  end: number
}

interface ImageTokenLike {
  type: string
  range: ImageRange
  alt?: string
  src?: string
  attrs: Record<string, string>
}

interface ImageInfoLike {
  imageId: string
  key: string
  token: ImageTokenLike
}

interface SelectionFormatLike {
  type: string
  range: ImageRange
  alt?: string
  src?: string
}

interface SelectionFormatsResult {
  formats: SelectionFormatLike[]
}

interface EventCenterLike {
  dispatch(event: string, data: { reference: Element | null }): void
}

interface MuyaLike {
  dispatchChange(): void
  eventCenter: EventCenterLike
}

interface InsertImageOptions {
  alt?: string
  src?: string
  title?: string
}

interface ImageCtrlMethods {
  insertImage(image: InsertImageOptions): void
  updateImage(imageInfo: ImageInfoLike, attrName: string, attrValue: string | number): void
  replaceImage(imageInfo: Pick<ImageInfoLike, 'key' | 'token'>, image: InsertImageOptions): void
  deleteImage(imageInfo: Pick<ImageInfoLike, 'key' | 'token'>): void
  selectImage(imageInfo: Pick<ImageInfoLike, 'key' | 'token'>): void
}

interface ContentStateLike {
  cursor: CursorRange
  prevCursor: CursorRange
  selectedImage: unknown
  muya: MuyaLike
  getBlock(key: string): BlockLike
  selectionFormats(cursor: CursorRange): SelectionFormatsResult
  partialRender(): void
  singleRender(block: BlockLike, isRenderCursor?: boolean): void
  findOutMostBlock(block: BlockLike): BlockLike
}

type ContentStateConstructor = {
  prototype: unknown
}

const imageCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & ImageCtrlMethods

  prototype.insertImage = function ({ alt = '', src = '', title = '' }: InsertImageOptions) {
    const match = /(?:\/|\\)?([^./\\]+)\.[a-z]+$/.exec(src)
    if (!alt) {
      alt = match?.[1] ?? ''
    }

    const { start, end } = this.cursor
    const { formats } = this.selectionFormats({ start, end })
    const { key, offset: startOffset } = start
    const { offset: endOffset } = end
    const block = this.getBlock(key)
    if (
      block.type === 'span' &&
      (
        block.functionType === 'codeContent' ||
        block.functionType === 'languageInput' ||
        block.functionType === 'thematicBreakLine'
      )
    ) {
      return
    }
    const { text } = block
    const imageFormat = formats.filter(format => format.type === 'image')
    let imgUrl: string
    if (URL_REG.test(src)) {
      imgUrl = encodeURI(src)
    } else if (DATA_URL_REG.test(src)) {
      imgUrl = src
    } else {
      imgUrl = src.replace(/ /g, encodeURI(' ')).replace(/#/g, encodeURIComponent('#'))
    }

    let srcAndTitle = imgUrl

    if (srcAndTitle && title) {
      srcAndTitle += ` "${title}"`
    }

    if (
      imageFormat.length === 1 &&
      imageFormat[0].range.start !== startOffset &&
      imageFormat[0].range.end !== endOffset
    ) {
      let imageAlt = alt

      if (imageFormat[0].alt && !imageFormat[0].src) {
        imageAlt = imageFormat[0].alt
      }

      const { start, end } = imageFormat[0].range
      block.text = text.substring(0, start) +
        `![${imageAlt}](${srcAndTitle})` +
        text.substring(end)

      this.cursor = {
        start: { key, offset: start + 2 },
        end: { key, offset: start + 2 + imageAlt.length }
      }
    } else if (key !== end.key) {
      const endBlock = this.getBlock(end.key)
      const { text: endText } = endBlock
      endBlock.text = endText.substring(0, endOffset) + `![${alt}](${srcAndTitle})` + endText.substring(endOffset)
      const offset = endOffset + 2
      this.cursor = {
        start: { key: end.key, offset },
        end: { key: end.key, offset: offset + alt.length }
      }
    } else {
      const imageAlt = startOffset !== endOffset ? text.substring(startOffset, endOffset) : alt
      block.text = text.substring(0, start.offset) +
        `![${imageAlt}](${srcAndTitle})` +
        text.substring(end.offset)

      this.cursor = {
        start: {
          key,
          offset: startOffset + 2
        },
        end: {
          key,
          offset: startOffset + 2 + imageAlt.length
        }
      }
    }
    this.partialRender()
    this.muya.dispatchChange()
  }

  prototype.updateImage = function (
    { imageId, key, token }: ImageInfoLike,
    attrName: string,
    attrValue: string | number
  ) {
    const block = this.getBlock(key)
    const { range } = token
    const { start, end } = range
    const oldText = block.text
    const attrs = Object.assign({}, token.attrs) as Record<string, string | number>
    attrs[attrName] = attrValue

    let imageText = '<img '
    for (const attr of Object.keys(attrs)) {
      let value = attrs[attr]
      if (value && attr === 'src') {
        value = correctImageSrc(`${value}`)
      }
      imageText += `${attr}="${value}" `
    }
    imageText = imageText.trim()
    imageText += '>'
    block.text = oldText.substring(0, start) + imageText + oldText.substring(end)

    this.singleRender(block, false)
    const image = document.querySelector<HTMLElement>(`#${imageId} img`)
    if (image) {
      image.click()
      return this.muya.dispatchChange()
    }
  }

  prototype.replaceImage = function (
    { key, token }: Pick<ImageInfoLike, 'key' | 'token'>,
    { alt = '', src = '', title = '' }: InsertImageOptions
  ) {
    const { type } = token
    const block = this.getBlock(key)
    const { start, end } = token.range
    const oldText = block.text
    let imageText = ''
    if (type === 'image') {
      imageText = '!['
      if (alt) {
        imageText += alt
      }
      imageText += ']('
      if (src) {
        imageText += src.replace(/ /g, encodeURI(' ')).replace(/#/g, encodeURIComponent('#'))
      }
      if (title) {
        imageText += ` "${title}"`
      }
      imageText += ')'
    } else if (type === 'html_tag') {
      const attrs = Object.assign({}, token.attrs) as Record<string, string>
      Object.assign(attrs, { alt, src, title })
      imageText = '<img '
      for (const attr of Object.keys(attrs)) {
        let value = attrs[attr]
        if (value && attr === 'src') {
          value = correctImageSrc(value)
        }
        imageText += `${attr}="${value}" `
      }
      imageText = imageText.trim()
      imageText += '>'
    }

    block.text = oldText.substring(0, start) + imageText + oldText.substring(end)

    this.singleRender(block)
    return this.muya.dispatchChange()
  }

  prototype.deleteImage = function ({ key, token }: Pick<ImageInfoLike, 'key' | 'token'>) {
    const block = this.getBlock(key)
    const oldText = block.text
    const { start, end } = token.range
    const { eventCenter } = this.muya
    block.text = oldText.substring(0, start) + oldText.substring(end)

    this.cursor = {
      start: { key, offset: start },
      end: { key, offset: start }
    }
    this.singleRender(block)
    eventCenter.dispatch('muya-transformer', { reference: null })
    eventCenter.dispatch('muya-image-toolbar', { reference: null })
    return this.muya.dispatchChange()
  }

  prototype.selectImage = function (imageInfo: Pick<ImageInfoLike, 'key' | 'token'>) {
    this.selectedImage = imageInfo
    const { key } = imageInfo
    const block = this.getBlock(key)
    const outMostBlock = this.findOutMostBlock(block)
    this.cursor = {
      start: { key, offset: imageInfo.token.range.end },
      end: { key, offset: imageInfo.token.range.end }
    }
    const { start } = this.prevCursor
    const oldBlock = this.findOutMostBlock(this.getBlock(start.key))
    if (oldBlock.key !== outMostBlock.key) {
      this.singleRender(oldBlock, false)
    }

    return this.singleRender(outMostBlock, true)
  }
}

export default imageCtrl
