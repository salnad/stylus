import marked from '../parser/marked'
import Prism from 'prismjs'
// @ts-expect-error -- `katex` is bundled at runtime but does not ship repo-local TypeScript declarations here.
import katex from 'katex'
import 'katex/dist/contrib/mhchem.min.js'
import loadRenderer from '../renderers'
import githubMarkdownCss from 'github-markdown-css/github-markdown.css'
import exportStyle from '../assets/styles/exportStyle.css'
import highlightCss from 'prismjs/themes/prism.css'
import katexCss from 'katex/dist/katex.css'
import footerHeaderCss from '../assets/styles/headerFooterStyle.css'
import { EXPORT_DOMPURIFY_CONFIG } from '../config'
import { sanitize, unescapeHTML } from '../utils'
import { validEmoji } from '../ui/emojis'

type DiagramType = 'mermaid' | 'flowchart' | 'sequence' | 'plantuml' | 'vega-lite'
type DiagramRendererType = Exclude<DiagramType, 'mermaid'>

interface HeaderFooterSection {
  type: number
  left: string
  center: string
  right: string
}

interface ExportHtmlOptions {
  printOptimization?: boolean
  toc?: string
  title: string
  extraCss?: string
  header?: HeaderFooterSection
  footer?: HeaderFooterSection
  headerFooterStyled?: boolean
}

interface MuyaOptionsLike {
  mermaidTheme: string
  sequenceTheme: string
  superSubScript: boolean
  footnote: boolean
  isGitlabCompatibilityEnabled: boolean
  [key: string]: unknown
}

interface MuyaLike {
  options: MuyaOptionsLike
}

interface EmojiValidationResult {
  emoji: string
  [key: string]: unknown
}

interface PrismLike {
  languages: Record<string, unknown>
  highlight(code: string, grammar: unknown, language: string): string
}

interface KatexLike {
  renderToString(math: string, options: { displayMode: boolean }): string
}

interface MermaidRenderer {
  initialize(options: {
    securityLevel: string
    theme: string
  }): void
  init(config: unknown, target: Element | NodeListOf<Element>): void
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
  target: Element,
  spec: unknown,
  options: Record<string, unknown>
) => Promise<unknown>

type MarkedRenderOptions = {
  superSubScript?: boolean
  footnote?: boolean
  isGitlabCompatibilityEnabled?: boolean
  highlight?: (code: string, lang?: string) => string
  emojiRenderer?: (emoji: string) => string
  mathRenderer?: (math: string, displayMode: boolean) => string
  tocRenderer?: (content?: string) => string
  [key: string]: unknown
}

type MarkedRenderer = (markdown: string, options?: MarkedRenderOptions) => string
type RendererLoader = (name: string) => Promise<unknown>
type SanitizeHelper = (html: string, purifyOptions?: unknown, disableHtml?: boolean) => string
type UnescapeHtmlHelper = (html: string) => string
type EmojiValidator = (emoji: string) => EmojiValidationResult | undefined

const prism = Prism as unknown as PrismLike
const katexRenderer = katex as unknown as KatexLike
const loadRendererFn = loadRenderer as RendererLoader
const sanitizeHtml = sanitize as SanitizeHelper
const unescapeHtml = unescapeHTML as UnescapeHtmlHelper
const validEmojiFn = validEmoji as EmojiValidator
const markedRenderer = marked as MarkedRenderer

export const getSanitizeHtml = (markdown: string, options: MarkedRenderOptions): string => {
  const html = markedRenderer(markdown, options)
  return sanitizeHtml(html, EXPORT_DOMPURIFY_CONFIG, false)
}

const DIAGRAM_TYPE: DiagramType[] = [
  'mermaid',
  'flowchart',
  'sequence',
  'plantuml',
  'vega-lite'
]

const isDiagramType = (lang: string): lang is DiagramType => {
  return DIAGRAM_TYPE.includes(lang as DiagramType)
}

