import Renderer from './renderer'
import InlineLexer from './inlineLexer'
import Slugger from './slugger'
import TextRenderer from './textRenderer'
import defaultOptions, { type MarkedOptions } from './options'

interface FootnoteInfo {
  footnoteId?: string | number | null
  footnoteIdentifierId?: string | number | null
  order?: string | number
}

interface ParserRenderer {
  options: unknown
  frontmatter(text: string): string
  hr(): string
  heading(text: string, level: number, raw: string, slugger: Slugger, headingStyle: string): string
  multiplemath(text: string): string
  code(text: string, lang: string | undefined, escaped: boolean | undefined, codeBlockStyle: string): string
  tablecell(content: string, flags: { header: boolean, align: string | null | undefined }): string
  tablerow(content: string): string
  table(header: string, body: string): string
  blockquote(quote: string): string
  footnoteItem(content: string, info: FootnoteInfo): string
  footnote(footnote: string): string
  list(body: string, ordered: boolean, start: number | '', taskList: boolean): string
  listitem(text: string, checked?: boolean): string
  html(html: string): string
  paragraph(text: string): string
  toc(): string
}

type ParserLinks = Record<string, unknown>
type ParserFootnotes = Record<string, FootnoteInfo>
type ParserInputOptions = Partial<MarkedOptions> & { renderer?: ParserRenderer | null }
type ParserOptions = MarkedOptions & { renderer: ParserRenderer }

interface InlineLexerInstance {
  output(src: string): string
}

type InlineLexerConstructor = new (
  links: ParserLinks,
  footnotes: ParserFootnotes,
  options: MarkedOptions & { renderer?: unknown }
) => InlineLexerInstance

interface BaseToken {
  type: string
}

interface FrontmatterToken extends BaseToken {
  type: 'frontmatter'
  text: string
}

interface SpaceToken extends BaseToken {
  type: 'space'
}

interface HrToken extends BaseToken {
  type: 'hr'
}

interface HeadingToken extends BaseToken {
  type: 'heading'
  text: string
  depth: number
  headingStyle: string
}

interface MultipleMathToken extends BaseToken {
  type: 'multiplemath'
  text: string
}

interface CodeToken extends BaseToken {
  type: 'code'
  codeBlockStyle: string
  text: string
  lang?: string
  escaped?: boolean
}

interface TableToken extends BaseToken {
  type: 'table'
  header: string[]
  align: Array<string | null>
  cells: string[][]
}

interface BlockquoteStartToken extends BaseToken {
  type: 'blockquote_start'
}

interface BlockquoteEndToken extends BaseToken {
  type: 'blockquote_end'
}

interface FootnoteStartToken extends BaseToken {
  type: 'footnote_start'
  identifier: string
}

interface FootnoteEndToken extends BaseToken {
  type: 'footnote_end'
}

interface ListStartToken extends BaseToken {
  type: 'list_start'
  ordered: boolean
  start: number | ''
}

interface ListEndToken extends BaseToken {
  type: 'list_end'
}

interface ListItemStartToken extends BaseToken {
  type: 'list_item_start'
  checked?: boolean
}

interface LooseItemStartToken extends BaseToken {
  type: 'loose_item_start'
  checked?: boolean
}

interface ListItemEndToken extends BaseToken {
  type: 'list_item_end'
}

interface HtmlToken extends BaseToken {
  type: 'html'
  text: string
}

interface ParagraphToken extends BaseToken {
  type: 'paragraph'
  text: string
}

interface TextToken extends BaseToken {
  type: 'text'
  text: string
}

interface TocToken extends BaseToken {
  type: 'toc'
}

type ParserToken =
  | FrontmatterToken
  | SpaceToken
  | HrToken
  | HeadingToken
  | MultipleMathToken
  | CodeToken
  | TableToken
  | BlockquoteStartToken
  | BlockquoteEndToken
  | FootnoteStartToken
  | FootnoteEndToken
  | ListStartToken
  | ListEndToken
  | ListItemStartToken
  | LooseItemStartToken
  | ListItemEndToken
  | HtmlToken
  | ParagraphToken
  | TextToken
  | TocToken

interface TokenListLike extends Array<ParserToken> {
  links?: ParserLinks
  footnotes?: ParserFootnotes
}

const InlineLexerCtor = InlineLexer as unknown as InlineLexerConstructor

const isTaskItemToken = (token: ParserToken | null): token is ListItemStartToken | LooseItemStartToken => {
  return token?.type === 'list_item_start' || token?.type === 'loose_item_start'
}

const createTextRendererOptions = (options: ParserOptions): MarkedOptions & { renderer: TextRenderer } => {
  return Object.assign({}, options, { renderer: new TextRenderer() }) as MarkedOptions & { renderer: TextRenderer }
}

class Parser {
  public tokens: ParserToken[]
  public token: ParserToken | null
  public footnotes: ParserFootnotes | null
  public footnoteIdentifier: string
  public options: ParserOptions
  public renderer: ParserRenderer
  public slugger: Slugger
  public inline!: InlineLexerInstance
  public inlineText!: InlineLexerInstance

