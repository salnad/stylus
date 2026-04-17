import { CLASS_OR_ID } from '../../../config'
import { getImageInfo } from '../../../utils'
import type {
  BlockLike,
  CursorRangeLike,
  ImageInfoLike,
  InlineRenderContextLike,
  LabelValue,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface ReferenceImageToken extends TokenLike {
  label: string
  alt: string
  backlash: {
    second: string
  }
}

// reference_image
export default function referenceImage (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: ReferenceImageToken,
  outerClass?: string
): RenderChildren {
  const className = this.getClassName(outerClass, block, token, cursor)
  const imageClass = CLASS_OR_ID.AG_IMAGE_MARKED_TEXT
  const { start, end } = token.range
  const tag = this.highlight(h, block, start, end, token)
  const { label, backlash, alt } = token
  const rawSrc = label + backlash.second
  let href = ''
  let title = ''
  const labelValue = this.labels.get(rawSrc.toLowerCase()) as LabelValue | undefined
  if (labelValue) {
    ({ href, title } = labelValue)
  }
  const imageInfo = getImageInfo(href) as ImageInfoLike
  const { src } = imageInfo
  let id: string | undefined
  let isSuccess: boolean | undefined
  let domsrc: string | undefined
  let selector: string
  if (src) {
    ({ id, isSuccess, domsrc } = this.loadImageAsync(imageInfo, { alt }, className, CLASS_OR_ID.AG_COPY_REMOVE))
  }
  selector = id ? `span#${id}.${imageClass}` : `span.${imageClass}`
  selector += `.${CLASS_OR_ID.AG_OUTPUT_REMOVE}`
  if (isSuccess) {
    selector += `.${className}`
  } else {
    selector += `.${CLASS_OR_ID.AG_IMAGE_FAIL}`
  }

  return isSuccess
    ? [
      h(selector, tag),
      h(`img.${CLASS_OR_ID.AG_COPY_REMOVE}`, { props: { alt, src: domsrc as string, title } })
    ]
    : [h(selector, tag)]
}