class ExportHtml {
  markdown: string
  muya?: MuyaLike
  exportContainer: HTMLDivElement | null
  mathRendererCalled: boolean

  constructor (markdown: string, muya?: MuyaLike) {
    this.markdown = markdown
    this.muya = muya
    this.exportContainer = null
    this.mathRendererCalled = false
  }

  async renderMermaid (): Promise<void> {
    const exportContainer = this.exportContainer as HTMLDivElement
    const codes = exportContainer.querySelectorAll<HTMLElement>('code.language-mermaid')
    for (const code of codes) {
      const preElement = code.parentElement as HTMLElement
      const mermaidContainer = document.createElement('div')
      mermaidContainer.innerHTML = sanitizeHtml(unescapeHtml(code.innerHTML), EXPORT_DOMPURIFY_CONFIG, true)
      mermaidContainer.classList.add('mermaid')
      preElement.replaceWith(mermaidContainer)
    }
    const mermaid = await loadRendererFn('mermaid') as MermaidRenderer
    // We only export light theme, so set mermaid theme to `default`, in the future, we can choose whick theme to export.
    mermaid.initialize({
      securityLevel: 'strict',
      theme: 'default'
    })
    mermaid.init(undefined, exportContainer.querySelectorAll<Element>('div.mermaid'))
    if (this.muya) {
      mermaid.initialize({
        securityLevel: 'strict',
        theme: this.muya.options.mermaidTheme
      })
    }
  }

  async renderDiagram (): Promise<void> {
    const exportContainer = this.exportContainer as HTMLDivElement
    const muya = this.muya as MuyaLike
    const selector = 'code.language-vega-lite, code.language-flowchart, code.language-sequence, code.language-plantuml'
    const renderMap: Record<DiagramRendererType, unknown> = {
      flowchart: await loadRendererFn('flowchart'),
      sequence: await loadRendererFn('sequence'),
      plantuml: await loadRendererFn('plantuml'),
      'vega-lite': await loadRendererFn('vega-lite')
    }
    const codes = exportContainer.querySelectorAll<HTMLElement>(selector)
    for (const code of codes) {
      const rawCode = unescapeHtml(code.innerHTML)
      const functionType: DiagramRendererType = (() => {
        if (/sequence/.test(code.className)) {
          return 'sequence'
        } else if (/plantuml/.test(code.className)) {
          return 'plantuml'
        } else if (/flowchart/.test(code.className)) {
          return 'flowchart'
        } else {
          return 'vega-lite'
        }
      })()
      const render = renderMap[functionType]
      const preParent = code.parentElement as HTMLElement
      const diagramContainer = document.createElement('div')
      diagramContainer.classList.add(functionType)
      preParent.replaceWith(diagramContainer)
      const options: Record<string, unknown> = {}
      if (functionType === 'sequence') {
        Object.assign(options, { theme: muya.options.sequenceTheme })
      } else if (functionType === 'vega-lite') {
        Object.assign(options, {
          actions: false,
          tooltip: false,
          renderer: 'svg',
          theme: 'latimes' // only render light theme
        })
      }
      try {
        if (functionType === 'flowchart' || functionType === 'sequence') {
          const diagram = (render as DiagramParser<SvgDiagram>).parse(rawCode)
          diagramContainer.innerHTML = ''
          diagram.drawSVG(diagramContainer, options)
        }
        if (functionType === 'plantuml') {
          const diagram = (render as DiagramParser<ImageDiagram>).parse(rawCode)
          diagramContainer.innerHTML = ''
          diagram.insertImgElement(diagramContainer)
        }
        if (functionType === 'vega-lite') {
          await (render as VegaLiteRenderer)(diagramContainer, JSON.parse(rawCode), options)
        }
      } catch (_err) {
        diagramContainer.innerHTML = '< Invalid Diagram >'
      }
    }
  }

