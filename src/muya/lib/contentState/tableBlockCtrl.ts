import { isLengthEven, getParagraphReference } from '../utils'

const TABLE_BLOCK_REG = /^\|.*?(\\*)\|.*?(\\*)\|/

interface TableCellContentLike {
  text: string
  align: string
}

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
  parent: string | null
  preSibling: string | null
  nextSibling: string | null
  children: BlockLike[]
  functionType?: string
  align?: string
  row?: number
  column?: number
  [key: string]: unknown
}

interface EventCenterLike {
  dispatch(...args: unknown[]): unknown
}

interface MuyaLike {
  eventCenter: EventCenterLike
  dispatchSelectionChange(): void
  dispatchSelectionFormats(): void
  dispatchChange(): void
}

interface EditTableOptions {
  location: string
  action: string
  target: string
}

interface ContentStateLike {
  cursor: CursorRange
  muya: MuyaLike
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  insertAfter(newBlock: BlockLike, oldBlock: BlockLike): void
  insertBefore(newBlock: BlockLike, oldBlock: BlockLike): void
  removeBlock(block: BlockLike): void
  getBlock(key: string | null | undefined): BlockLike | null
  getParent(block: BlockLike | null | undefined): BlockLike | null
  getAnchor(block: BlockLike): BlockLike | null
  getParents(block: BlockLike): BlockLike[]
  getPreSibling(block: BlockLike): BlockLike | null
  getNextSibling(block: BlockLike): BlockLike | null
  firstInDescendant(block: BlockLike): BlockLike
  closest(block: BlockLike | null | undefined, type: string | RegExp): BlockLike | null
  createRow(row: BlockLike, isHeader?: boolean): BlockLike
  findNextBlockInLocation(block: BlockLike): BlockLike | null | undefined
  partialRender(): void
}

interface TableBlockCtrlMethods {
  createTableInFigure(
    options: { rows: number, columns: number },
    tableContents?: TableCellContentLike[][]
  ): BlockLike
  createFigure(options: { rows: number, columns: number }): void
  createTable(tableChecker: { rows: number, columns: number }): void
  initTable(block: BlockLike): BlockLike
  tableToolBarClick(type: string): void
  editTable(options: EditTableOptions, cellContentKey?: string): void
  getTableBlock(): BlockLike | undefined
  tableBlockUpdate(block: BlockLike): BlockLike | false
}

type ContentStateConstructor = {
  prototype: unknown
}

const tableBlockCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & TableBlockCtrlMethods

  prototype.createTableInFigure = function (
    { rows, columns }: { rows: number, columns: number },
    tableContents: TableCellContentLike[][] = []
  ): BlockLike {
    const table = this.createBlock('table', {
      row: rows - 1, // zero base
      column: columns - 1
    })
    const tHead = this.createBlock('thead')
    const tBody = this.createBlock('tbody')

    let i
    let j
    for (i = 0; i < rows; i++) {
      const rowBlock = this.createBlock('tr')
      i === 0 ? this.appendChild(tHead, rowBlock) : this.appendChild(tBody, rowBlock)
      const rowContents = tableContents[i]
      for (j = 0; j < columns; j++) {
        const cellInfo = rowContents?.[j]
        const cell = this.createBlock(i === 0 ? 'th' : 'td', {
          align: cellInfo?.align ?? '',
          column: j
        })
        const cellContent = this.createBlock('span', {
          text: cellInfo?.text ?? '',
          functionType: 'cellContent'
        })

        this.appendChild(cell, cellContent)
        this.appendChild(rowBlock, cell)
      }
    }

    this.appendChild(table, tHead)
    if (tBody.children.length) {
      this.appendChild(table, tBody)
    }

    return table
  }

  prototype.createFigure = function ({ rows, columns }: { rows: number, columns: number }): void {
    const { end } = this.cursor
    const table = this.createTableInFigure({ rows, columns })
    const figureBlock = this.createBlock('figure', {
      functionType: 'table'
    })
    const endBlock = this.getBlock(end.key) as BlockLike
    const anchor = this.getAnchor(endBlock)

    if (!anchor) {
      return
    }

    this.insertAfter(figureBlock, anchor)
    if (/p|h\d/.test(anchor.type) && !endBlock.text) {
      this.removeBlock(anchor)
    }
    this.appendChild(figureBlock, table)
    const { key } = this.firstInDescendant(table) // fist cell key in thead
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }

  prototype.createTable = function (tableChecker: { rows: number, columns: number }): void {
    this.createFigure(tableChecker)

    this.muya.dispatchSelectionChange()
    this.muya.dispatchSelectionFormats()
    this.muya.dispatchChange()
  }

  prototype.initTable = function (block: BlockLike): BlockLike {
    const { text } = block.children[0]
    const rowHeader: string[] = []
    const len = text.length
    let i
    for (i = 0; i < len; i++) {
      const char = text[i]
      if (/^[^|]$/.test(char)) {
        rowHeader[rowHeader.length - 1] += char
      }
      if (/\\/.test(char)) {
        rowHeader[rowHeader.length - 1] += text[++i]
      }
      if (/\|/.test(char) && i !== len - 1) {
        rowHeader.push('')
      }
    }

    const columns = rowHeader.length
    const rows = 2

    const table = this.createTableInFigure(
      { rows, columns },
      [rowHeader.map(cellText => ({ text: cellText, align: '' }))]
    )

    block.type = 'figure'
    block.text = ''
    block.children = []
    block.functionType = 'table'
    this.appendChild(block, table)

    return this.firstInDescendant(table.children[1] as BlockLike) // first cell content in tbody
  }

  prototype.tableToolBarClick = function (type: string): void {
    const {
      start: { key }
    } = this.cursor
    const block = this.getBlock(key) as BlockLike
    const parentBlock = this.getParent(block) as BlockLike
    if (block.functionType !== 'cellContent') {
      throw new Error('table is not active')
    }
    const { column, align } = parentBlock
    const table = this.closest(block, 'table') as BlockLike
    const figure = this.getBlock(table.parent) as BlockLike

    switch (type) {
      case 'left':
      case 'center':
      case 'right': {
        const newAlign = align === type ? '' : type
        table.children.forEach(rowContainer => {
          rowContainer.children.forEach(row => {
            row.children[column as number].align = newAlign
          })
        })
        this.muya.eventCenter.dispatch('stateChange')
        this.partialRender()
        break
      }
      case 'delete': {
        const newLine = this.createBlock('span')
        figure.children = []
        this.appendChild(figure, newLine)
        figure.type = 'p'
        figure.text = ''
        const key = newLine.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.muya.eventCenter.dispatch('stateChange')
        this.partialRender()
        break
      }
      case 'table': {
        const { eventCenter } = this.muya
        const figureKey = figure.key
        const tableEle = document.querySelector<HTMLElement>(`#${figureKey} [data-label=table]`) as HTMLElement
        const { row = 1, column = 1 } = table // zero base

        const handler = (nextRow: number, nextColumn: number): void => {
          const { row: oldRow = 1, column: oldColumn = 1 } = table
          let tBody = table.children[1] as BlockLike | undefined
          const tHead = table.children[0] as BlockLike
          const headerRow = tHead.children[0] as BlockLike
          const bodyRows = tBody ? tBody.children : []
          let i: number
          if (nextColumn > oldColumn) {
            for (i = oldColumn + 1; i <= nextColumn; i++) {
              const th = this.createBlock('th', {
                column: i,
                align: ''
              })
              const thContent = this.createBlock('span', {
                functionType: 'cellContent'
              })
              this.appendChild(th, thContent)
              this.appendChild(headerRow, th)
              bodyRows.forEach(bodyRow => {
                const td = this.createBlock('td', {
                  column: i,
                  align: ''
                })

                const tdContent = this.createBlock('span', {
                  functionType: 'cellContent'
                })
                this.appendChild(td, tdContent)
                this.appendChild(bodyRow, td)
              })
            }
          } else if (nextColumn < oldColumn) {
            const rows = [headerRow, ...bodyRows]
            rows.forEach(tableRow => {
              while (tableRow.children.length > nextColumn + 1) {
                const lastChild = tableRow.children[tableRow.children.length - 1]
                this.removeBlock(lastChild)
              }
            })
          }

          if (nextRow < oldRow) {
            const body = tBody as BlockLike
            while (body.children.length > nextRow) {
              const lastRow = body.children[body.children.length - 1]
              this.removeBlock(lastRow)
            }
            if (body.children.length === 0) {
              this.removeBlock(body)
            }
          } else if (nextRow > oldRow) {
            if (!tBody) {
              tBody = this.createBlock('tbody')
              this.appendChild(table, tBody)
            }
            const oneHeaderRow = tHead.children[0] as BlockLike
            for (i = oldRow + 1; i <= nextRow; i++) {
              const bodyRow = this.createRow(oneHeaderRow, false)

              this.appendChild(tBody, bodyRow)
            }
          }

          Object.assign(table, { row: nextRow, column: nextColumn })

          const cursorBlock = this.firstInDescendant(headerRow)
          const key = cursorBlock.key
          const offset = cursorBlock.text.length
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }
          this.muya.eventCenter.dispatch('stateChange')
          this.partialRender()
        }

        const reference = getParagraphReference(tableEle, tableEle.id)
        eventCenter.dispatch('muya-table-picker', { row, column }, reference, handler.bind(this))
      }
    }
  }

  // insert/remove row/column
  prototype.editTable = function ({ location, action, target }: EditTableOptions, cellContentKey?: string): void {
    let block: BlockLike
    let start: CursorPosition | undefined
    let end: CursorPosition | undefined
    if (cellContentKey) {
      block = this.getBlock(cellContentKey) as BlockLike
    } else {
      ({ start, end } = this.cursor)
      if (start.key !== end.key) {
        throw new Error('Cursor is not in one block, can not editTable')
      }

      block = this.getBlock(start.key) as BlockLike
    }

    if (block.functionType !== 'cellContent') {
      throw new Error('Cursor is not in table block, so you can not insert/edit row/column')
    }

    const cellBlock = this.getParent(block) as BlockLike
    const currentRow = this.getParent(cellBlock) as BlockLike
    const table = this.closest(block, 'table') as BlockLike
    const thead = table.children[0] as BlockLike
    const tbody = table.children[1] as BlockLike
    const columnIndex = currentRow.children.indexOf(cellBlock)
    // const rowIndex = rowContainer.type === 'thead' ? 0 : tbody.children.indexOf(currentRow) + 1

    let cursorBlock: BlockLike | null | undefined

    if (target === 'row') {
      if (action === 'insert') {
        const newRow = (location === 'previous' && cellBlock.type === 'th')
          ? this.createRow(currentRow, true)
          : this.createRow(currentRow, false)
        if (location === 'previous') {
          this.insertBefore(newRow, currentRow)
          if (cellBlock.type === 'th') {
            this.removeBlock(currentRow)
            currentRow.children.forEach(cell => (cell.type = 'td'))
            const firstRow = tbody.children[0]
            this.insertBefore(currentRow, firstRow)
          }
        } else {
          if (cellBlock.type === 'th') {
            const firstRow = tbody.children[0]
            this.insertBefore(newRow, firstRow)
          } else {
            this.insertAfter(newRow, currentRow)
          }
        }
        cursorBlock = newRow.children[columnIndex].children[0]
        // handle remove row
      } else {
        if (location === 'previous') {
          if (cellBlock.type === 'th') return
          if (!currentRow.preSibling) {
            const headRow = thead.children[0]
            if (!currentRow.nextSibling) return
            this.removeBlock(headRow)
            this.removeBlock(currentRow)
            currentRow.children.forEach(cell => (cell.type = 'th'))
            this.appendChild(thead, currentRow)
          } else {
            const preRow = this.getPreSibling(currentRow) as BlockLike
            this.removeBlock(preRow)
          }
        } else if (location === 'current') {
          if (cellBlock.type === 'th' && tbody.children.length >= 2) {
            const firstRow = tbody.children[0]
            this.removeBlock(currentRow)
            this.removeBlock(firstRow)
            this.appendChild(thead, firstRow)
            firstRow.children.forEach(cell => (cell.type = 'th'))
            cursorBlock = firstRow.children[columnIndex].children[0]
          }
          if (cellBlock.type === 'td' && (currentRow.preSibling || currentRow.nextSibling)) {
            cursorBlock = ((this.getNextSibling(currentRow) || this.getPreSibling(currentRow)) as BlockLike).children[columnIndex].children[0]
            this.removeBlock(currentRow)
          }
        } else {
          if (cellBlock.type === 'th') {
            if (tbody.children.length >= 2) {
              const firstRow = tbody.children[0]
              this.removeBlock(firstRow)
            } else {
              return
            }
          } else {
            const nextRow = this.getNextSibling(currentRow)
            if (nextRow) {
              this.removeBlock(nextRow)
            }
          }
        }
      }
    } else if (target === 'column') {
      if (action === 'insert') {
        [...thead.children, ...tbody.children].forEach(tableRow => {
          const targetCell = tableRow.children[columnIndex]
          const cell = this.createBlock(targetCell.type, {
            align: ''
          })
          const cellContent = this.createBlock('span', {
            functionType: 'cellContent'
          })
          this.appendChild(cell, cellContent)
          if (location === 'left') {
            this.insertBefore(cell, targetCell)
          } else {
            this.insertAfter(cell, targetCell)
          }
          tableRow.children.forEach((childCell, i) => {
            childCell.column = i
          })
        })
        cursorBlock = location === 'left'
          ? (this.getPreSibling(cellBlock) as BlockLike).children[0]
          : (this.getNextSibling(cellBlock) as BlockLike).children[0]
        // handle remove column
      } else {
        if (currentRow.children.length <= 2) return
        [...thead.children, ...tbody.children].forEach(tableRow => {
          const targetCell = tableRow.children[columnIndex]
          const removeCell = location === 'left'
            ? this.getPreSibling(targetCell)
            : (location === 'current' ? targetCell : this.getNextSibling(targetCell))
          if (removeCell === cellBlock) {
            cursorBlock = this.findNextBlockInLocation(block)
          }

          if (removeCell) this.removeBlock(removeCell)
          tableRow.children.forEach((childCell, i) => {
            childCell.column = i
          })
        })
      }
    }

    const newColumn = thead.children[0].children.length - 1
    const newRow = thead.children.length + tbody.children.length - 1
    Object.assign(table, { row: newRow, column: newColumn })

    if (cursorBlock) {
      const { key } = cursorBlock
      const offset = 0
      this.cursor = { start: { key, offset }, end: { key, offset } }
    } else {
      this.cursor = { start, end } as CursorRange
    }

    this.partialRender()
    this.muya.eventCenter.dispatch('stateChange')
  }

  prototype.getTableBlock = function (): BlockLike | undefined {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key) as BlockLike
    const endBlock = this.getBlock(end.key) as BlockLike
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const affiliation = startParents
      .filter(parent => endParents.includes(parent))

    if (affiliation.length) {
      return affiliation.find(parent => parent.type === 'figure')
    }
  }

  prototype.tableBlockUpdate = function (block: BlockLike): BlockLike | false {
    const { type } = block
    if (type !== 'p') return false
    const { text } = block.children[0]
    const match = TABLE_BLOCK_REG.exec(text)
    return (match && isLengthEven(match[1]) && isLengthEven(match[2])) ? this.initTable(block) : false
  }
}

export default tableBlockCtrl
