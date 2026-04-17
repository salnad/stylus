import { createApi } from 'unsplash-js'
import BaseFloat, {
  type BaseFloatCallback,
  type BaseFloatEventCenterLike,
  type BaseFloatOptions,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { EVENT_KEYS, URL_REG, isWin } from '../../config'
import { getUniqueId, getImageInfo as getImageSrc } from '../../utils'
import { getImageInfo } from '../../utils/getImageInfo'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

type ImageSelectorTab = 'select' | 'link' | 'unsplash'
type ImagePathPickerDirection = 'previous' | 'next'
type ImageAction = (image: string | File, id?: string, alt?: string | null) => Promise<string>
type ImagePathPickerCallback = () => string | Promise<string>
type PhotoCreatorClick = (url: string) => void

interface ImageSelectorTabItem {
  label: string
  value: ImageSelectorTab
}

interface ImageAttrs {
  alt?: string
  src?: string
  title?: string
  [key: string]: string | undefined
}

interface ImageInfoTokenRange {
  start: number
  end: number
}

interface ImageInfoToken {
  type: 'image' | 'html_tag' | string
  range: ImageInfoTokenRange
  attrs: ImageAttrs
  [key: string]: unknown
}

interface ImageInfo {
  key: string
  token: ImageInfoToken
  imageId: string
}

interface ReplaceImagePayload {
  alt: string | null
  src: string
  title: string | null
}

interface ImageSelectorState {
  alt: string
  src: string
  title: string
  [key: string]: string
}

interface ImagePickerItem {
  text: string
  iconClass: string
  [key: string]: unknown
}

type ImagePickerCallback = (item: ImagePickerItem) => void

interface ImagePickerEventPayload {
  reference: HTMLInputElement
  list: ImagePickerItem[]
  cb: ImagePickerCallback
}

interface ImagePathPickerLike {
  status: boolean
  activeItem: ImagePickerItem | null
  step(direction: ImagePathPickerDirection): void
  selectItem(item: ImagePickerItem | null): void
}

interface StateRenderLike {
  urlMap: Map<string, string>
}

interface ImageSelectorContentStateLike {
  selectedImage: ImageInfo | null
  stateRender: StateRenderLike
  replaceImage(imageInfo: Pick<ImageInfo, 'key' | 'token'>, image: {
    alt?: string | null
    src?: string
    title?: string | null
  }): void
}

interface ImageSelectorOptions extends Partial<BaseFloatOptions> {
  unsplashAccessKey?: string
  photoCreatorClick?: PhotoCreatorClick
}

interface ImageSelectorMuyaOptions {
  imageAction: ImageAction | null
  imagePathPicker: ImagePathPickerCallback | null
  imagePathAutoComplete: (src: string) => Promise<ImagePickerItem[]>
}

interface ImageSelectorReference {
  getBoundingClientRect(): DOMRect | ClientRect
}

interface ImageSelectorEventPayload {
  reference: ImageSelectorReference | null
  cb?: BaseFloatCallback
  imageInfo?: ImageInfo
}

interface ImageSelectorEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-image-selector', listener: (payload: ImageSelectorEventPayload) => void): void
  dispatch(event: 'muya-image-picker', payload: ImagePickerEventPayload): void
  dispatch(event: 'stateChange'): void
}

interface ImageSelectorMuyaLike extends BaseFloatMuyaLike {
  container: HTMLElement
  eventCenter: ImageSelectorEventCenterLike
  contentState: ImageSelectorContentStateLike
  options: ImageSelectorMuyaOptions
  imagePathPicker: ImagePathPickerLike
}

interface InputValueTarget {
  value: string
}

interface InputValueEvent {
  target: InputValueTarget
}

interface InputKeyboardEvent extends InputValueEvent {
  key: string
  preventDefault(): void
  stopPropagation(): void
}

interface SnabbdomPropsLike {
  placeholder?: string
  value?: string | null
  href?: string
  src?: string
  style?: string
  [key: string]: string | null | undefined
}

