import BaseFloat, {
  type BaseFloatCallback,
  type BaseFloatEventCenterLike,
  type FloatReference,
  type MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import './index.css'
import { EVENT_KEYS } from '../../config'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]
interface TableSize {
  row: number
  column: number
}

type TablePickerCallback = (row: number, column: number) => void
type TableDimensionKey = keyof TableSize

interface TablePickerEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(
    event: 'muya-table-picker',
    listener: (data: TableSize, reference: FloatReference, cb: TablePickerCallback) => void
  ): void
}

interface TablePickerKeyboardEvent extends KeyboardEvent {
  target: HTMLInputElement
}

interface SnabbdomDataLike {
  key?: string
  dataset?: Record<string, string>
  props?: Record<string, unknown>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper

class TablePicker extends BaseFloat {
  static pluginName = 'tablePicker'

  checkerCount: TableSize
  oldVnode: RenderVNode | null
  current: TableSize
  select: TableSize
  tableContainer: HTMLDivElement

  constructor (muya: BaseFloatMuyaLike) {
    const name = 'ag-table-picker'
    super(muya, name)
    this.checkerCount = {
      row: 6,
      column: 8
    }
    this.oldVnode = null
    this.current = {
      row: -1,
      column: -1
    }
    this.select = {
      row: -1,
      column: -1
    }
    const tableContainer = this.tableContainer = document.createElement('div')
    this.container.appendChild(tableContainer)
    this.listen()
  }

  listen (): void {
    super.listen()
    const eventCenter = this.muya.eventCenter as TablePickerEventCenterLike
    eventCenter.subscribe('muya-table-picker', (data, reference, cb) => {
      if (!this.status) {
        this.show(data, reference, cb)
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render (): void {
    const { row, column } = this.checkerCount
    const { row: currentRow, column: currentColumn } = this.current
    const { row: selectedRow, column: selectedColumn } = this.select
    const { tableContainer, oldVnode } = this
    const tableRows: RenderVNode[] = []

    for (let i = 0; i < row; i++) {
      const rowSelector = 'div.ag-table-picker-row'
      const cells: RenderVNode[] = []
      for (let j = 0; j < column; j++) {
        let cellSelector = 'span.ag-table-picker-cell'
        if (i <= currentRow && j <= currentColumn) {
          cellSelector += '.current'
        }
        if (i <= selectedRow && j <= selectedColumn) {
          cellSelector += '.selected'
        }

        cells.push(createVNode(cellSelector, {
          key: j.toString(),
          dataset: {
            row: i.toString(),
            column: j.toString()
          },
          on: {
            mouseenter: event => {
              const target = (event as MouseEvent).target as HTMLElement | null
              const nextRow = target?.getAttribute('data-row')
              const nextColumn = target?.getAttribute('data-column')

              if (nextRow === null || nextColumn === null) {
                return
              }

              this.select = {
                row: Number(nextRow),
                column: Number(nextColumn)
              }
              this.render()
            },
            click: _event => {
              this.selectItem()
            }
          }
        }, []))
      }

      tableRows.push(createVNode(rowSelector, cells))
    }

    const tableFooter = createVNode('div.footer', [
      createVNode('input.row-input', {
        props: {
          type: 'text',
          value: this.select.row + 1
        },
        on: {
          keyup: event => {
            this.keyupHandler(event as TablePickerKeyboardEvent, 'row')
          }
        }
      }, []),
      'x',
      createVNode('input.column-input', {
        props: {
          type: 'text',
          value: this.select.column + 1
        },
        on: {
          keyup: event => {
            this.keyupHandler(event as TablePickerKeyboardEvent, 'column')
          }
        }
      }, []),
      createVNode('button', {
        on: {
          click: _event => {
            this.selectItem()
          }
        }
      }, 'OK')
    ])

    const vnode = createVNode('div', [createVNode('div.checker', tableRows), tableFooter])

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(tableContainer as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  keyupHandler (event: TablePickerKeyboardEvent, type: TableDimensionKey): void {
    let number = this.select[type]
    const value = Number(event.target.value)

    if (event.key === EVENT_KEYS.ArrowUp) {
      number++
    } else if (event.key === EVENT_KEYS.ArrowDown) {
      number--
    } else if (event.key === EVENT_KEYS.Enter) {
      this.selectItem()
    } else if (typeof value === 'number') {
      number = value - 1
    }

    if (number !== this.select[type]) {
      this.select[type] = Math.max(number, 0)
      this.render()
    }
  }

  show (reference: FloatReference, cb?: BaseFloatCallback): void
  show (current: TableSize, reference: FloatReference, cb: TablePickerCallback): void
  show (
    currentOrReference: TableSize | FloatReference,
    referenceOrCb?: FloatReference | BaseFloatCallback,
    cb?: TablePickerCallback
  ): void {
    if (typeof referenceOrCb === 'function' || typeof cb === 'undefined') {
      super.show(currentOrReference as FloatReference, referenceOrCb as BaseFloatCallback | undefined)
      return
    }

    this.current = currentOrReference as TableSize
    this.select = currentOrReference as TableSize
    super.show(referenceOrCb as FloatReference, cb as unknown as BaseFloatCallback)
  }

  selectItem (): void {
    const { row, column } = this.select
    const callback = this.cb as TablePickerCallback
    callback(Math.max(row, 0), Math.max(column, 0))
    this.hide()
  }
}

export default TablePicker