  constructor (options?: ParserInputOptions | null) {
    const parserOptions = (options || defaultOptions) as ParserInputOptions

    this.tokens = []
    this.token = null
    this.footnotes = null
    this.footnoteIdentifier = ''
    parserOptions.renderer = parserOptions.renderer || new Renderer()
    this.options = parserOptions as ParserOptions
    this.renderer = this.options.renderer
    this.renderer.options = this.options
    this.slugger = new Slugger()
  }

  parse (src: TokenListLike): string {
    const links = src.links as ParserLinks
    const footnotes = src.footnotes as ParserFootnotes

    this.inline = new InlineLexerCtor(links, footnotes, this.options)
    // use an InlineLexer with a TextRenderer to extract pure text
    this.inlineText = new InlineLexerCtor(links, footnotes, createTextRendererOptions(this.options))
    this.tokens = src.reverse()
    this.footnotes = footnotes

    let out = ''
    while (this.next()) {
      out += this.tok()
    }

    return out
  }

  next (): ParserToken | null {
    this.token = this.tokens.pop() ?? null
    return this.token
  }

  peek (): ParserToken | undefined {
    return this.tokens[this.tokens.length - 1]
  }

  parseText (): string {
    let body = (this.token as TextToken).text

    while (this.peek()?.type === 'text') {
      body += '\n' + (this.next() as TextToken).text
    }

    return this.inline.output(body)
  }

  tok (): string {
    const token = this.token as ParserToken

    switch (token.type) {
      case 'frontmatter': {
        return this.renderer.frontmatter(token.text)
      }
      case 'space': {
        return ''
      }
      case 'hr': {
        return this.renderer.hr()
      }
      case 'heading': {
        return this.renderer.heading(
          this.inline.output(token.text),
          token.depth,
          unescape(this.inlineText.output(token.text)),
          this.slugger,
          token.headingStyle
        )
      }
      case 'multiplemath': {
        return this.renderer.multiplemath(token.text)
      }
      case 'code': {
        return this.renderer.code(token.text, token.lang, token.escaped, token.codeBlockStyle)
      }
      case 'table': {
        let header = ''
        let body = ''

        // header
        let cell = ''
        for (let i = 0; i < token.header.length; i++) {
          cell += this.renderer.tablecell(this.inline.output(token.header[i]), {
            header: true,
            align: token.align[i]
          })
        }
        header += this.renderer.tablerow(cell)

        for (const row of token.cells) {
          cell = ''
          for (let j = 0; j < row.length; j++) {
            cell += this.renderer.tablecell(this.inline.output(row[j]), {
              header: false,
              align: token.align[j]
            })
          }

          body += this.renderer.tablerow(cell)
        }
        return this.renderer.table(header, body)
      }
      case 'blockquote_start': {
        let body = ''

        while ((this.next() as ParserToken).type !== 'blockquote_end') {
          body += this.tok()
        }

        return this.renderer.blockquote(body)
      }
      // All the tokens will be footnotes if it after a footnote_start token. Because we put all footnote token at the end.
      case 'footnote_start': {
        let body = ''
        let itemBody = ''

        this.footnoteIdentifier = token.identifier
        while (this.next()) {
          if (this.token?.type === 'footnote_end') {
            const footnoteInfo = (this.footnotes as ParserFootnotes)[this.footnoteIdentifier] as FootnoteInfo
            body += this.renderer.footnoteItem(itemBody, footnoteInfo)
            this.footnoteIdentifier = ''
            itemBody = ''
          } else if (this.token?.type === 'footnote_start') {
            this.footnoteIdentifier = this.token.identifier
            itemBody = ''
          } else {
            itemBody += this.tok()
          }
        }
        return this.renderer.footnote(body)
      }
      case 'list_start': {
        let body = ''
        let taskList = false
        const { ordered, start } = token

        while ((this.next() as ParserToken).type !== 'list_end') {
          if (isTaskItemToken(this.token) && this.token.checked !== undefined) {
            taskList = true
          }

          body += this.tok()
        }

        return this.renderer.list(body, ordered, start, taskList)
      }
      case 'list_item_start': {
        let body = ''
        const { checked } = token

        while ((this.next() as ParserToken).type !== 'list_item_end') {
          body += this.token?.type === 'text' ? this.parseText() : this.tok()
        }

        return this.renderer.listitem(body, checked)
      }
      case 'loose_item_start': {
        let body = ''
        const { checked } = token

        while ((this.next() as ParserToken).type !== 'list_item_end') {
          body += this.tok()
        }

        return this.renderer.listitem(body, checked)
      }
      case 'html': {
        // TODO parse inline content if parameter markdown=1
        return this.renderer.html(token.text)
      }
      case 'paragraph': {
        return this.renderer.paragraph(this.inline.output(token.text))
      }
      case 'text': {
        return this.renderer.paragraph(this.parseText())
      }
      case 'toc': {
        return this.renderer.toc()
      }
      default: {
        const errMsg = `Token with "${token.type}" type was not found.`
        if (this.options.silent) {
          console.error(errMsg)
          return undefined as unknown as string
        }
        throw new Error(errMsg)
      }
    }
  }
}

export default Parser