interface SnabbdomDataLike {
  props?: SnabbdomPropsLike
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

interface UnsplashFeed<T> {
  results: T[]
}

interface UnsplashPhotoLinks {
  html: string
  download_location: string
}

interface UnsplashPhotoUrls {
  regular: string
  thumb: string
}

interface UnsplashPhotoUserLinks {
  html: string
}

interface UnsplashPhotoUser {
  name: string
  links: UnsplashPhotoUserLinks
}

interface UnsplashPhoto {
  id: string
  color: string | null
  alt_description: string | null
  urls: UnsplashPhotoUrls
  user: UnsplashPhotoUser
  links: UnsplashPhotoLinks
}

interface UnsplashDownloadLocation {
  download_location: string
}

interface UnsplashSuccessResponse<T> {
  type: 'success'
  response: T
}

interface UnsplashErrorResponse {
  type: string
}

type UnsplashApiResponse<T> = UnsplashSuccessResponse<T> | UnsplashErrorResponse

interface UnsplashApiLike {
  photos: {
    list(args: { perPage: number }): Promise<UnsplashApiResponse<UnsplashFeed<UnsplashPhoto>>>
    get(args: { photoId: string }): Promise<UnsplashApiResponse<{ links: UnsplashDownloadLocation }>>
    trackDownload(args: { downloadLocation: string }): Promise<unknown>
  }
  search: {
    getPhotos(args: {
      query: string
      page: number
      perPage: number
    }): Promise<UnsplashApiResponse<UnsplashFeed<UnsplashPhoto>>>
  }
}

interface UnsplashApiFactory {
  (options: { accessKey: string }): UnsplashApiLike
}

const createVNode = h as unknown as SnabbdomHelper
const createUnsplashApi = createApi as unknown as UnsplashApiFactory

const isUnsplashSuccess = <T>(res: UnsplashApiResponse<T>): res is UnsplashSuccessResponse<T> => {
  return res.type === 'success'
}

const toJson = <T>(res: UnsplashApiResponse<T>): Promise<T> => {
  if (isUnsplashSuccess(res)) {
    return Promise.resolve(res.response)
  } else {
    return Promise.reject(new Error(res.type))
  }
}

class ImageSelector extends BaseFloat {
  static pluginName = 'imageSelector'

  declare options: BaseFloatOptions & ImageSelectorOptions

  renderArray: unknown[]
  oldVnode: RenderVNode | null
  imageInfo: ImageInfo | null
  unsplash: UnsplashApiLike | null
  photoList: UnsplashPhoto[]
  loading: boolean
  tab: ImageSelectorTab
  isFullMode: boolean
  state: ImageSelectorState
  imageSelectorContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike, options: ImageSelectorOptions = {}) {
    const name = 'ag-image-selector'
    const { unsplashAccessKey } = options
    const opts = Object.assign(options, {
      placement: 'bottom-center',
      modifiers: {
        offset: {
          offset: '0, 0'
        }
      },
      showArrow: false
    })
    super(muya, name, opts)
    this.renderArray = []
    this.oldVnode = null
    this.imageInfo = null
    if (!unsplashAccessKey) {
      this.unsplash = null
    } else {
      this.unsplash = createUnsplashApi({
        accessKey: unsplashAccessKey
      })
    }
    this.photoList = []
    this.loading = false
    this.tab = 'link'
    this.isFullMode = false
    this.state = {
      alt: '',
      src: '',
      title: ''
    }
    const imageSelectorContainer = this.imageSelectorContainer = document.createElement('div')
    this.container.appendChild(imageSelectorContainer)
    this.floatBox.classList.add('ag-image-selector-wrapper')
    this.listen()
  }

