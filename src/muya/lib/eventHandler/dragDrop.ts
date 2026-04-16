interface DragDropContentState {
  dragoverHandler(event: DragEvent): void
  dropHandler(event: DragEvent): void
  dragleaveHandler(event: DragEvent): void
}

interface DragDropEventCenter {
  attachDOMEvent(
    target: EventTarget,
    event: string,
    listener: (event: DragEvent) => void
  ): string | false
}

interface DragDropMuya {
  container: HTMLElement
  eventCenter: DragDropEventCenter
  contentState: DragDropContentState
}

class DragDrop {
  public muya: DragDropMuya

  constructor (muya: DragDropMuya) {
    this.muya = muya
    this.dragOverBinding()
    this.dropBinding()
    this.dragendBinding()
    this.dragStartBinding()
  }

  dragStartBinding (): void {
    const { container, eventCenter } = this.muya

    const dragStartHandler = (event: DragEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'IMG') {
        event.preventDefault()
      }
    }

    eventCenter.attachDOMEvent(container, 'dragstart', dragStartHandler)
  }

  dragOverBinding (): void {
    const { container, eventCenter, contentState } = this.muya

    const dragoverHandler = (event: DragEvent): void => {
      contentState.dragoverHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'dragover', dragoverHandler)
  }

  dropBinding (): void {
    const { container, eventCenter, contentState } = this.muya

    const dropHandler = (event: DragEvent): void => {
      contentState.dropHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'drop', dropHandler)
  }

  dragendBinding (): void {
    const { eventCenter, contentState } = this.muya

    const dragleaveHandler = (event: DragEvent): void => {
      contentState.dragleaveHandler(event)
    }

    eventCenter.attachDOMEvent(window, 'dragleave', dragleaveHandler)
  }
}

export default DragDrop
