interface EventCenterLike {
  attachDOMEvent(
    target: EventTarget,
    event: string,
    listener: (event: Event) => void,
    capture?: boolean
  ): string | false
}

interface ContentStateLike {
  docPasteHandler(event: ClipboardEvent): void
  docCopyHandler(event: ClipboardEvent): void
  docCutHandler(event: ClipboardEvent): void
  copyHandler(event: ClipboardEvent, copyType: string, copyInfo: unknown): void
  cutHandler(): void
  pasteHandler(event: ClipboardEvent, pasteType: string): void
}

interface MuyaLike {
  container: HTMLElement
  eventCenter: EventCenterLike
  contentState: ContentStateLike
  dispatchChange(): void
}

class Clipboard {
  public muya: MuyaLike
  public _copyType: string
  public _pasteType: string
  public _copyInfo: unknown

  constructor (muya: MuyaLike) {
    this.muya = muya
    this._copyType = 'normal'
    this._pasteType = 'normal'
    this._copyInfo = null
    this.listen()
  }

  listen (): void {
    const { container, eventCenter, contentState } = this.muya
    const docPasteHandler = (event: Event): void => {
      contentState.docPasteHandler(event as ClipboardEvent)
    }
    const docCopyCutHandler = (event: Event): void => {
      const clipboardEvent = event as ClipboardEvent
      contentState.docCopyHandler(clipboardEvent)
      if (clipboardEvent.type === 'cut') {
        contentState.docCutHandler(clipboardEvent)
      }
    }
    const copyCutHandler = (event: Event): void => {
      const clipboardEvent = event as ClipboardEvent
      contentState.copyHandler(clipboardEvent, this._copyType, this._copyInfo)
      if (clipboardEvent.type === 'cut') {
        contentState.cutHandler()
      }
      this._copyType = 'normal'
    }
    const pasteHandler = (event: Event): void => {
      const clipboardEvent = event as ClipboardEvent
      contentState.pasteHandler(clipboardEvent, this._pasteType)
      this._pasteType = 'normal'
      this.muya.dispatchChange()
    }

    eventCenter.attachDOMEvent(document, 'paste', docPasteHandler)
    eventCenter.attachDOMEvent(container, 'paste', pasteHandler)
    eventCenter.attachDOMEvent(container, 'cut', copyCutHandler)
    eventCenter.attachDOMEvent(container, 'copy', copyCutHandler)
    eventCenter.attachDOMEvent(document.body, 'cut', docCopyCutHandler)
    eventCenter.attachDOMEvent(document.body, 'copy', docCopyCutHandler)
  }

  copyAsMarkdown (): void {
    this._copyType = 'copyAsMarkdown'
    document.execCommand('copy')
  }

  copyAsHtml (): void {
    this._copyType = 'copyAsHtml'
    document.execCommand('copy')
  }

  pasteAsPlainText (): void {
    this._pasteType = 'pasteAsPlainText'
    document.execCommand('paste')
  }

  copy (type: string, info: unknown): void {
    this._copyType = type
    this._copyInfo = info
    document.execCommand('copy')
  }
}

export default Clipboard
