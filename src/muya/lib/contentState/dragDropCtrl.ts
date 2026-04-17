import { findNearestParagraph, findOutMostParagraph } from '../selection/dom'
import { verticalPositionInRect, getUniqueId, getImageInfo as getImageSrc, checkImageContentType } from '../utils'
import { getImageInfo } from '../utils/getImageInfo'
import { URL_REG, IMAGE_EXT_REG } from '../config'

const GHOST_ID = 'mu-dragover-ghost'
const GHOST_HEIGHT = 3

type DropPosition = 'up' | 'down'

interface CursorPosition {
  key: string
  offset: number
}

interface BlockLike {
  key: string
  text: string
  type: string
  children: BlockLike[]
  functionType?: string
  [key: string]: unknown
}

interface DropAnchorLike {
  position: DropPosition
  anchor: BlockLike
}

interface ImageInfoLike {
  key: string
  token: {
    range?: {
      start: number
      end: number
    }
    [key: string]: unknown
  }
  imageId: string
}

interface StateRenderLike {
  urlMap: Map<unknown, unknown>
}

interface EventCenterLike {
  dispatch(...args: unknown[]): unknown
}

interface MuyaLike {
  container: HTMLElement
  options: {
    imageAction(image: string | File, id?: string, alt?: string): Promise<string>
    [key: string]: unknown
  }
  eventCenter: EventCenterLike
}

interface ElectronFileLike extends File {
  path: string
}

interface ContentStateLike {
  muya: MuyaLike
  stateRender: StateRenderLike
  dropAnchor: DropAnchorLike | null
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  getBlock(key: string | null | undefined): BlockLike | null
  getAnchor(block: BlockLike | null | undefined): BlockLike | null
  createBlockP(text?: string): BlockLike
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  render(isRenderCursor?: boolean, clearCache?: boolean): void
  replaceImage(imageInfo: Pick<ImageInfoLike, 'key' | 'token'>, image: { alt?: string, src?: string }): void
}

interface DragDropCtrlMethods {
  hideGhost(): void
  createGhost(event: DragEvent): void
  dragoverHandler(event: DragEvent): void
  dragleaveHandler(event: DragEvent): void
  dropHandler(event: DragEvent): Promise<void>
}

type ContentStateConstructor = {
  prototype: unknown
}

const dragDropCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & DragDropCtrlMethods

  prototype.hideGhost = function (): void {
    this.dropAnchor = null
    const ghost = document.querySelector<HTMLElement>(`#${GHOST_ID}`)
    ghost?.remove()
  }

  /**
   * create the ghost element.
   */
  prototype.createGhost = function (event: DragEvent): void {
    const target = event.target instanceof Node ? event.target : null
    let ghost: HTMLElement | null = null
    const nearestParagraph = findNearestParagraph(target)
    const outmostParagraph = target ? findOutMostParagraph(target) : undefined

    if (!outmostParagraph) {
      this.hideGhost()
      return
    }

    const block = nearestParagraph ? this.getBlock(nearestParagraph.id) : null
    let anchor = this.getAnchor(block)

    // dragover preview container
    if (!anchor && outmostParagraph) {
      anchor = this.getBlock(outmostParagraph.id)
    }

    if (anchor) {
      const anchorParagraph = this.muya.container.querySelector<HTMLElement>(`#${anchor.key}`)
      if (!anchorParagraph) {
        return
      }
      const rect = anchorParagraph.getBoundingClientRect()
      const position = verticalPositionInRect(event, rect)
      this.dropAnchor = {
        position,
        anchor
      }
      // create ghost
      ghost = document.querySelector<HTMLElement>(`#${GHOST_ID}`)
      if (!ghost) {
        ghost = document.createElement('div')
        ghost.id = GHOST_ID
        document.body.appendChild(ghost)
      }

      Object.assign(ghost.style, {
        width: `${rect.width}px`,
        left: `${rect.left}px`,
        top: position === 'up' ? `${rect.top - GHOST_HEIGHT}px` : `${rect.top + rect.height}px`
      })
    }
  }

  prototype.dragoverHandler = function (event: DragEvent): void {
    const dataTransfer = event.dataTransfer
    if (!dataTransfer) {
      return
    }

    // Cancel to allow tab drag&drop.
    if (!dataTransfer.types.length) {
      dataTransfer.dropEffect = 'none'
      return
    }

    if (dataTransfer.types.includes('text/uri-list')) {
      const items = Array.from(dataTransfer.items)
      const hasUriItem = items.some(item => item.type === 'text/uri-list')
      const hasTextItem = items.some(item => item.type === 'text/plain')
      const hasHtmlItem = items.some(item => item.type === 'text/html')
      if (hasUriItem && hasHtmlItem && !hasTextItem) {
        this.createGhost(event)
        dataTransfer.dropEffect = 'copy'
      }
    }

    if (dataTransfer.types.indexOf('Files') >= 0) {
      if (dataTransfer.items.length === 1 && dataTransfer.items[0]?.type.indexOf('image') > -1) {
        event.preventDefault()
        this.createGhost(event)
        dataTransfer.dropEffect = 'copy'
      }
    } else {
      event.stopPropagation()
      dataTransfer.dropEffect = 'none'
    }
  }

  prototype.dragleaveHandler = function (_event: DragEvent): void {
    this.hideGhost()
  }

  prototype.dropHandler = async function (event: DragEvent): Promise<void> {
    event.preventDefault()
    const dataTransfer = event.dataTransfer
    const { dropAnchor } = this
    this.hideGhost()

    if (!dataTransfer) {
      return
    }

    // handle drag/drop web link image.
    if (dataTransfer.items.length) {
      for (const item of Array.from(dataTransfer.items)) {
        if (item.kind === 'string' && item.type === 'text/uri-list') {
          item.getAsString(async str => {
            if (URL_REG.test(str) && dropAnchor) {
              let isImage = false
              if (IMAGE_EXT_REG.test(str)) {
                isImage = true
              }
              if (!isImage) {
                isImage = await checkImageContentType(str)
              }
              if (!isImage) return

              const text = `![](${str})`
              const imageBlock = this.createBlockP(text)
              const { anchor, position } = dropAnchor
              if (position === 'up') {
                this.insertBefore(imageBlock, anchor)
              } else {
                this.insertAfter(imageBlock, anchor)
              }

              const key = imageBlock.children[0]?.key
              if (!key) {
                return
              }
              const offset = 0
              this.cursor = {
                start: { key, offset },
                end: { key, offset }
              }
              this.render()
              this.muya.eventCenter.dispatch('stateChange')
            }
          })
        }
      }
    }

    if (dataTransfer.files) {
      const fileList = Array.from(dataTransfer.files) as ElectronFileLike[]
      const image = fileList.find(file => /image/.test(file.type))
      if (image && dropAnchor) {
        const { name, path } = image
        const id = `loading-${getUniqueId()}`
        const text = `![${id}](${path})`
        const imageBlock = this.createBlockP(text)
        const { anchor, position } = dropAnchor
        if (position === 'up') {
          this.insertBefore(imageBlock, anchor)
        } else {
          this.insertAfter(imageBlock, anchor)
        }

        const key = imageBlock.children[0]?.key
        if (!key) {
          return
        }
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.render()

        try {
          const newSrc = await this.muya.options.imageAction(path, id, name)
          const { src } = getImageSrc(path)
          if (src) {
            this.stateRender.urlMap.set(newSrc, src)
          }
          const imageWrapper = this.muya.container.querySelector<HTMLElement>(`span[data-id=${id}]`)

          if (imageWrapper) {
            const imageInfo = getImageInfo(imageWrapper) as ImageInfoLike
            this.replaceImage(imageInfo, {
              alt: name,
              src: newSrc
            })
          }
        } catch (error) {
          // TODO: Notify user about an error.
          console.error('Unexpected error on image action:', error)
        }
      }
      this.muya.eventCenter.dispatch('stateChange')
    }
  }
}

export default dragDropCtrl
