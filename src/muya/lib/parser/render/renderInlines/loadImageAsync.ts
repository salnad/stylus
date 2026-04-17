import { getUniqueId, loadImage } from '../../../utils'
import { insertAfter, operateClassName } from '../../../utils/domManipulate'
import { CLASS_OR_ID } from '../../../config'
import type {
  ImageAttrs,
  ImageInfoLike,
  InlineRenderContextLike,
  LoadImageAsyncResult
} from './types'

interface LoadImageResult {
  url: string
  width: number
  height: number
}

export default function loadImageAsync (
  this: InlineRenderContextLike,
  imageInfo: ImageInfoLike,
  attrs: ImageAttrs,
  className?: string,
  imageClass?: string
): LoadImageAsyncResult {
  const { src, isUnknownType } = imageInfo
  let id: string | undefined
  let isSuccess: boolean | undefined
  let width: number | undefined
  let height: number | undefined
  let domsrc: string | undefined

  let reload = false
  if (this.loadImageMap.has(src)) {
    const cachedImage = this.loadImageMap.get(src)
    if (cachedImage?.dispMsec !== cachedImage?.touchMsec) {
      // We have a cached image, but force it to load.
      reload = true
    }
  } else {
    reload = true
  }

  if (reload) {
    id = getUniqueId()
    loadImage(src, Boolean(isUnknownType))
      .then(({ url, width: nextWidth, height: nextHeight }: LoadImageResult) => {
        const imageText = document.querySelector<HTMLElement>(`#${id}`)
        const img = document.createElement('img')
        const dispMsec = Date.now()
        const touchMsec = dispMsec
        if (/^file:\/\//.test(src)) {
          domsrc = `${url}?msec=${dispMsec}`
        } else {
          domsrc = url
        }
        img.src = domsrc
        if (attrs.alt) img.alt = attrs.alt.replace(/[`*{}[\]()#+\-.!_>~:|<>$]/g, '')
        if (attrs.title) img.setAttribute('title', attrs.title)
        if (typeof attrs.width === 'number') {
          img.setAttribute('width', String(attrs.width))
        }
        if (typeof attrs.height === 'number') {
          img.setAttribute('height', String(attrs.height))
        }
        if (imageClass) {
          img.classList.add(imageClass)
        }

        if (imageText) {
          if (imageText.classList.contains('ag-inline-image')) {
            const imageContainer = imageText.querySelector('.ag-image-container') as HTMLElement | null
            const oldImage = imageContainer?.querySelector('img') ?? null
            if (oldImage) {
              oldImage.remove()
            }
            imageContainer?.appendChild(img)
            imageText.classList.remove('ag-image-loading')
            imageText.classList.add('ag-image-success')
          } else {
            insertAfter(img, imageText)
            if (className) {
              operateClassName(imageText, 'add', className)
            }
          }
        }
        if (this.urlMap.has(src)) {
          this.urlMap.delete(src)
        }
        this.loadImageMap.set(src, {
          id,
          isSuccess: true,
          width: nextWidth,
          height: nextHeight,
          dispMsec,
          touchMsec,
          domsrc
        })
      })
      .catch(() => {
        const imageText = document.querySelector<HTMLElement>(`#${id}`)
        if (imageText) {
          operateClassName(imageText, 'remove', CLASS_OR_ID.AG_IMAGE_LOADING)
          operateClassName(imageText, 'add', CLASS_OR_ID.AG_IMAGE_FAIL)
          const image = imageText.querySelector('img')
          if (image) {
            image.remove()
          }
        }
        if (this.urlMap.has(src)) {
          this.urlMap.delete(src)
        }
        this.loadImageMap.set(src, {
          id,
          isSuccess: false
        })
      })
  } else {
    const cachedImage = this.loadImageMap.get(src)

    id = cachedImage?.id
    isSuccess = cachedImage?.isSuccess
    width = cachedImage?.width
    height = cachedImage?.height
    domsrc = cachedImage?.domsrc
  }

  return { id, isSuccess, domsrc, width, height }
}
