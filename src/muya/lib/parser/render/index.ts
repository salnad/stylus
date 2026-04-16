import loadRenderer from '../../renderers'
import { CLASS_OR_ID, PREVIEW_DOMPURIFY_CONFIG } from '../../config'
import { conflict, mixins, camelToSnake, sanitize } from '../../utils'
import { patch, toVNode, toHTML, h } from './snabbdom'
import { beginRules } from '../rules'
import renderInlines from './renderInlines'
import renderBlock from './renderBlock'

type DiagramFunctionType = 'flowchart' | 'sequence' | 'plantuml' | 'vega-lite'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRange {
  start: CursorPosition
  end: CursorPosition
}

interface TokenLike {
  range: {
    start: number
    end: number
  }
  [key: string]: unknown
}

interface MatchLike {
  active?: boolean
  [key: string]: unknown
}

interface BlockLike {
  key: string
  type: string
  text?: string
  parent?: string | null
  functionType?: string
  children?: BlockLike[]
  [key: string]: unknown
}

interface LabelValue {
  href: string
  title: string
}

interface ImageCacheValue {
  touchMsec?: number
  [key: string]: unknown
}

interface MermaidCacheValue {
  code: string
  functionType?: string
}

interface DiagramCacheValue {
  code: string
  functionType: DiagramFunctionType
}

interface ContentStateLike {
  cursor: CursorRange
  selectedBlock: BlockLike | null
}

interface MuyaLike {
  eventCenter?: unknown
  contentState: ContentStateLike
  options: {
    mermaidTheme: string
    sequenceTheme: string
    vegaTheme: string
    [key: string]: unknown
  }
}

interface MermaidRenderer {
  initialize(options: {
    securityLevel: string
    theme: string
  }): void
  parse(code: string): void
  init(config: unknown, target: Element): void
}

interface SvgDiagram {
  drawSVG(target: Element, options: Record<string, unknown>): void
}

interface ImageDiagram {
  insertImgElement(target: Element): void
}

interface DiagramParser<TDiagram> {
  parse(code: string): TDiagram
}

type VegaLiteRenderer = (
  key: string,
  spec: unknown,
  options: Record<string, unknown>
) => Promise<unknown>

type RenderVNode = Parameters<typeof patch>[1]

type RenderBlockMethod = (
  parent: BlockLike | null,
  block: BlockLike,
  activeBlocks: BlockLike[],
  matches: MatchLike[],
  useCache?: boolean
) => RenderVNode

class StateRender {
  muya: MuyaLike
  eventCenter: unknown
  codeCache: Map<string, string>
  loadImageMap: Map<string, ImageCacheValue>
  loadMathMap: Map<string, unknown>
  mermaidCache: Map<string, MermaidCacheValue>
  diagramCache: Map<string, DiagramCacheValue>
  tokenCache: Map<string, unknown>
  labels: Map<string, LabelValue>
  urlMap: Map<string, unknown>
  renderingTable: BlockLike | null
  renderingRowContainer: BlockLike | null
  container: Element | null

  declare renderBlock: RenderBlockMethod

  constructor (muya: MuyaLike) {
    this.muya = muya
    this.eventCenter = muya.eventCenter
    this.codeCache = new Map()
    this.loadImageMap = new Map()
    this.loadMathMap = new Map()
    this.mermaidCache = new Map()
    this.diagramCache = new Map()
    this.tokenCache = new Map()
    this.labels = new Map()
    this.urlMap = new Map()
    this.renderingTable = null
    this.renderingRowContainer = null
    this.container = null
  }

  setContainer (container: Element | null): void {
    this.container = container
  }

  // collect link reference definition
  collectLabels (blocks: BlockLike[]): void {
    this.labels.clear()

    const travel = (block: BlockLike): void => {
      const { text, children } = block
      if (children && children.length) {
        children.forEach(c => travel(c))
      } else if (text) {
        const tokens = beginRules.reference_definition.exec(text)
        if (tokens) {
          const key = (tokens[2] + tokens[3]).toLowerCase()
          if (!this.labels.has(key)) {
            this.labels.set(key, {
              href: tokens[6],
              title: tokens[10] || ''
            })
          }
        }
      }
    }

    blocks.forEach(b => travel(b))
  }

