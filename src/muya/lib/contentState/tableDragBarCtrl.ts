type DragBarType = 'left' | 'bottom'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRange {
  start: CursorPosition
  end: CursorPosition
}

interface BlockLike {
  key: string
  text: string
  type: string
  align?: string
  parent?: string | null
  children: BlockLike[]
  [key: string]: unknown
}

interface EventCenterLike {
  attachDOMEvent(target: EventTarget, type: string, listener: EventListener): unknown
  detachDOMEvent(id: unknown): void
}

interface MuyaLike {
  eventCenter: EventCenterLike
}

interface DragInfo {
  tableId: string
  clientX: number
  clientY: number
  barType: DragBarType
  index: number
  curIndex: number
  dragCells: HTMLElement[]
  cells: HTMLElement[][]
  aspects: number[]
  offset: number
}

interface ContentStateLike {
  muya: MuyaLike
  cursor: CursorRange
  dragInfo: DragInfo | null
  isDragTableBar: boolean
  dragEventIds: unknown[]
  getBlock(key: string | null | undefined): BlockLike | null
  singleRender(block: BlockLike): void
  partialRender(): void
}

interface TableDragBarCtrlMethods {
  handleMouseDown(event: MouseEvent): void
  handleMouseMove(event: MouseEvent): void
  handleMouseUp(): void
  hideUnnecessaryBar(): void
  calculateCurIndex(): void
  setDragTargetStyle(): void
  setSwitchStyle(): void
  setDropTargetStyle(): void
  switchTableData(): void
  resetDragTableBar(): void
}

type ContentStateConstructor = {
  prototype: unknown
}

const calculateAspects = (tableId: string, barType: DragBarType): number[] => {
  const table = document.querySelector<HTMLTableElement>(`#${tableId}`) as HTMLTableElement
  if (barType === 'bottom') {
    const firstRow = table.querySelector('tr') as HTMLTableRowElement
    return Array.from(firstRow.children).map(cell => (cell as HTMLElement).clientWidth)
  } else {
    return Array.from(table.querySelectorAll('tr')).map(row => (row as HTMLElement).clientHeight)
  }
}

export const getAllTableCells = (tableId: string): HTMLElement[][] => {
  const table = document.querySelector<HTMLTableElement>(`#${tableId}`) as HTMLTableElement
  const rows = table.querySelectorAll('tr')
  const cells: HTMLElement[][] = []
  for (const row of Array.from(rows)) {
    cells.push(Array.from(row.children) as HTMLElement[])
  }

  return cells
}

export const getIndex = (barType: DragBarType, cell: Element): number => {
  if (cell.tagName === 'SPAN') {
    cell = cell.parentNode as Element
  }
  const row = cell.parentNode as Element
  if (barType === 'bottom') {
    return Array.from(row.children).indexOf(cell)
  } else {
    const rowContainer = row.parentNode as Element
    if (rowContainer.tagName === 'THEAD') {
      return 0
    } else {
      return Array.from(rowContainer.children).indexOf(row) + 1
    }
  }
}

const getDragCells = (tableId: string, barType: DragBarType, index: number): HTMLElement[] => {
  const table = document.querySelector<HTMLTableElement>(`#${tableId}`) as HTMLTableElement
  const dragCells: HTMLElement[] = []
  if (barType === 'left') {
    if (index === 0) {
      dragCells.push(...Array.from(table.querySelectorAll('th')) as HTMLElement[])
    } else {
      const row = (table.querySelector('tbody') as HTMLTableSectionElement).children[index - 1] as HTMLTableRowElement
      dragCells.push(...Array.from(row.children) as HTMLElement[])
    }
  } else {
    const rows = Array.from(table.querySelectorAll('tr')) as HTMLTableRowElement[]
    const len = rows.length
    let i: number
    for (i = 0; i < len; i++) {
      dragCells.push(rows[i].children[index] as HTMLElement)
    }
  }
  return dragCells
}

const tableDragBarCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & TableDragBarCtrlMethods

  prototype.handleMouseDown = function (event: MouseEvent): void {
    event.preventDefault()
    const { eventCenter } = this.muya
    const { clientX, clientY } = event
    const target = event.target as HTMLElement
    const tableId = (target.closest('table') as HTMLTableElement).id
    const barType: DragBarType = target.classList.contains('left') ? 'left' : 'bottom'
    const index = getIndex(barType, target)
    const aspects = calculateAspects(tableId, barType)
    this.dragInfo = {
      tableId,
      clientX,
      clientY,
      barType,
      index,
      curIndex: index,
      dragCells: getDragCells(tableId, barType, index),
      cells: getAllTableCells(tableId),
      aspects,
      offset: 0
    }

    for (const row of this.dragInfo.cells) {
      for (const cell of row) {
        if (!this.dragInfo.dragCells.includes(cell)) {
          cell.classList.add('ag-cell-transform')
        }
      }
    }

    const mouseMoveId = eventCenter.attachDOMEvent(document, 'mousemove', this.handleMouseMove.bind(this) as EventListener)
    const mouseUpId = eventCenter.attachDOMEvent(document, 'mouseup', this.handleMouseUp.bind(this) as EventListener)
    this.dragEventIds.push(mouseMoveId, mouseUpId)
  }

  prototype.handleMouseMove = function (event: MouseEvent): void {
    if (!this.dragInfo) {
      return
    }
    const { barType } = this.dragInfo
    const attrName: 'clientX' | 'clientY' = barType === 'bottom' ? 'clientX' : 'clientY'
    const offset = this.dragInfo.offset = event[attrName] - this.dragInfo[attrName]
    if (Math.abs(offset) < 5) {
      return
    }
    this.isDragTableBar = true
    this.hideUnnecessaryBar()
    this.calculateCurIndex()
    this.setDragTargetStyle()
    this.setSwitchStyle()
  }

  prototype.handleMouseUp = function (): void {
    const { eventCenter } = this.muya
    for (const id of this.dragEventIds) {
      eventCenter.detachDOMEvent(id)
    }
    this.dragEventIds = []
    if (!this.isDragTableBar) {
      return
    }

    this.setDropTargetStyle()

    // The drop animation need 300ms.
    setTimeout(() => {
      this.switchTableData()
      this.resetDragTableBar()
    }, 300)
  }

  prototype.hideUnnecessaryBar = function (): void {
    const { barType } = this.dragInfo as DragInfo
    const hideClassName = barType === 'bottom' ? 'left' : 'bottom'
    const needHideBar = document.querySelector<HTMLElement>(`.ag-drag-handler.${hideClassName}`)
    if (needHideBar) {
      needHideBar.style.display = 'none'
    }
  }

  prototype.calculateCurIndex = function (): void {
    const dragInfo = this.dragInfo as DragInfo
    let { offset, aspects, index } = dragInfo
    let curIndex = index
    const len = aspects.length
    let i: number
    if (offset > 0) {
      for (i = index; i < len; i++) {
        const aspect = aspects[i]
        if (i === index) {
          offset -= Math.floor(aspect / 2)
        } else {
          offset -= aspect
        }
        if (offset < 0) {
          break
        } else {
          curIndex++
        }
      }
    } else if (offset < 0) {
      for (i = index; i >= 0; i--) {
        const aspect = aspects[i]
        if (i === index) {
          offset += Math.floor(aspect / 2)
        } else {
          offset += aspect
        }
        if (offset > 0) {
          break
        } else {
          curIndex--
        }
      }
    }

    dragInfo.curIndex = Math.max(0, Math.min(curIndex, len - 1))
  }

  prototype.setDragTargetStyle = function (): void {
    const { offset, barType, dragCells } = this.dragInfo as DragInfo

    for (const cell of dragCells) {
      if (!cell.classList.contains('ag-drag-cell')) {
        cell.classList.add('ag-drag-cell')
        cell.classList.add(`ag-drag-${barType}`)
      }
      const valueName = barType === 'bottom' ? 'translateX' : 'translateY'
      cell.style.transform = `${valueName}(${offset}px)`
    }
  }

  prototype.setSwitchStyle = function (): void {
    const { index, offset, curIndex, barType, aspects, cells } = this.dragInfo as DragInfo
    const aspect = aspects[index]
    const len = aspects.length

    let i: number
    if (offset > 0) {
      if (barType === 'bottom') {
        for (const row of cells) {
          for (i = 0; i < len; i++) {
            const cell = row[i]
            if (i > index && i <= curIndex) {
              cell.style.transform = `translateX(${-aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateX(0px)'
            }
          }
        }
      } else {
        for (i = 0; i < len; i++) {
          const row = cells[i]
          for (const cell of row) {
            if (i > index && i <= curIndex) {
              cell.style.transform = `translateY(${-aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateY(0px)'
            }
          }
        }
      }
    } else {
      if (barType === 'bottom') {
        for (const row of cells) {
          for (i = 0; i < len; i++) {
            const cell = row[i]
            if (i >= curIndex && i < index) {
              cell.style.transform = `translateX(${aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateX(0px)'
            }
          }
        }
      } else {
        for (i = 0; i < len; i++) {
          const row = cells[i]
          for (const cell of row) {
            if (i >= curIndex && i < index) {
              cell.style.transform = `translateY(${aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateY(0px)'
            }
          }
        }
      }
    }
  }

  prototype.setDropTargetStyle = function (): void {
    const { dragCells, barType, curIndex, index, aspects, offset } = this.dragInfo as DragInfo
    let move = 0
    let i: number
    if (offset > 0) {
      for (i = index + 1; i <= curIndex; i++) {
        move += aspects[i]
      }
    } else {
      for (i = curIndex; i < index; i++) {
        move -= aspects[i]
      }
    }
    for (const cell of dragCells) {
      cell.classList.remove('ag-drag-cell')
      cell.classList.remove(`ag-drag-${barType}`)
      cell.classList.add('ag-cell-transform')
      const valueName = barType === 'bottom' ? 'translateX' : 'translateY'
      cell.style.transform = `${valueName}(${move}px)`
    }
  }

  prototype.switchTableData = function (): void {
    const { barType, index, curIndex, tableId, offset } = this.dragInfo as DragInfo
    const table = this.getBlock(tableId) as BlockLike
    const tHead = table.children[0] as BlockLike
    const tBody = table.children[1] as BlockLike | undefined
    const rows = [tHead.children[0], ...(tBody ? tBody.children : [])] as BlockLike[]
    let i: number

    if (index !== curIndex) {
      // Cursor in the same cell.
      const { start, end } = this.cursor
      let key: string | null = null
      if (barType === 'bottom') {
        for (const row of rows) {
          const cell = row.children[index] as BlockLike
          const cellContent = cell.children[0] as BlockLike
          const isCursorCell = cellContent.key === start.key
          const { text } = cellContent
          const { align } = cell
          if (offset > 0) {
            for (i = index; i < curIndex; i++) {
              row.children[i].children[0].text = row.children[i + 1].children[0].text
              row.children[i].align = row.children[i + 1].align
            }
            row.children[curIndex].children[0].text = text
            row.children[curIndex].align = align
          } else {
            for (i = index; i > curIndex; i--) {
              row.children[i].children[0].text = row.children[i - 1].children[0].text
              row.children[i].align = row.children[i - 1].align
            }
            row.children[curIndex].children[0].text = text
            row.children[curIndex].align = align
          }
          if (isCursorCell) {
            key = row.children[curIndex].children[0].key
          }
        }
      } else {
        let column: number | null = null
        const temp = rows[index].children.map((cell, ii) => {
          if (cell.children[0].key === start.key) {
            column = ii
          }
          return cell.children[0].text
        })
        if (offset > 0) {
          for (i = index; i < curIndex; i++) {
            rows[i].children.forEach((cell, ii) => {
              cell.children[0].text = rows[i + 1].children[ii].children[0].text
            })
          }
          rows[curIndex].children.forEach((cell, ii) => {
            if (ii === column) {
              key = cell.children[0].key
            }
            cell.children[0].text = temp[ii]
          })
        } else {
          for (i = index; i > curIndex; i--) {
            rows[i].children.forEach((cell, ii) => {
              cell.children[0].text = rows[i - 1].children[ii].children[0].text
            })
          }
          rows[curIndex].children.forEach((cell, ii) => {
            if (ii === column) {
              key = cell.children[0].key
            }
            cell.children[0].text = temp[ii]
          })
        }
      }
      if (key) {
        this.cursor = {
          start: {
            key,
            offset: start.offset
          },
          end: {
            key,
            offset: end.offset
          }
        }
        return this.singleRender(table)
      } else {
        return this.partialRender()
      }
    }
  }

  prototype.resetDragTableBar = function (): void {
    this.dragInfo = null
    this.isDragTableBar = false
  }
}

export default tableDragBarCtrl
