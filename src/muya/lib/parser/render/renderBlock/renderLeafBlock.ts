// @ts-expect-error -- `katex` is bundled at runtime but does not ship repo-local TypeScript declarations here.
import katex from 'katex'
import prism, { loadedLanguages, transformAliasToOrigin } from '../../../prism/'
import 'katex/dist/contrib/mhchem.min.js'
import { CLASS_OR_ID, DEVICE_MEMORY, PREVIEW_DOMPURIFY_CONFIG, HAS_TEXT_BLOCK_REG } from '../../../config'
import { tokenizer } from '../../'
import { snakeToCamel, sanitize, escapeHTML, getLongUniqueId, getImageInfo } from '../../../utils'
import { h, htmlToVNode } from '../snabbdom'
import type {
  BlockLike,
  CursorRangeLike,
  MatchLike,
  RenderBlockContextLike,
  RenderChildren,
  RenderDiagramCacheValue,
  RenderMermaidCacheValue,
  RenderVNode,
  SnabbdomDataLike,
  SnabbdomDataRecord,
  SnabbdomHelper,
  TokenLike
} from './types'

interface TokenizerOptionsLike {
  highlights: MatchLike[]
  hasBeginRules: boolean
  labels: Map<string, unknown>
  options: Record<string, unknown>
}

interface TokenizerLike {
  (src: string, options: TokenizerOptionsLike): TokenLike[]
}

interface HtmlToVNodeLike {
  (html: string): RenderChildren
}

interface KatexLike {
  renderToString(math: string, options: { displayMode: boolean }): string
}

interface PrismElementContext {
  innerHTML: string
}

interface PrismLike {
  highlightElement(
    element: Element,
    async?: boolean,
    callback?: (this: PrismElementContext) => void
  ): void
}

interface DivBlockLike extends BlockLike {
  preSibling?: string
  functionType?: 'html' | 'multiplemath' | 'mermaid' | 'flowchart' | 'sequence' | 'plantuml' | 'vega-lite' | string
}

interface InputBlockLike extends BlockLike {
  checked?: boolean
}

interface SpanBlockLike extends BlockLike {
  lang?: string
  functionType?: 'codeContent' | 'languageInput' | 'footnoteInput' | string
}

interface ImageInfoLike {
  src: string
}

type InlineRendererMap = Record<string, unknown>

const createVNode = h as unknown as SnabbdomHelper
const htmlToVNodeFn = htmlToVNode as unknown as HtmlToVNodeLike
const katexRenderer = katex as unknown as KatexLike
const prismRenderer = prism as unknown as PrismLike
const tokenize = tokenizer as unknown as TokenizerLike
const getImageInfoFn = getImageInfo as unknown as (src: string) => ImageInfoLike

// todo@jocs any better solutions?
const MARKER_HASK = {
  '<': `%${getLongUniqueId()}%`,
  '>': `%${getLongUniqueId()}%`,
  '"': `%${getLongUniqueId()}%`,
  "'": `%${getLongUniqueId()}%`
} as const

const getHighlightHtml = (text: string, highlights: MatchLike[], escape = false, handleLineEnding = false): string => {
  let code = ''
  let pos = 0
  const getEscapeHTML = (className: string, content: string): string => {
    return `${MARKER_HASK['<']}span class=${MARKER_HASK['"']}${className}${MARKER_HASK['"']}${MARKER_HASK['>']}${content}${MARKER_HASK['<']}/span${MARKER_HASK['>']}`
  }

  for (const highlight of highlights) {
    const { start, end, active } = highlight
    code += text.substring(pos, start)
    const className = active ? 'ag-highlight' : 'ag-selection'
    let highlightContent = text.substring(start, end)
    if (handleLineEnding && text.endsWith('\n') && end === text.length) {
      highlightContent = highlightContent.substring(start, end - 1) +
        (escape
          ? getEscapeHTML('ag-line-end', '\n')
          : '<span class="ag-line-end">\n</span>')
    }
    code += escape
      ? getEscapeHTML(className, highlightContent)
      : `<span class="${className}">${highlightContent}</span>`
    pos = end
  }
  if (pos !== text.length) {
    if (handleLineEnding && text.endsWith('\n')) {
      code += text.substring(pos, text.length - 1) +
        (escape
          ? getEscapeHTML('ag-line-end', '\n')
          : '<span class="ag-line-end">\n</span>')
    } else {
      code += text.substring(pos)
    }
  }
  return escapeHTML(code)
}