  checkConflicted (block: BlockLike, token: TokenLike, cursor: CursorRange): boolean {
    const { start, end } = cursor
    const key = block.key
    const { start: tokenStart, end: tokenEnd } = token.range

    if (key !== start.key && key !== end.key) {
      return false
    } else if (key === start.key && key !== end.key) {
      return conflict([tokenStart, tokenEnd], [start.offset, start.offset])
    } else if (key !== start.key && key === end.key) {
      return conflict([tokenStart, tokenEnd], [end.offset, end.offset])
    } else {
      return conflict([tokenStart, tokenEnd], [start.offset, start.offset]) ||
        conflict([tokenStart, tokenEnd], [end.offset, end.offset])
    }
  }

  getClassName (outerClass: string | undefined, block: BlockLike, token: TokenLike, cursor: CursorRange): string {
    return outerClass || (this.checkConflicted(block, token, cursor) ? CLASS_OR_ID.AG_GRAY : CLASS_OR_ID.AG_HIDE)
  }

  getHighlightClassName (active: boolean | undefined): string {
    return active ? CLASS_OR_ID.AG_HIGHLIGHT : CLASS_OR_ID.AG_SELECTION
  }

  getSelector (block: BlockLike, activeBlocks: BlockLike[]): string {
    const { cursor, selectedBlock } = this.muya.contentState
    const type = block.type === 'hr' ? 'p' : block.type
    const isActive = activeBlocks.some(b => b.key === block.key) || block.key === cursor.start.key

    let selector = `${type}#${block.key}.${CLASS_OR_ID.AG_PARAGRAPH}`
    if (isActive) {
      selector += `.${CLASS_OR_ID.AG_ACTIVE}`
    }
    if (type === 'span') {
      selector += `.ag-${camelToSnake(block.functionType as string)}`
    }
    if (!block.parent && selectedBlock && block.key === selectedBlock.key) {
      selector += `.${CLASS_OR_ID.AG_SELECTED}`
    }
    return selector
  }

  async renderMermaid (): Promise<void> {
    if (this.mermaidCache.size) {
      const mermaid = await loadRenderer('mermaid') as MermaidRenderer
      mermaid.initialize({
        securityLevel: 'strict',
        theme: this.muya.options.mermaidTheme
      })
      for (const [key, value] of this.mermaidCache.entries()) {
        const { code } = value
        const target = document.querySelector(key)
        if (!target) {
          continue
        }
        try {
          mermaid.parse(code)
          target.innerHTML = sanitize(code, PREVIEW_DOMPURIFY_CONFIG, true)
          mermaid.init(undefined, target)
        } catch (_err) {
          target.innerHTML = '< Invalid Mermaid Codes >'
          target.classList.add(CLASS_OR_ID.AG_MATH_ERROR)
        }
      }

      this.mermaidCache.clear()
    }
  }

  async renderDiagram (): Promise<void> {
    const cache = this.diagramCache
    if (cache.size) {
      const renderMap: Record<DiagramFunctionType, unknown> = {
        flowchart: await loadRenderer('flowchart'),
        sequence: await loadRenderer('sequence'),
        plantuml: await loadRenderer('plantuml'),
        'vega-lite': await loadRenderer('vega-lite')
      }

      for (const [key, value] of cache.entries()) {
        const target = document.querySelector(key)
        if (!target) {
          continue
        }
        const { code, functionType } = value
        const render = renderMap[functionType]
        const options: Record<string, unknown> = {}
        if (functionType === 'sequence') {
          Object.assign(options, { theme: this.muya.options.sequenceTheme })
        } else if (functionType === 'vega-lite') {
          Object.assign(options, {
            actions: false,
            tooltip: false,
            renderer: 'svg',
            theme: this.muya.options.vegaTheme
          })
        }
        try {
          if (functionType === 'flowchart' || functionType === 'sequence') {
            const diagram = (render as DiagramParser<SvgDiagram>).parse(code)
            target.innerHTML = ''
            diagram.drawSVG(target, options)
          } else if (functionType === 'plantuml') {
            const diagram = (render as DiagramParser<ImageDiagram>).parse(code)
            target.innerHTML = ''
            diagram.insertImgElement(target)
          } else if (functionType === 'vega-lite') {
            await (render as VegaLiteRenderer)(key, JSON.parse(code), options)
          }
        } catch (_err) {
          target.innerHTML = `< Invalid ${functionType === 'flowchart' ? 'Flow Chart' : 'Sequence'} Codes >`
          target.classList.add(CLASS_OR_ID.AG_MATH_ERROR)
        }
      }
      this.diagramCache.clear()
    }
  }

