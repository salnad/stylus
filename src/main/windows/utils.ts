import { screen, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { isLinux } from '../config'

export const zoomIn = (win: BrowserWindow): void => {
  const { webContents } = win
  const zoom = webContents.getZoomFactor()
  webContents.send('mt::window-zoom', Math.min(2.0, zoom + 0.125))
}

export const zoomOut = (win: BrowserWindow): void => {
  const { webContents } = win
  const zoom = webContents.getZoomFactor()
  webContents.send('mt::window-zoom', Math.max(0.5, zoom - 0.125))
}

export const centerWindowOptions = (options: BrowserWindowConstructorOptions): void => {
  const { bounds, workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const screenArea = isLinux ? bounds : workArea
  const width = options.width ?? 0
  const height = options.height ?? 0

  options.x = Math.ceil(screenArea.x + (screenArea.width - width) / 2)
  options.y = Math.ceil(screenArea.y + (screenArea.height - height) / 2)
}

interface WindowStateLike {
  x?: number
  y?: number
  width: number
  height: number
}

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export const ensureWindowPosition = (windowState: WindowStateLike): WindowBounds => {
  const { bounds, workArea } = screen.getPrimaryDisplay()
  const screenArea = isLinux ? bounds : workArea

  let { x, y, width, height } = windowState
  let center = false
  if (x === undefined || y === undefined) {
    center = true

    if (screenArea.width < width) width = screenArea.width
    if (screenArea.height < height) height = screenArea.height
  } else {
    const currentX = x
    const currentY = y
    center = !screen.getAllDisplays().some(display =>
      currentX >= display.bounds.x && currentX <= display.bounds.x + display.bounds.width &&
      currentY >= display.bounds.y && currentY <= display.bounds.y + display.bounds.height
    )
  }

  if (center) {
    x = Math.ceil(screenArea.x + (screenArea.width - width) / 2)
    y = Math.ceil(screenArea.y + (screenArea.height - height) / 2)
  }

  return {
    x: x ?? screenArea.x,
    y: y ?? screenArea.y,
    width,
    height
  }
}
