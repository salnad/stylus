import template from './index.html'
import { getUniqueId } from '../../util'
import { sanitize, EXPORT_DOMPURIFY_CONFIG } from '../../util/dompurify'
import './index.css'

type NoticeType = 'primary' | 'error' | 'warning' | 'info'

interface NoticeOptions {
  time?: number
  title?: string
  message?: string
  type?: NoticeType
  showConfirm?: boolean
}

interface NoticeCacheEntry {
  remove: () => void
}

interface NoticeResult {
  name: 'notify'
  noticeCache: Record<string, NoticeCacheEntry>
  clear: () => void
  notify: (options: NoticeOptions) => Promise<void>
}

const ICON_HASH: Record<NoticeType, string> = {
  primary: 'icon-message',
  error: 'icon-error',
  warning: 'icon-warn',
  info: 'icon-info'
}

const TYPE_HASH: Record<NoticeType, string> = {
  primary: 'mt-primary',
  error: 'mt-error',
  warning: 'mt-warn',
  info: 'mt-info'
}

const fillTemplate = (type: NoticeType, title: string, message: string): string => {
  return template
    .replace(/\{\{icon\}\}/, ICON_HASH[type])
    .replace(/\{\{title\}\}/, sanitize(title, EXPORT_DOMPURIFY_CONFIG))
    .replace(/\{\{message\}\}/, sanitize(message, EXPORT_DOMPURIFY_CONFIG))
}

const notification: NoticeResult = {
  name: 'notify',
  noticeCache: {},
  clear (): void {
    Object.keys(this.noticeCache).forEach(key => {
      this.noticeCache[key].remove()
    })
  },
  notify ({
    time = 10000,
    title = '',
    message = '',
    type = 'primary',
    showConfirm = false
  }: NoticeOptions): Promise<void> {
    let resolveNotice!: () => void
    let rejectNotice!: () => void
    let timer: NodeJS.Timeout | null = null
    const id = getUniqueId()

    const fragment = document.createElement('div')
    fragment.innerHTML = fillTemplate(type, title, message)

    const noticeContainer = fragment.querySelector('.mt-notification') as HTMLDivElement | null
    if (!noticeContainer) {
      return Promise.reject(new Error('Unable to create notification container.'))
    }

    const bgNotice = noticeContainer.querySelector('.notice-bg') as HTMLDivElement
    const contentContainer = noticeContainer.querySelector('.content') as HTMLDivElement
    const fluent = noticeContainer.querySelector('.fluent') as HTMLDivElement
    const close = noticeContainer.querySelector('.close') as HTMLElement
    const { offsetHeight } = noticeContainer
    let target: Element = noticeContainer

    if (showConfirm) {
      noticeContainer.classList.add('mt-confirm')
      target = noticeContainer.querySelector('.confirm') as Element
    }

    noticeContainer.classList.add(TYPE_HASH[type])
    contentContainer.classList.add(TYPE_HASH[type])
    bgNotice.classList.add(TYPE_HASH[type])

    fluent.style.height = `${offsetHeight * 2}px`
    fluent.style.width = `${offsetHeight * 2}px`

    const setCloseTimer = (): void => {
      if (typeof time === 'number' && time > 0) {
        timer = setTimeout(() => {
          remove()
        }, time)
      }
    }

    const mousemoveHandler = (event: MouseEvent): void => {
      const { left, top } = noticeContainer.getBoundingClientRect()
      fluent.style.left = `${event.pageX - left}px`
      fluent.style.top = `${event.pageY - top}px`
      fluent.style.opacity = '1'
      fluent.style.height = `${noticeContainer.offsetHeight * 2}px`
      fluent.style.width = `${noticeContainer.offsetHeight * 2}px`

      if (timer) {
        clearTimeout(timer)
      }
    }

    const mouseleaveHandler = (): void => {
      fluent.style.opacity = '0'
      fluent.style.height = `${noticeContainer.offsetHeight * 4}px`
      fluent.style.width = `${noticeContainer.offsetHeight * 4}px`

      if (timer) {
        clearTimeout(timer)
      }
      setCloseTimer()
    }

    const clickHandler = (event: Event): void => {
      event.preventDefault()
      event.stopPropagation()
      remove()
      resolveNotice()
    }

    const closeHandler = (event: Event): void => {
      event.preventDefault()
      event.stopPropagation()
      remove()
      rejectNotice()
    }

    const rePositionNotices = (): void => {
      const notices = document.querySelectorAll('.mt-notification')
      let offset = 0
      notices.forEach((notice, index) => {
        const element = notice as HTMLDivElement
        element.style.transform = `translate(0, -${offset}px)`
        element.style.zIndex = String(10000 - index)
        offset += element.offsetHeight + 10
      })
    }

    const remove = (): void => {
      fluent.style.filter = 'blur(10px)'
      fluent.style.opacity = '0'
      fluent.style.height = `${noticeContainer.offsetHeight * 5}px`
      fluent.style.width = `${noticeContainer.offsetHeight * 5}px`

      noticeContainer.style.opacity = '0'
      noticeContainer.style.right = '-400px'

      setTimeout(() => {
        noticeContainer.removeEventListener('mousemove', mousemoveHandler)
        noticeContainer.removeEventListener('mouseleave', mouseleaveHandler)
        target.removeEventListener('click', clickHandler)
        close.removeEventListener('click', closeHandler)
        noticeContainer.remove()
        rePositionNotices()
        if (this.noticeCache[id]) {
          delete this.noticeCache[id]
        }
      }, 100)
    }

    this.noticeCache[id] = { remove }

    noticeContainer.addEventListener('mousemove', mousemoveHandler)
    noticeContainer.addEventListener('mouseleave', mouseleaveHandler)
    target.addEventListener('click', clickHandler)
    close.addEventListener('click', closeHandler)

    setTimeout(() => {
      bgNotice.style.width = `${noticeContainer.offsetWidth * 3.5}px`
      bgNotice.style.height = `${noticeContainer.offsetWidth * 3.5}px`
      rePositionNotices()
    }, 50)

    setCloseTimer()
    document.body.prepend(noticeContainer)

    return new Promise<void>((resolve, reject) => {
      resolveNotice = resolve
      rejectNotice = reject
    })
  }
}

export default notification