  mathRenderer = (math: string, displayMode: boolean): string => {
    this.mathRendererCalled = true

    try {
      return katexRenderer.renderToString(math, {
        displayMode
      })
    } catch (_err) {
      return displayMode
        ? `<pre class="multiple-math invalid">\n${math}</pre>\n`
        : `<span class="inline-math invalid" title="invalid math">${math}</span>`
    }
  }

  // render pure html by marked
  async renderHtml (toc?: string): Promise<string> {
    this.mathRendererCalled = false
    let html = markedRenderer(this.markdown, {
      superSubScript: this.muya ? this.muya.options.superSubScript : false,
      footnote: this.muya ? this.muya.options.footnote : false,
      isGitlabCompatibilityEnabled: this.muya ? this.muya.options.isGitlabCompatibilityEnabled : false,
      highlight (code: string, lang?: string) {
        // Language may be undefined (GH#591)
        if (!lang) {
          return code
        }

        if (isDiagramType(lang)) {
          return code
        }

        const grammar = prism.languages[lang]
        if (!grammar) {
          console.warn(`Unable to find grammar for "${lang}".`)
          return code
        }
        return prism.highlight(code, grammar, lang)
      },
      emojiRenderer (emoji: string) {
        const validate = validEmojiFn(emoji)
        if (validate) {
          return validate.emoji
        } else {
          return `:${emoji}:`
        }
      },
      mathRenderer: this.mathRenderer,
      tocRenderer () {
        if (!toc) {
          return ''
        }
        return toc
      }
    })

    html = sanitizeHtml(html, EXPORT_DOMPURIFY_CONFIG, false)

    const exportContainer = this.exportContainer = document.createElement('div')
    exportContainer.classList.add('ag-render-container')
    exportContainer.innerHTML = html
    document.body.appendChild(exportContainer)

    // render only render the light theme of mermaid and diragram...
    await this.renderMermaid()
    await this.renderDiagram()
    let result = exportContainer.innerHTML
    exportContainer.remove()

    // hack to add arrow marker to output html
    const pathes = document.querySelectorAll<SVGPathElement>('path[id^=raphael-marker-]')
    const def = '<defs style="-webkit-tap-highlight-color: rgba(0, 0, 0, 0);">'
    result = result.replace(def, () => {
      let str = ''
      for (const path of pathes) {
        str += path.outerHTML
      }
      return `${def}${str}`
    })

    this.exportContainer = null
    return result
  }

