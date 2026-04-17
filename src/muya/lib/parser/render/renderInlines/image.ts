import { CLASS_OR_ID } from '../../../config'
import { getImageInfo } from '../../../utils'
import ImageIcon from '../../../assets/pngicon/image/2.png'
import ImageFailIcon from '../../../assets/pngicon/image_fail/2.png'
import DeleteIcon from '../../../assets/pngicon/delete/2.png'
import type {
  BlockLike,
  CursorRangeLike,
  ImageAttrs,
  ImageInfoLike,
  InlineRenderContextLike,
  RenderChildren,
  RenderVNode,
  SnabbdomDataLike,
  SnabbdomHelper,
  TokenLike
} from './types'

interface ImageToken extends TokenLike {
  raw: string
  attrs: ImageAttrs
}

const renderIcon = (h: SnabbdomHelper, className: string, icon: string): RenderVNode => {
  const selector = `a.${className}`
  const iconVnode = h('i.icon', h('i.icon-inner', {
    style: {
      background: `url(${icon}) no-repeat`,
      'background-size': '100%'
    }
  }, ''))

  return h(selector, {
    attrs: {
      contenteditable: 'false'
    }
  }, iconVnode)
}

// I dont want operate dom directly, is there any better method? need help!
export default function image (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  block: BlockLike,
  token: ImageToken,
  _outerClass?: string
): RenderChildren {
  const imageInfo = getImageInfo(token.attrs.src ?? '') as ImageInfoLike
  const { selectedImage } = this.muya.contentState
  const data: SnabbdomDataLike = {
    dataset: {
      raw: token.raw
    }
  }
  let id: string | undefined
  let isSuccess: boolean | undefined
  let domsrc: string | undefined
  let { src } = imageInfo
  const alt = token.attrs.alt ?? ''
  const title = token.attrs.title
  const width = token.attrs.width
  const height = token.attrs.height

  if (src) {
    ({ id, isSuccess, domsrc } = this.loadImageAsync(imageInfo, token.attrs))
  }

  let wrapperSelector = id
    ? `span#${isSuccess ? `${block.key}_${id}_${token.range.start}` : id}.${CLASS_OR_ID.AG_INLINE_IMAGE}`
    : `span.${CLASS_OR_ID.AG_INLINE_IMAGE}`

  const imageIcons = [
    renderIcon(h, 'ag-image-icon-success', ImageIcon),
    renderIcon(h, 'ag-image-icon-fail', ImageFailIcon),
    renderIcon(h, 'ag-image-icon-close', DeleteIcon)
  ]

  const renderImageContainer = (...args: RenderChildren): RenderVNode => {
    const containerData: SnabbdomDataLike = {}
    if (title) {
      Object.assign(containerData, {
        dataset: { title }
      })
    }
    return h(`span.${CLASS_OR_ID.AG_IMAGE_CONTAINER}`, containerData, args)
  }

  if (typeof token.attrs['data-align'] === 'string') {
    wrapperSelector += `.${token.attrs['data-align']}`
  }

  // the src image is still loading, so use the url Map base64.
  if (src && this.urlMap.has(src)) {
    // fix: it will generate a new id if the image is not loaded.
    if (selectedImage && selectedImage.token.attrs.src === src && selectedImage.imageId !== id) {
      selectedImage.imageId = id
    }
    src = this.urlMap.get(src) ?? src
    isSuccess = true
  }

  if (alt.startsWith('loading-')) {
    wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_UPLOADING}`
    Object.assign(data.dataset as Record<string, unknown>, {
      id: alt
    })
    if (this.urlMap.has(alt)) {
      src = this.urlMap.get(alt) ?? src
      isSuccess = true
    }
  }

  if (src) {
    // image is loading...
    if (typeof isSuccess === 'undefined') {
      wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_LOADING}`
    } else if (isSuccess === true) {
      wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_SUCCESS}`
    } else {
      wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_FAIL}`
    }

    // Add image selected class name.
    if (selectedImage) {
      const { key, token: selectToken } = selectedImage
      if (
        key === block.key &&
        selectToken.range.start === token.range.start &&
        selectToken.range.end === token.range.end
      ) {
        wrapperSelector += `.${CLASS_OR_ID.AG_INLINE_IMAGE_SELECTED}`
      }
    }

    const renderImage = (): RenderVNode => {
      const imageData: SnabbdomDataLike = {
        props: {
          alt: alt.replace(/[`*{}[\]()#+\-.!_>~:|<>$]/g, '')
        }
      }

      if (domsrc) {
        Object.assign(imageData.props as Record<string, unknown>, { src: domsrc })
      }

      if (title) {
        Object.assign(imageData.props as Record<string, unknown>, { title })
      }

      if (typeof width === 'number') {
        Object.assign(imageData.props as Record<string, unknown>, { width })
      }

      if (typeof height === 'number') {
        Object.assign(imageData.props as Record<string, unknown>, { height })
      }

      return h('img', imageData)
    }

    return isSuccess
      ? [
        h(wrapperSelector, data, [
          ...imageIcons,
          renderImageContainer(
            // An image description has inline elements as its contents.
            // When an image is rendered to HTML, this is standardly used as the image’s alt attribute.
            renderImage()
          )
        ])
      ]
      : [
        h(wrapperSelector, data, [
          ...imageIcons,
          renderImageContainer()
        ])
      ]
  } else {
    wrapperSelector += `.${CLASS_OR_ID.AG_EMPTY_IMAGE}`
    return [
      h(wrapperSelector, data, [
        ...imageIcons,
        renderImageContainer()
      ])
    ]
  }
}