  listen (): void {
    super.listen()
    const muya = this.muya as ImageSelectorMuyaLike
    const { eventCenter } = muya
    eventCenter.subscribe('muya-image-selector', ({ reference, cb, imageInfo }) => {
      if (reference && imageInfo) {
        const { contentState } = muya
        if (contentState.selectedImage) {
          contentState.selectedImage = null
        }

        Object.assign(this.state, imageInfo.token.attrs)

        const imageSrc = this.state.src
        if (imageSrc && /^file:\/\//.test(imageSrc)) {
          let protocolLen = 7
          if (isWin && /^file:\/\/\//.test(imageSrc)) {
            protocolLen = 8
          }
          this.state.src = imageSrc.substring(protocolLen)
        }

        if (this.unsplash) {
          this.loading = true
          this.unsplash.photos.list({
            perPage: 40
          })
            .then(toJson)
            .then(json => {
              this.loading = false
              if (Array.isArray(json.results)) {
                this.photoList = json.results
                if (this.tab === 'unsplash') {
                  this.render()
                }
              }
            })
        }

        this.imageInfo = imageInfo
        this.show(reference as unknown as FloatReference, cb)
        this.render()

        const input = this.imageSelectorContainer.querySelector<HTMLInputElement>('input.src')
        if (input) {
          input.focus()
          input.select()
        }
      } else {
        this.hide()
      }
    })
  }

  searchPhotos = (keyword: string): void => {
    if (!this.unsplash) {
      return
    }

    this.loading = true
    this.photoList = []
    this.unsplash.search.getPhotos({
      query: keyword,
      page: 1,
      perPage: 40
    })
      .then(toJson)
      .then(json => {
        this.loading = false
        if (Array.isArray(json.results)) {
          this.photoList = json.results
          if (this.tab === 'unsplash') {
            this.render()
          }
        }
      })

    this.render()
  }

  tabClick (_event: unknown, tab: ImageSelectorTabItem): void {
    const { value } = tab
    this.tab = value
    this.render()
  }

  toggleMode (): void {
    this.isFullMode = !this.isFullMode
    this.render()
  }

  inputHandler (event: InputValueEvent, type: keyof ImageSelectorState): void {
    const value = event.target.value
    this.state[type] = value
  }

  handleKeyDown (event: InputKeyboardEvent): void {
    if (event.key === EVENT_KEYS.Enter) {
      event.stopPropagation()
      this.handleLinkButtonClick()
    }
  }

  srcInputKeyDown (event: InputKeyboardEvent): void {
    const { imagePathPicker } = this.muya as ImageSelectorMuyaLike
    if (!imagePathPicker.status) {
      if (event.key === EVENT_KEYS.Enter) {
        event.stopPropagation()
        this.handleLinkButtonClick()
      }
      return
    }
    switch (event.key) {
      case EVENT_KEYS.ArrowUp:
        event.preventDefault()
        imagePathPicker.step('previous')
        break
      case EVENT_KEYS.ArrowDown:
      case EVENT_KEYS.Tab:
        event.preventDefault()
        imagePathPicker.step('next')
        break
      case EVENT_KEYS.Enter:
        event.preventDefault()
        imagePathPicker.selectItem(imagePathPicker.activeItem)
        break
      default:
        break
    }
  }

  async handleKeyUp (event: InputKeyboardEvent): Promise<void> {
    const { key } = event
    if (
      key === EVENT_KEYS.ArrowUp ||
      key === EVENT_KEYS.ArrowDown ||
      key === EVENT_KEYS.Tab ||
      key === EVENT_KEYS.Enter
    ) {
      return
    }
    const value = event.target.value
    const muya = this.muya as ImageSelectorMuyaLike
    const { eventCenter } = muya
    const reference = this.imageSelectorContainer.querySelector<HTMLInputElement>('input.src') as HTMLInputElement
    const cb: ImagePickerCallback = item => {
      const { text } = item

      let basePath = ''
      const pathSep = value.match(/(\/|\\)(?:[^/\\]+)$/)
      if (pathSep && pathSep[0] && typeof pathSep.index === 'number') {
        basePath = value.substring(0, pathSep.index + 1)
      }

      const newValue = basePath + text
      const len = newValue.length
      reference.value = newValue
      this.state.src = newValue
      reference.focus()
      reference.setSelectionRange(
        len,
        len
      )
    }

    let list: ImagePickerItem[]
    if (!value) {
      list = []
    } else {
      list = await muya.options.imagePathAutoComplete(value)
    }
    eventCenter.dispatch('muya-image-picker', { reference, list, cb })
  }

