import { getUniqueId } from '../utils/random'

interface DomEventEntry {
  eventId: string
  target: EventTarget & {
    addEventListener(event: string, listener: EventListenerOrEventListenerObject, capture?: boolean): void
    removeEventListener(event: string, listener: EventListenerOrEventListenerObject, capture?: boolean): void
  }
  event: string
  listener: (...args: unknown[]) => void
  capture?: boolean
}

interface ListenerEntry {
  listener: (...args: unknown[]) => void
  once: boolean
}

class EventCenter {
  public events: DomEventEntry[]
  public listeners: Record<string, ListenerEntry[]>

  constructor () {
    this.events = []
    this.listeners = {}
  }

  attachDOMEvent (
    target: DomEventEntry['target'],
    event: string,
    listener: (...args: unknown[]) => void,
    capture?: boolean
  ): string | false {
    if (this.checkHasBind(target, event, listener, capture)) return false
    const eventId = getUniqueId()
    target.addEventListener(event, listener as EventListener, capture)
    this.events.push({
      eventId,
      target,
      event,
      listener,
      capture
    })
    return eventId
  }

  detachDOMEvent (eventId?: string): false | void {
    if (!eventId) return false
    const index = this.events.findIndex(entry => entry.eventId === eventId)
    if (index > -1) {
      const { target, event, listener, capture } = this.events[index]
      target.removeEventListener(event, listener as EventListener, capture)
      this.events.splice(index, 1)
    }
  }

  detachAllDomEvents (): void {
    this.events.forEach(event => this.detachDOMEvent(event.eventId))
  }

  private _subscribe (event: string, listener: (...args: unknown[]) => void, once = false): void {
    const listeners = this.listeners[event]
    const handler: ListenerEntry = { listener, once }
    if (listeners && Array.isArray(listeners)) {
      listeners.push(handler)
    } else {
      this.listeners[event] = [handler]
    }
  }

  subscribe (event: string, listener: (...args: unknown[]) => void): void {
    this._subscribe(event, listener)
  }

  unsubscribe (event: string, listener: (...args: unknown[]) => void): void {
    const listeners = this.listeners[event]
    if (Array.isArray(listeners) && listeners.find(item => item.listener === listener)) {
      const index = listeners.findIndex(item => item.listener === listener)
      listeners.splice(index, 1)
    }
  }

  subscribeOnce (event: string, listener: (...args: unknown[]) => void): void {
    this._subscribe(event, listener, true)
  }

  dispatch (event: string, ...data: unknown[]): void {
    const eventListener = this.listeners[event]
    if (eventListener && Array.isArray(eventListener)) {
      eventListener.forEach(({ listener, once }) => {
        listener(...data)
        if (once) {
          this.unsubscribe(event, listener)
        }
      })
    }
  }

  checkHasBind (
    currentTarget: DomEventEntry['target'],
    currentEvent: string,
    currentListener: (...args: unknown[]) => void,
    currentCapture?: boolean
  ): boolean {
    for (const { target, event, listener, capture } of this.events) {
      if (target === currentTarget && event === currentEvent && listener === currentListener && capture === currentCapture) {
        return true
      }
    }
    return false
  }
}

export default EventCenter