  /**
   * Get HTML with style
   *
   * @param {*} options Document options
   */
  async generate (options: ExportHtmlOptions): Promise<string> {
    const { printOptimization } = options

    // WORKAROUND: Hide Prism.js style when exporting or printing. Otherwise the background color is white in the dark theme.
    const highlightCssStyle = printOptimization ? `@media print { ${highlightCss} }` : highlightCss
    const html = this._prepareHtml(await this.renderHtml(options.toc), options)
    const katexCssStyle = this.mathRendererCalled ? katexCss : ''
    this.mathRendererCalled = false

    // `extraCss` may changed in the mean time.
    const { title, extraCss } = options
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${sanitizeHtml(title, EXPORT_DOMPURIFY_CONFIG, true)}</title>
  <style>
  ${githubMarkdownCss}
  </style>
  <style>
  ${highlightCssStyle}
  </style>
  <style>
  ${katexCssStyle}
  </style>
  <style>
    .markdown-body {
      font-family: -apple-system,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji;
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }

    @media not print {
      .markdown-body {
        padding: 45px;
      }

      @media (max-width: 767px) {
        .markdown-body {
          padding: 15px;
        }
      }
    }

    .hf-container {
      color: #24292e;
      line-height: 1.3;
    }

    .markdown-body .highlight pre,
    .markdown-body pre {
      white-space: pre-wrap;
    }
    .markdown-body table {
      display: table;
    }
    .markdown-body img[data-align="center"] {
      display: block;
      margin: 0 auto;
    }
    .markdown-body img[data-align="right"] {
      display: block;
      margin: 0 0 0 auto;
    }
    .markdown-body li.task-list-item {
      list-style-type: none;
    }
    .markdown-body li > [type=checkbox] {
      margin: 0 0 0 -1.3em;
    }
    .markdown-body input[type="checkbox"] ~ p {
      margin-top: 0;
      display: inline-block;
    }
    .markdown-body ol ol,
    .markdown-body ul ol {
      list-style-type: decimal;
    }
    .markdown-body ol ol ol,
    .markdown-body ol ul ol,
    .markdown-body ul ol ol,
    .markdown-body ul ul ol {
      list-style-type: decimal;
    }
  </style>
  <style>${exportStyle}</style>
  <style>${extraCss}</style>
</head>
<body>
  ${html}
</body>
</html>`
  }

  /**
   * @private
   *
   * @param {string} html The converted HTML text.
   * @param {*} options The export options.
   */
  _prepareHtml (html: string, options: ExportHtmlOptions): string {
    const { header, footer } = options
    const appendHeaderFooter = !!header || !!footer
    if (!appendHeaderFooter) {
      return createMarkdownArticle(html)
    }

    if (!options.extraCss) {
      options.extraCss = footerHeaderCss
    } else {
      options.extraCss = footerHeaderCss + options.extraCss
    }

    let output = HF_TABLE_START
    if (header) {
      output += createTableHeader(options)
    }

    if (footer) {
      output += HF_TABLE_FOOTER
      output = createRealFooter(options) + output
    }

    output = output + createTableBody(html) + HF_TABLE_END
    return sanitizeHtml(output, EXPORT_DOMPURIFY_CONFIG, false)
  }
}

// Variables and function to generate the header and footer.
const HF_TABLE_START = '<table class="page-container">'
const createTableBody = (html: string): string => {
  return `<tbody><tr><td>
  <div class="main-container">
    ${createMarkdownArticle(html)}
  </div>
</td></tr></tbody>`
}
const HF_TABLE_END = '</table>'

/// The header at is shown at the top.
const createTableHeader = (options: ExportHtmlOptions): string => {
  const { header, headerFooterStyled } = options
  const { type, left, center, right } = header as HeaderFooterSection
  let headerClass = type === 1 ? 'single' : ''
  headerClass += getHeaderFooterStyledClass(headerFooterStyled)
  return `<thead class="page-header ${headerClass}"><tr><th>
  <div class="hf-container">
    <div class="header-content-left">${left}</div>
    <div class="header-content">${center}</div>
    <div class="header-content-right">${right}</div>
  </div>
</th></tr></thead>`
}

/// Fake footer to reserve space.
const HF_TABLE_FOOTER = `<tfoot class="page-footer-fake"><tr><td>
  <div class="hf-container">
    &nbsp;
  </div>
</td></tr></tfoot>`

/// The real footer at is shown at the bottom.
const createRealFooter = (options: ExportHtmlOptions): string => {
  const { footer, headerFooterStyled } = options
  const { type, left, center, right } = footer as HeaderFooterSection
  let footerClass = type === 1 ? 'single' : ''
  footerClass += getHeaderFooterStyledClass(headerFooterStyled)
  return `<div class="page-footer ${footerClass}">
  <div class="hf-container">
    <div class="footer-content-left">${left}</div>
    <div class="footer-content">${center}</div>
    <div class="footer-content-right">${right}</div>
  </div>
</div>`
}

/// Generate the mardown article HTML.
const createMarkdownArticle = (html: string): string => {
  return `<article class="markdown-body">${html}</article>`
}

/// Return the class whether a header/footer should be styled.
const getHeaderFooterStyledClass = (value: boolean | undefined): string => {
  if (value === undefined) {
    // Prefer theme settings.
    return ''
  }
  return !value ? ' simple' : ' styled'
}

export default ExportHtml