  handleLinkButtonClick (): Promise<void> {
    return this.replaceImageAsync(this.state)
  }

  replaceImageAsync = async ({ alt, src, title }: ReplaceImagePayload): Promise<void> => {
    const muya = this.muya as ImageSelectorMuyaLike
    const imageInfo = this.imageInfo as ImageInfo
    if (!muya.options.imageAction || URL_REG.test(src)) {
      const { alt: oldAlt, src: oldSrc, title: oldTitle } = imageInfo.token.attrs
      if (alt !== oldAlt || src !== oldSrc || title !== oldTitle) {
        muya.contentState.replaceImage(imageInfo, { alt, src, title })
      }
      this.hide()
    } else {
      if (src) {
        const id = `loading-${getUniqueId()}`
        muya.contentState.replaceImage(imageInfo, {
          alt: id,
          src,
          title
        })
        this.hide()

        try {
          const newSrc = await muya.options.imageAction(src, id, alt)
          const { src: localPath } = getImageSrc(src)
          if (localPath) {
            muya.contentState.stateRender.urlMap.set(newSrc, localPath)
          }
          const imageWrapper = muya.container.querySelector<HTMLElement>(`span[data-id=${id}]`)

          if (imageWrapper) {
            const nextImageInfo = getImageInfo(imageWrapper) as unknown as ImageInfo
            muya.contentState.replaceImage(nextImageInfo, {
              alt,
              src: newSrc,
              title
            })
          }
        } catch (error) {
          console.error('Unexpected error on image action:', error)
        }
      } else {
        this.hide()
      }
    }
    muya.eventCenter.dispatch('stateChange')
  }

  async handleSelectButtonClick (): Promise<void> {
    const muya = this.muya as ImageSelectorMuyaLike
    if (!muya.options.imagePathPicker) {
      console.warn('You need to add a imagePathPicker option')
      return
    }

    const path = await muya.options.imagePathPicker()
    const { alt, title } = this.state
    return this.replaceImageAsync({
      alt,
      title,
      src: path
    })
  }

  renderHeader (): RenderVNode {
    const tabs: ImageSelectorTabItem[] = [{
      label: 'Select',
      value: 'select'
    }, {
      label: 'Embed link',
      value: 'link'
    }]

    if (this.unsplash) {
      tabs.push({
        label: 'Unsplash',
        value: 'unsplash'
      })
    }

    const children = tabs.map(tab => {
      const itemSelector = this.tab === tab.value ? 'li.active' : 'li'
      return createVNode(itemSelector, createVNode('span', {
        on: {
          click: (event: unknown) => {
            this.tabClick(event, tab)
          }
        }
      }, tab.label))
    })

    return createVNode('ul.header', children)
  }

