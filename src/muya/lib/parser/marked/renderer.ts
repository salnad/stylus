import defaultOptions from './options'
import { cleanUrl, escape } from './utils'

interface RendererOptions {
  mathRenderer?: ((text: string, displayMode: boolean) => string) | null
  emojiRenderer?: ((emoji: string) => string) | null
  tocRenderer?: (() => string) | null
  highlight?: ((code: string, lang: string) => string | null) | null
  sanitize?: boolean
  baseUrl?: string | null
  headerIds?: boolean
  headerPrefix?: string
  langPrefix?: string
  xhtml?: boolean
}

interface FootnoteInfo {
  footnoteId?: string | number | null
  footnoteIdentifierId?: string | number | null
  order?: string | number
}

interface TableCellFlags {
  header?: boolean
  align?: string | null
}

class Renderer {
  public options: RendererOptions

  constructor (options: Partial<RendererOptions> = {}) {
    this.options = (options || defaultOptions) as RendererOptions
  }

  frontmatter (text: string): string {
    return `<pre class="front-matter">\n${text}</pre>\n`
  }

  multiplemath (text: string): string {
    let output = ''
    if (this.options.mathRenderer) {
      output = this.options.mathRenderer(text, true)
    }
    return output || `<pre class="multiple-math">\n${text}</pre>\n`
  }

  inlineMath (math: string): string {
    let output = ''
    if (this.options.mathRenderer) {
      output = this.options.mathRenderer(math, false)
    }
    return output || math
  }

  emoji (text: string, emoji: string): string {
    if (this.options.emojiRenderer) {
      return this.options.emojiRenderer(emoji)
    }
    return text
  }

  script (content: string, marker: string): string {
    const tagName = marker === '^' ? 'sup' : 'sub'
    return `<${tagName}>${content}</${tagName}>`
  }

  footnoteIdentifier (identifier: string, { footnoteId, footnoteIdentifierId, order }: FootnoteInfo): string {
    return `<a href="#${footnoteId ? `fn${footnoteId}` : ''}" class="footnote-ref" id="fnref${footnoteIdentifierId}" role="doc-noteref"><sup>${order || identifier}</sup></a>`
  }

  footnote (footnote: string): string {
    return `<section class="footnotes" role="doc-endnotes">\n<hr />\n<ol>\n${footnote}</ol>\n</section>\n`
  }

  footnoteItem (content: string, { footnoteId, footnoteIdentifierId }: FootnoteInfo): string {
    return `<li id="fn${footnoteId}" role="doc-endnote">${content}<a href="#${footnoteIdentifierId ? `fnref${footnoteIdentifierId}` : ''}" class="footnote-back" role="doc-backlink">↩︎</a></li>`
  }

  code (code: string, infostring = '', escaped = false, codeBlockStyle = 'fenced'): string {
    const lang = (infostring || '').match(/\S*/)?.[0] || ''
    if (this.options.highlight) {
      const out = this.options.highlight(code, lang)
      if (out !== null && out !== code) {
        escaped = true
        code = out
      }
    }

    let className = codeBlockStyle === 'fenced' ? 'fenced-code-block' : 'indented-code-block'
    className = lang ? `${className} ${this.options.langPrefix}${escape(lang, true)}` : className

    return `<pre><code class="${className}">${escaped ? code : escape(code, true)}</code></pre>\n`
  }

  blockquote (quote: string): string {
    return `<blockquote>\n${quote}</blockquote>\n`
  }

  html (html: string): string {
    return html
  }

  heading (text: string, level: number, raw: string, slugger: { slug(value: string): string }, headingStyle: string): string {
    if (this.options.headerIds) {
      return `<h${level} id="${this.options.headerPrefix}${slugger.slug(raw)}" class="${headingStyle}">${text}</h${level}>\n`
    }
    return `<h${level}>${text}</h${level}>\n`
  }

  hr (): string {
    return this.options.xhtml ? '<hr/>\n' : '<hr>\n'
  }

  list (body: string, ordered: boolean, start: number, _taskList: boolean): string {
    const type = ordered ? 'ol' : 'ul'
    const startatt = (ordered && start !== 1) ? ` start="${start}"` : ''
    return `<${type}${startatt}>\n${body}</${type}>\n`
  }

  listitem (text: string, checked?: boolean): string {
    if (checked === undefined) {
      return `<li>${text}</li>\n`
    }

    return `<li class="task-list-item"><input type="checkbox"${checked ? ' checked=""' : ''} disabled=""${this.options.xhtml ? ' /' : ''}> ${text}</li>\n`
  }

  paragraph (text: string): string {
    return `<p>${text}</p>\n`
  }

  table (header: string, body: string): string {
    const tableBody = body ? `<tbody>${body}</tbody>` : ''
    return `<table>\n<thead>\n${header}</thead>\n${tableBody}</table>\n`
  }

  tablerow (content: string): string {
    return `<tr>\n${content}</tr>\n`
  }

  tablecell (content: string, flags: TableCellFlags): string {
    const type = flags.header ? 'th' : 'td'
    const tag = flags.align
      ? `<${type} align="${flags.align}">`
      : `<${type}>`
    return `${tag}${content}</${type}>\n`
  }

  strong (text: string): string {
    return `<strong>${text}</strong>`
  }

  em (text: string): string {
    return `<em>${text}</em>`
  }

  codespan (text: string): string {
    return `<code>${text}</code>`
  }

  br (): string {
    return this.options.xhtml ? '<br/>' : '<br>'
  }

  del (text: string): string {
    return `<del>${text}</del>`
  }

  link (href: string, title: string | null, text: string): string {
    const nextHref = cleanUrl(this.options.sanitize, this.options.baseUrl, href)
    if (nextHref === null) {
      return text
    }
    let out = `<a href="${escape(nextHref)}"`
    if (title) {
      out += ` title="${title}"`
    }
    out += `>${text}</a>`
    return out
  }

  image (href: string, title: string | null, text: string): string {
    if (!href) {
      return text
    }

    let nextHref = href
    if (/^(?:[a-zA-Z]:\\|[a-zA-Z]:\/).+/.test(nextHref)) {
      nextHref = 'file:///' + nextHref.replace(/\\/g, '/')
    } else if (/^\\\?\\.+/.test(nextHref)) {
      nextHref = 'file:///' + nextHref.substring(3).replace(/\\/g, '/')
    } else if (/^\/.+/.test(nextHref)) {
      nextHref = 'file://' + nextHref
    }

    nextHref = cleanUrl(this.options.sanitize, this.options.baseUrl, nextHref) ?? ''
    if (!nextHref) {
      return text
    }

    let out = `<img src="${nextHref}" alt="${text.replace(/\*/g, '')}"`
    if (title) {
      out += ` title="${title}"`
    }
    out += this.options.xhtml ? '/>' : '>'
    return out
  }

  text (text: string): string {
    return text
  }

  toc (): string {
    if (this.options.tocRenderer) {
      return this.options.tocRenderer()
    }
    return ''
  }
}

export default Renderer
