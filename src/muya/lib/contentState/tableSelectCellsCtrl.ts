import { getAllTableCells, getIndex } from './tableDragBarCtrl'

type TableBarType = 'left' | 'bottom'

interface BlockLike {
  key: string
  text: string
  type: string
  align?: string
  row?: number
  column?: number
  children: BlockLike[]
  [key: string]: unknown
}

interface EventCenterLike {
  attachDOMEvent(target: EventTarget, type: string, listener: EventListener): unknown
  detachDOMEvent(id: unknown): void
}

interface MuyaLike {
  eventCenter: EventCenterLike
  blur(force?: boolean): void
  dispatchChange(): void
}

interface SelectionAnchor {
  key: string
  row: number
  column: number
}

interface SelectionFocus {
  key: string
  row: number
  column: number
}

interface CellSelectionEntry {
  ele?: HTMLElement
  key: string
  text: string
  align?: string
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

interface SelectedTableCellsLike {
  tableId: string
  row: number
  column: number
  cells: CellSelectionEntry[]
}

interface CellSelectInfo {
  tableId?: string
  anchor: SelectionAnchor
  focus: SelectionFocus | null
  isStartSelect?: boolean
  cells: HTMLElement[][]
  selectedCells?: CellSelectionEntry[]
}

interface ContentStateLike {
  muya: MuyaLike
  cellSelectInfo: CellSelectInfo | null
  cellSelectEventIds: unknown[]
  selectedTableCells: SelectedTableCellsLike | null
  getBlock(key: string | null | undefined): BlockLike | null
  getParent(block: BlockLike | null | undefined): BlockLike | null
  singleRender(block: BlockLike, isRenderCursor?: boolean): void
  editTable(
    options: { location: string, action: string, target: string },
    cellContentKey?: string
  ): unknown
  deleteParagraph(blockKey?: string): unknown
}

interface TableSelectCellsCtrlMethods {
  handleCellMouseDown(event: MouseEvent): void
  handleCellMouseMove(event: MouseEvent): void
  handleCellMouseUp(event: MouseEvent): void
  calculateSelectedCells(): void
  setSelectedCellsStyle(): void
  deleteSelectedTableCells(isCut?: boolean): unknown
  selectTable(table: BlockLike): unknown
  isSingleCellSelected(): BlockLike | null
  isWholeTableSelected(): BlockLike | null
}

type ContentStateConstructor = {
  prototype: unknown
}

const getCellIndex = (barType: TableBarType, cell: Element): number => getIndex(barType, cell)

const tableSelectCellsCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & TableSelectCellsCtrlMethods

  prototype.handleCellMouseDown = function (event: MouseEvent): void {
    if (event.buttons === 2) {
      // the contextmenu is emit.
      return
    }
    const { eventCenter } = this.muya
    const target = event.target as HTMLElement
    const cell = (target.closest('th') || target.closest('td')) as HTMLElement
    const tableId = (target.closest('table') as HTMLTableElement).id
    const row = getCellIndex('left', cell)
    const column = getCellIndex('bottom', cell)
    this.cellSelectInfo = {
      tableId,
      anchor: {
        key: cell.id,
        row,
        column
      },
      focus: null,
      isStartSelect: false,
      cells: getAllTableCells(tableId),
      selectedCells: []
    }

    const mouseMoveId = eventCenter.attachDOMEvent(document.body, 'mousemove', this.handleCellMouseMove.bind(this) as EventListener)
    const mouseUpId = eventCenter.attachDOMEvent(document.body, 'mouseup', this.handleCellMouseUp.bind(this) as EventListener)
    this.cellSelectEventIds.push(mouseMoveId, mouseUpId)
  }