const hasReferenceToken = (tokens: TokenLike[]): boolean => {
  let result = false
  const travel = (nestedTokens: TokenLike[]): void => {
    for (const token of nestedTokens) {
      if (/reference_image|reference_link/.test(token.type)) {
        result = true
        break
      }
      if (Array.isArray(token.children) && token.children.length) {
        travel(token.children)
      }
    }
  }
  travel(tokens)
  return result
}

const flattenInlineChunk = (chunk: RenderVNode | RenderChildren | string): RenderChildren => {
  return Array.isArray(chunk) ? chunk : [chunk]
}

const getInlineRenderer = (context: RenderBlockContextLike, token: TokenLike) => {
  const rendererName = snakeToCamel(token.type)
  return context[rendererName] as (
    this: RenderBlockContextLike,
    createVNode: SnabbdomHelper,
    cursor: CursorRangeLike,
    block: BlockLike,
    token: TokenLike,
    outerClass?: string
  ) => RenderVNode | RenderChildren | string
}

export default function renderLeafBlock (
  this: RenderBlockContextLike & InlineRendererMap,
  _parent: BlockLike | null,
  block: BlockLike,
  activeBlocks: BlockLike[],
  matches: MatchLike[],
  useCache = false
): RenderVNode {
  const { loadMathMap } = this
  const { cursor } = this.muya.contentState
  let selector = this.getSelector(block, activeBlocks)
  // highlight search key in block
  const highlights = matches.filter(m => m.key === block.key)
  const {
    text,
    type,
    editable
  } = block

  const leafBlock = block as InputBlockLike & SpanBlockLike & DivBlockLike
  const { checked, key, lang, functionType } = leafBlock

  const props: SnabbdomDataRecord = {}
  const attrs: SnabbdomDataRecord = {}
  const dataset: SnabbdomDataRecord = {}
  const data: SnabbdomDataLike = {
    props,
    attrs,
    dataset,
    style: {} as Record<string, string>
  }

  let children: RenderChildren = []

  if (typeof text === 'string') {
    let tokens: TokenLike[] = []
    if (highlights.length === 0 && this.tokenCache.has(text)) {
      tokens = this.tokenCache.get(text) ?? []
    } else if (
      HAS_TEXT_BLOCK_REG.test(type) &&
      functionType !== 'codeContent' &&
      functionType !== 'languageInput'
    ) {
      const hasBeginRules = /paragraphContent|atxLine/.test(functionType ?? '')

      tokens = tokenize(text, {
        highlights,
        hasBeginRules,
        labels: this.labels,
        options: this.muya.options
      })
      const hasReferenceTokens = hasReferenceToken(tokens)
      if (highlights.length === 0 && useCache && DEVICE_MEMORY >= 4 && !hasReferenceTokens) {
        this.tokenCache.set(text, tokens)
      }
    }
    children = tokens.reduce<RenderChildren>((accumulator, token) => {
      const renderer = getInlineRenderer(this, token)
      const chunk = renderer.call(this, createVNode, cursor, block, token)
      return [...accumulator, ...flattenInlineChunk(chunk)]
    }, [])
  }

  if (editable === false) {
    Object.assign(attrs, {
      spellcheck: 'false',
      contenteditable: 'false'
    })
  }

  if (type === 'div') {
    const code = this.codeCache.get(leafBlock.preSibling ?? '') ?? ''
    switch (functionType) {
      case 'html': {
        selector += `.${CLASS_OR_ID.AG_HTML_PREVIEW}`
        Object.assign(attrs, { spellcheck: 'false' })

        const { disableHtml } = this.muya.options
        const htmlContent = sanitize(code, PREVIEW_DOMPURIFY_CONFIG, disableHtml)

        // handle empty html bock
        if (/^<([a-z][a-z\d]*)[^>]*?>(\s*)<\/\1>$/.test(htmlContent.trim())) {
          children = htmlToVNodeFn('<div class="ag-empty">&lt;Empty HTML Block&gt;</div>')
        } else {
          const parser = new DOMParser()
          const doc = parser.parseFromString(htmlContent, 'text/html')
          const imgs = doc.documentElement.querySelectorAll('img')
          for (const img of imgs) {
            const src = img.getAttribute('src')
            const imageInfo = getImageInfoFn(src ?? '')
            img.setAttribute('src', imageInfo.src)
          }

          children = htmlToVNodeFn(doc.documentElement.querySelector('body')?.innerHTML ?? '')
        }
        break
      }
      case 'multiplemath': {
        const cacheKey = `${code}_display_math`
        selector += `.${CLASS_OR_ID.AG_CONTAINER_PREVIEW}`
        Object.assign(attrs, { spellcheck: 'false' })
        if (code === '') {
          children = ['< Empty Mathematical Formula >']
          selector += `.${CLASS_OR_ID.AG_EMPTY}`
        } else if (loadMathMap.has(cacheKey)) {
          children = loadMathMap.get(cacheKey) ?? []
        } else {
          try {
            const html = katexRenderer.renderToString(code, {
              displayMode: true
            })

            children = htmlToVNodeFn(html)
            loadMathMap.set(cacheKey, children)
          } catch (_err) {
            children = ['< Invalid Mathematical Formula >']
            selector += `.${CLASS_OR_ID.AG_MATH_ERROR}`
          }
        }
        break
      }
      case 'mermaid': {
        selector += `.${CLASS_OR_ID.AG_CONTAINER_PREVIEW}`
        Object.assign(attrs, { spellcheck: 'false' })
        if (code === '') {
          children = ['< Empty Mermaid Block >']
          selector += `.${CLASS_OR_ID.AG_EMPTY}`
        } else {
          children = ['Loading...']
          this.mermaidCache.set(`#${block.key}`, {
            code,
            functionType
          } as RenderMermaidCacheValue)
        }
        break
      }
      case 'flowchart':
      case 'sequence':
      case 'plantuml':
      case 'vega-lite': {
        selector += `.${CLASS_OR_ID.AG_CONTAINER_PREVIEW}`
        Object.assign(attrs, { spellcheck: 'false' })
        if (code === '') {
          children = ['< Empty Diagram Block >']
          selector += `.${CLASS_OR_ID.AG_EMPTY}`
        } else {
          children = ['Loading...']
          this.diagramCache.set(`#${block.key}`, {
            code,
            functionType
          } as RenderDiagramCacheValue)
        }
        break
      }
    }
  } else if (type === 'input') {
    const { fontSize, lineHeight } = this.muya.options

    Object.assign(attrs, {
      type: 'checkbox',
      style: `top: ${(fontSize * lineHeight / 2 - 8).toFixed(2)}px`
    })

    selector = `${type}#${key}.${CLASS_OR_ID.AG_TASK_LIST_ITEM_CHECKBOX}`
    if (checked) {
      Object.assign(attrs, {
        checked: true
      })
      selector += `.${CLASS_OR_ID.AG_CHECKBOX_CHECKED}`
    }
    children = []
  } else if (type === 'span' && functionType === 'codeContent') {
    const code = getHighlightHtml(text ?? '', highlights, true, true)
      .replace(new RegExp(MARKER_HASK['<'], 'g'), '<')
      .replace(new RegExp(MARKER_HASK['>'], 'g'), '>')
      .replace(new RegExp(MARKER_HASK['"'], 'g'), '"')
      .replace(new RegExp(MARKER_HASK["'"], 'g'), "'")

    // transform alias to original language
    const transformedLang = transformAliasToOrigin([lang ?? ''])[0]
    if (transformedLang && /\S/.test(code) && loadedLanguages.has(transformedLang)) {
      const wrapper = document.createElement('div')
      wrapper.classList.add(`language-${transformedLang}`)
      wrapper.innerHTML = code
      prismRenderer.highlightElement(wrapper, false, function () {
        const highlightedCode = this.innerHTML
        selector += `.language-${transformedLang}`
        children = htmlToVNodeFn(highlightedCode)
      })
    } else {
      children = htmlToVNodeFn(code)
    }
  } else if (type === 'span' && functionType === 'languageInput') {
    const escapedText = sanitize(text ?? '', PREVIEW_DOMPURIFY_CONFIG, true)
    const html = getHighlightHtml(escapedText, highlights, true)
    children = htmlToVNodeFn(html)
  } else if (type === 'span' && functionType === 'footnoteInput') {
    Object.assign(attrs, { spellcheck: 'false' })
  }

  if (!block.parent) {
    return createVNode(selector, data, [this.renderIcon(block), ...children])
  } else {
    return createVNode(selector, data, children)
  }
}
