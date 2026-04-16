import { isWin } from '../config'
import { findNearestParagraph, getOffsetOfParagraph } from '../selection/dom'
import { tokenizer } from '../parser'

interface ImageInfoToken {
  range?: {
    start: number
    end: number
  }
  [key: string]: unknown
}

interface ImageElementLike extends HTMLElement {
  getAttribute(name: string): string | null
}

export const getImageInfo = (image: ImageElementLike): {
  key: string
  token: ImageInfoToken
  imageId: string
} => {
  const paragraph = findNearestParagraph(image) as HTMLElement
  const raw = image.getAttribute('data-raw') ?? ''
  const offset = getOffsetOfParagraph(image, paragraph)
  const tokens = tokenizer(raw) as ImageInfoToken[]
  const token = tokens[0]

  token.range = {
    start: offset,
    end: offset + raw.length
  }

  return {
    key: paragraph.id,
    token,
    imageId: image.id
  }
}

export const correctImageSrc = (src: string): string => {
  let nextSrc = src
  if (nextSrc) {
    if (isWin && /^(?:[a-zA-Z]:\\|[a-zA-Z]:\/).+/.test(nextSrc)) {
      nextSrc = 'file:///' + nextSrc.replace(/\\/g, '/')
    } else if (isWin && /^\\\\\?\\.+/.test(nextSrc)) {
      nextSrc = 'file:///' + nextSrc.substring(4).replace(/\\/g, '/')
    } else if (/^\/.+/.test(nextSrc)) {
      nextSrc = 'file://' + nextSrc
    }
  }
  return nextSrc
}