  prototype.handleCellMouseMove = function (event: MouseEvent): void {
    const target = event.target as HTMLElement
    const cell = (target.closest('th') || target.closest('td')) as HTMLElement | null
    const table = target.closest('table') as HTMLTableElement | null
    const cellSelectInfo = this.cellSelectInfo as CellSelectInfo
    const isOverSameTableCell = !!(cell && table && table.id === cellSelectInfo.tableId)
    if (isOverSameTableCell && cell.id !== cellSelectInfo.anchor.key) {
      cellSelectInfo.isStartSelect = true
      this.muya.blur(true)
    }
    if (isOverSameTableCell && cellSelectInfo.isStartSelect) {
      const row = getCellIndex('left', cell as HTMLElement)
      const column = getCellIndex('bottom', cell as HTMLElement)
      cellSelectInfo.focus = {
        key: cell?.id ?? '',
        row,
        column
      }
    } else {
      cellSelectInfo.focus = null
    }

    this.calculateSelectedCells()
    this.setSelectedCellsStyle()
  }

  prototype.handleCellMouseUp = function (event: MouseEvent): void {
    const { eventCenter } = this.muya
    for (const id of this.cellSelectEventIds) {
      eventCenter.detachDOMEvent(id)
    }
    this.cellSelectEventIds = []
    if (this.cellSelectInfo && this.cellSelectInfo.isStartSelect) {
      event.preventDefault()
      const { tableId, selectedCells = [], anchor, focus } = this.cellSelectInfo
      // Mouse up outside table, the focus is null
      if (!focus || !tableId) {
        return
      }
      // We need to handle this after click event, because click event is emited after mouseup(mouseup will be followed by a click envent), but we set
      // the `selectedTableCells` to null when click event emited.
      setTimeout(() => {
        this.selectedTableCells = {
          tableId,
          row: Math.abs(anchor.row - focus.row) + 1, // 1 base
          column: Math.abs(anchor.column - focus.column) + 1, // 1 base
          cells: selectedCells.map(cell => {
            delete cell.ele
            return cell
          })
        }
        this.cellSelectInfo = null
        const tableBlock = this.getBlock(tableId) as BlockLike
        return this.singleRender(tableBlock, false)
      })
    }
  }

  prototype.calculateSelectedCells = function (): void {
    const cellSelectInfo = this.cellSelectInfo as CellSelectInfo
    const { anchor, focus, cells } = cellSelectInfo
    cellSelectInfo.selectedCells = []
    if (focus) {
      const startRowIndex = Math.min(anchor.row, focus.row)
      const endRowIndex = Math.max(anchor.row, focus.row)
      const startColIndex = Math.min(anchor.column, focus.column)
      const endColIndex = Math.max(anchor.column, focus.column)
      let i
      let j
      for (i = startRowIndex; i <= endRowIndex; i++) {
        const row = cells[i]
        for (j = startColIndex; j <= endColIndex; j++) {
          const cell = row[j]
          const cellBlock = this.getBlock(cell.id) as BlockLike
          cellSelectInfo.selectedCells.push({
            ele: cell,
            key: cell.id,
            text: cellBlock.children[0].text,
            align: cellBlock.align,
            top: i === startRowIndex,
            right: j === endColIndex,
            bottom: i === endRowIndex,
            left: j === startColIndex
          })
        }
      }
    }
  }

  prototype.setSelectedCellsStyle = function (): void {
    const { selectedCells = [], cells } = this.cellSelectInfo as CellSelectInfo
    for (const row of cells) {
      for (const cell of row) {
        cell.classList.remove('ag-cell-selected')
        cell.classList.remove('ag-cell-border-top')
        cell.classList.remove('ag-cell-border-right')
        cell.classList.remove('ag-cell-border-bottom')
        cell.classList.remove('ag-cell-border-left')
      }
    }

    for (const cell of selectedCells) {
      const { ele, top, right, bottom, left } = cell
      const element = ele as HTMLElement
      element.classList.add('ag-cell-selected')
      if (top) {
        element.classList.add('ag-cell-border-top')
      }
      if (right) {
        element.classList.add('ag-cell-border-right')
      }
      if (bottom) {
        element.classList.add('ag-cell-border-bottom')
      }
      if (left) {
        element.classList.add('ag-cell-border-left')
      }
    }
  }