  render (blocks: BlockLike[], activeBlocks: BlockLike[], matches: MatchLike[]): void {
    const selector = `div#${CLASS_OR_ID.AG_EDITOR_ID}`
    const children = blocks.map(block => {
      return this.renderBlock(null, block, activeBlocks, matches, true)
    })
    const newVdom = h(selector, children)
    const rootDom = document.querySelector(selector) || this.container
    const oldVdom = toVNode(rootDom as Element)

    patch(oldVdom, newVdom)
    this.renderMermaid()
    this.renderDiagram()
    this.codeCache.clear()
  }

  // Only render the blocks which you updated
  partialRender (
    blocks: BlockLike[],
    activeBlocks: BlockLike[],
    matches: MatchLike[],
    startKey: string | null,
    endKey: string | null
  ): void {
    const cursorOutMostBlock = activeBlocks[activeBlocks.length - 1]
    // If cursor is not in render blocks, need to render cursor block independently
    const needRenderCursorBlock = blocks.indexOf(cursorOutMostBlock) === -1
    const newVnode = h('section', blocks.map(block => this.renderBlock(null, block, activeBlocks, matches)))
    const html = toHTML(newVnode).replace(/^<section>([\s\S]+?)<\/section>$/, '$1')

    const needToRemoved: Element[] = []
    const firstOldDom = startKey
      ? document.querySelector(`#${startKey}`)
      : (document.querySelector(`div#${CLASS_OR_ID.AG_EDITOR_ID}`) as Element).firstElementChild
    if (!firstOldDom) {
      // TODO@Jocs Just for fix #541, Because I'll rewrite block and render method, it will nolonger have this issue.
      return
    }
    needToRemoved.push(firstOldDom)
    let nextSibling = firstOldDom.nextElementSibling
    while (nextSibling && nextSibling.id !== endKey) {
      needToRemoved.push(nextSibling)
      nextSibling = nextSibling.nextElementSibling
    }
    nextSibling && needToRemoved.push(nextSibling)

    firstOldDom.insertAdjacentHTML('beforebegin', html)

    needToRemoved.forEach(dom => dom.remove())

    // Render cursor block independently
    if (needRenderCursorBlock && cursorOutMostBlock) {
      const { key } = cursorOutMostBlock
      const cursorDom = document.querySelector(`#${key}`)
      if (cursorDom) {
        const oldCursorVnode = toVNode(cursorDom)
        const newCursorVnode = this.renderBlock(null, cursorOutMostBlock, activeBlocks, matches)
        patch(oldCursorVnode, newCursorVnode)
      }
    }

    this.renderMermaid()
    this.renderDiagram()
    this.codeCache.clear()
  }

  /**
   * Only render one block.
   *
   * @param {object} block
   * @param {array} activeBlocks
   * @param {array} matches
   */
  singleRender (block: BlockLike, activeBlocks: BlockLike[], matches: MatchLike[]): void {
    const selector = `#${block.key}`
    const newVdom = this.renderBlock(null, block, activeBlocks, matches, true)
    const rootDom = document.querySelector(selector)
    const oldVdom = toVNode(rootDom as Element)
    patch(oldVdom, newVdom)
    this.renderMermaid()
    this.renderDiagram()
    this.codeCache.clear()
  }

  invalidateImageCache (): void {
    this.loadImageMap.forEach((imageInfo, key) => {
      imageInfo.touchMsec = Date.now()
      this.loadImageMap.set(key, imageInfo)
    })
  }
}

mixins(StateRender, renderInlines, renderBlock)

export default StateRender