  renderBody = (): RenderVNode => {
    const { tab, state, isFullMode } = this
    const { alt, title, src } = state
    const bodyContent: Array<RenderVNode | string> = []
    if (tab === 'select') {
      bodyContent.push(
        createVNode('button.muya-button.role-button.select', {
          on: {
            click: () => {
              this.handleSelectButtonClick()
            }
          }
        }, 'Choose an Image'),
        createVNode('span.description', 'Choose image from your computer.')
      )
    } else if (tab === 'link') {
      const altInput = createVNode('input.alt', {
        props: {
          placeholder: 'Alt text',
          value: alt
        },
        on: {
          input: (event: InputValueEvent) => {
            this.inputHandler(event, 'alt')
          },
          paste: (event: InputValueEvent) => {
            this.inputHandler(event, 'alt')
          },
          keydown: (event: InputKeyboardEvent) => {
            this.handleKeyDown(event)
          }
        }
      })
      const srcInput = createVNode('input.src', {
        props: {
          placeholder: 'Image link or local path',
          value: src
        },
        on: {
          input: (event: InputValueEvent) => {
            this.inputHandler(event, 'src')
          },
          paste: (event: InputValueEvent) => {
            this.inputHandler(event, 'src')
          },
          keydown: (event: InputKeyboardEvent) => {
            this.srcInputKeyDown(event)
          },
          keyup: (event: InputKeyboardEvent) => {
            this.handleKeyUp(event)
          }
        }
      })
      const titleInput = createVNode('input.title', {
        props: {
          placeholder: 'Image title',
          value: title
        },
        on: {
          input: (event: InputValueEvent) => {
            this.inputHandler(event, 'title')
          },
          paste: (event: InputValueEvent) => {
            this.inputHandler(event, 'title')
          },
          keydown: (event: InputKeyboardEvent) => {
            this.handleKeyDown(event)
          }
        }
      })

      const inputWrapper = isFullMode
        ? createVNode('div.input-container', [altInput, srcInput, titleInput])
        : createVNode('div.input-container', [srcInput])

      const embedButton = createVNode('button.muya-button.role-button.link', {
        on: {
          click: () => {
            this.handleLinkButtonClick()
          }
        }
      }, 'Embed Image')
      const bottomDes = createVNode('span.description', [
        createVNode('span', 'Paste web image or local image path. Use '),
        createVNode('a', {
          on: {
            click: () => {
              this.toggleMode()
            }
          }
        }, `${isFullMode ? 'simple mode' : 'full mode'}.`)
      ])
      bodyContent.push(inputWrapper, embedButton, bottomDes)
    } else {
      const searchInput = createVNode('input.search', {
        props: {
          placeholder: 'Search photos on Unsplash'
        },
        on: {
          keydown: (event: InputKeyboardEvent) => {
            const { key, target } = event
            const value = target.value
            if (key === EVENT_KEYS.Enter && value) {
              event.preventDefault()
              event.stopPropagation()
              this.searchPhotos(value)
            }
          }
        }
      })
      bodyContent.push(searchInput)
      if (this.loading) {
        bodyContent.push(createVNode('div.ag-plugin-loading'))
      } else if (this.photoList.length === 0) {
        bodyContent.push(createVNode('div.no-data', 'No result...'))
      } else {
        const photos = this.photoList.map(photo => {
          const imageWrapper = createVNode('div.image-wrapper', {
            props: {
              style: `background: ${photo.color};`
            },
            on: {
              click: () => {
                const unsplash = this.unsplash as UnsplashApiLike
                const title = photo.user.name
                const alt = photo.alt_description
                const src = photo.urls.regular
                const { id: photoId } = photo
                unsplash.photos.get({ photoId })
                  .then(toJson)
                  .then(result => {
                    unsplash.photos.trackDownload({
                      downloadLocation: result.links.download_location
                    })
                  })
                return this.replaceImageAsync({ alt, title, src })
              }
            }
          }, createVNode('img', {
            props: {
              src: photo.urls.thumb
            }
          }, []))

          const desCom = createVNode('div.des', ['By ', createVNode('a', {
            props: {
              href: photo.links.html
            },
            on: {
              click: () => {
                if (this.options.photoCreatorClick) {
                  this.options.photoCreatorClick(photo.user.links.html)
                }
              }
            }
          }, photo.user.name)])
          return createVNode('div.photo', [imageWrapper, desCom])
        })
        const photoWrapper = createVNode('div.photos-wrapper', photos)
        const moreCom = createVNode('div.more', 'Search for more photos...')
        bodyContent.push(photoWrapper, moreCom)
      }
    }

    return createVNode('div.image-select-body', bodyContent)
  }

  render (): void {
    const { oldVnode, imageSelectorContainer } = this
    const vnode = createVNode('div', [this.renderHeader(), this.renderBody()])
    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(imageSelectorContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }
}

export default ImageSelector