  // Remove the content of selected table cell, delete the row/column if selected one row/column without content.
  // Delete the table if the selected whole table is empty.
  prototype.deleteSelectedTableCells = function (isCut = false): unknown {
    const selectedTableCells = this.selectedTableCells as SelectedTableCellsLike
    const { tableId, cells } = selectedTableCells
    const tableBlock = this.getBlock(tableId) as BlockLike
    const { row, column } = tableBlock
    const rows = new Set<BlockLike>()
    let lastColumn: number | null = null
    let isSameColumn = true
    let hasContent = false
    for (const cell of cells) {
      const cellBlock = this.getBlock(cell.key) as BlockLike
      const rowBlock = this.getParent(cellBlock) as BlockLike
      const cellColumn = cellBlock.column as number
      rows.add(rowBlock)
      if (cellBlock.children[0].text) {
        hasContent = true
      }
      if (typeof lastColumn === 'number') {
        if (cellColumn !== lastColumn) {
          isSameColumn = false
        }
      } else {
        lastColumn = cellColumn
      }
      cellBlock.children[0].text = ''
    }

    const tableRowCount = Number(row) + 1
    const tableColumnCount = Number(column) + 1
    const isOneColumnSelected = rows.size === tableRowCount && isSameColumn
    const isOneRowSelected = cells.length === tableColumnCount && rows.size === 1
    const isWholeTableSelected = rows.size === tableRowCount && cells.length === tableRowCount * tableColumnCount

    if (isCut && isWholeTableSelected) {
      this.selectedTableCells = null
      return this.deleteParagraph(tableId)
    }

    if (hasContent) {
      this.singleRender(tableBlock, false)

      return this.muya.dispatchChange()
    } else {
      const cellKey = cells[0].key
      const cellBlock = this.getBlock(cellKey) as BlockLike
      const cellContentKey = cellBlock.children[0].key
      this.selectedTableCells = null
      if (isOneColumnSelected) {
        // Remove one empty column
        return this.editTable({
          location: 'current',
          action: 'remove',
          target: 'column'
        }, cellContentKey)
      } else if (isOneRowSelected) {
        // Remove one empty row
        return this.editTable({
          location: 'current',
          action: 'remove',
          target: 'row'
        }, cellContentKey)
      } else if (isWholeTableSelected) {
        // Select whole empty table
        return this.deleteParagraph(tableId)
      }
    }
  }

  prototype.selectTable = function (table: BlockLike): unknown {
    // For calculateSelectedCells
    this.cellSelectInfo = {
      anchor: {
        key: '',
        row: 0,
        column: 0
      },
      focus: {
        key: '',
        row: Number(table.row),
        column: Number(table.column)
      },
      cells: getAllTableCells(table.key)
    }
    this.calculateSelectedCells()
    this.selectedTableCells = {
      tableId: table.key,
      row: Number(table.row) + 1,
      column: Number(table.column) + 1,
      cells: (this.cellSelectInfo.selectedCells || []).map(cell => {
        delete cell.ele
        return cell
      })
    }
    // reset cellSelectInfo
    this.cellSelectInfo = null
    this.muya.blur()
    return this.singleRender(table, false)
  }

  // Return the cell block if yes, else return null.
  prototype.isSingleCellSelected = function (): BlockLike | null {
    const { selectedTableCells } = this
    if (selectedTableCells && selectedTableCells.cells.length === 1) {
      const key = selectedTableCells.cells[0].key
      return this.getBlock(key)
    }

    return null
  }

  // Return the cell block if yes, else return null.
  prototype.isWholeTableSelected = function (): BlockLike | null {
    const { selectedTableCells } = this
    const table = selectedTableCells ? this.getBlock(selectedTableCells.tableId) : null
    const row = table?.row
    const column = table?.column
    if (selectedTableCells && table && selectedTableCells.cells.length === (Number(row) + 1) * (Number(column) + 1)) {
      return table
    }

    return null
  }
}

export default tableSelectCellsCtrl
