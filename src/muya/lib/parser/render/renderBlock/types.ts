import { patch } from '../snabbdom'

export type RenderVNode = Parameters<typeof patch>[1]
export type RenderChild = RenderVNode | string
export type RenderChildren = RenderChild[]
export type SnabbdomDataValue = string | number | boolean
export type SnabbdomDataRecord = Record<string, SnabbdomDataValue>

export interface CursorPositionLike {
  key: string
  offset: number
}

export interface CursorRangeLike {
  start: CursorPositionLike
  end: CursorPositionLike
}

export interface MatchLike {
  key: string
  start: number
  end: number
  active?: boolean
  [key: string]: unknown
}

export interface TokenRangeLike {
  start: number
  end: number
}

export interface TokenLike {
  type: string
  range: TokenRangeLike
  children?: TokenLike[]
  highlights?: MatchLike[]
  [key: string]: unknown
}

export interface TableCellSelectionLike {
  key: string
  top?: boolean
  right?: boolean
  bottom?: boolean
  left?: boolean
}

export interface SelectedTableCellsLike {
  cells?: TableCellSelectionLike[]
}

export interface BlockLike {
  key: string
  type: string
  text?: string
  parent?: string | null
  children?: BlockLike[]
  align?: string
  headingStyle?: string
  editable?: boolean
  functionType?: string
  listType?: string
  listItemType?: string
  bulletMarkerOrDelimiter?: string
  isLooseListItem?: boolean
  lang?: string
  column?: number
  row?: number
  start?: number
  checked?: boolean
  preSibling?: string
  nextSibling?: string | null
  [key: string]: unknown
}

export interface RenderMermaidCacheValue {
  code: string
  functionType?: string
}

export interface RenderDiagramCacheValue {
  code: string
  functionType: string
}

export interface MuyaOptionsLike {
  fontSize: number
  lineHeight: number
  disableHtml?: boolean
  [key: string]: unknown
}

export interface ContentStateLike {
  cursor: CursorRangeLike
  selectedTableCells?: SelectedTableCellsLike | null
  [key: string]: unknown
}

export interface MuyaLike {
  contentState: ContentStateLike
  options: MuyaOptionsLike
}

export interface SnabbdomDataLike {
  attrs?: SnabbdomDataRecord
  dataset?: SnabbdomDataRecord
  props?: SnabbdomDataRecord
  style?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

export type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

export type InlineRenderChunk = RenderChild | RenderChildren

export interface RenderBlockContextLike {
  muya: MuyaLike
  codeCache: Map<string, string>
  tokenCache: Map<string, TokenLike[]>
  loadMathMap: Map<string, RenderChildren>
  mermaidCache: Map<string, RenderMermaidCacheValue>
  diagramCache: Map<string, RenderDiagramCacheValue>
  labels: Map<string, unknown>
  renderingTable: BlockLike | null
  renderingRowContainer: BlockLike | null
  getSelector(block: BlockLike, activeBlocks: BlockLike[]): string
  renderBlock(
    parent: BlockLike | null,
    block: BlockLike,
    activeBlocks: BlockLike[],
    matches: MatchLike[],
    useCache?: boolean
  ): RenderVNode
  renderLeafBlock(
    parent: BlockLike | null,
    block: BlockLike,
    activeBlocks: BlockLike[],
    matches: MatchLike[],
    useCache?: boolean
  ): RenderVNode
  renderContainerBlock(
    parent: BlockLike | null,
    block: BlockLike,
    activeBlocks: BlockLike[],
    matches: MatchLike[],
    useCache?: boolean
  ): RenderVNode
  renderIcon(block: BlockLike): RenderVNode
  getClassName(
    outerClass: string | undefined,
    block: BlockLike,
    token: TokenLike,
    cursor: CursorRangeLike
  ): string
  highlight(
    createVNode: SnabbdomHelper,
    block: BlockLike,
    start: number,
    end: number,
    token: TokenLike
  ): RenderChildren
  getHighlightClassName(active: boolean | undefined): string
  [methodName: string]: unknown
}
