import { normal, gfm, pedantic } from './blockRules'
import options, { type MarkedOptions } from './options'
import { splitCells, rtrim, getUniqueId } from './utils'

type LexerInputOptions = Partial<MarkedOptions> | null | undefined
type BlockRuleSet = typeof normal

interface LinkDefinition {
  href: string
  title?: string
}

interface FootnoteDefinition {
  order: number
  identifier: string
  footnoteId: number
}

interface BaseToken {
  type: string
}

interface FrontmatterToken extends BaseToken {
  type: 'frontmatter'
  text: string
  style?: string
  lang?: string
}

interface SpaceToken extends BaseToken {
  type: 'space'
}

interface CodeToken extends BaseToken {
  type: 'code'
  codeBlockStyle: 'indented' | 'fenced'
  text: string
  lang?: string
}

interface MultipleMathToken extends BaseToken {
  type: 'multiplemath'
  text: string
  mathStyle: '' | 'gitlab'
}

interface HeadingToken extends BaseToken {
  type: 'heading'
  headingStyle: 'atx' | 'setext'
  depth: number
  text: string
  marker?: string
}

interface TableToken extends BaseToken {
  type: 'table'
  header: string[]
  align: Array<'left' | 'right' | 'center' | null>
  cells: string[][]
}

interface HrToken extends BaseToken {
  type: 'hr'
  marker: string
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
  listType: 'order' | 'task' | 'bullet'
  start: number | ''
}

interface ListEndToken extends BaseToken {
  type: 'list_end'
}

interface ListItemStartToken extends BaseToken {
  type: 'list_item_start'
  checked?: boolean
  listItemType: 'order' | 'task' | 'bullet'
  bulletMarkerOrDelimiter: string
}

interface LooseItemStartToken extends BaseToken {
  type: 'loose_item_start'
  checked?: boolean
  listItemType: 'order' | 'task' | 'bullet'
  bulletMarkerOrDelimiter: string
}

interface ListItemEndToken extends BaseToken {
  type: 'list_item_end'
}

interface HtmlToken extends BaseToken {
  type: 'html'
  text: string
  pre?: boolean
}

interface ParagraphToken extends BaseToken {
  type: 'paragraph'
  text: string
  pre?: boolean
}

interface TextToken extends BaseToken {
  type: 'text'
  text: string
}

interface TocToken extends BaseToken {
  type: 'toc'
  text: '[TOC]'
}

type LexerToken =
  | FrontmatterToken
  | SpaceToken
  | CodeToken
  | MultipleMathToken
  | HeadingToken
  | TableToken
  | HrToken
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

type LinksMap = Record<string, LinkDefinition>
type FootnotesMap = Record<string, FootnoteDefinition>
type TokenList = LexerToken[] & { links: LinksMap, footnotes: FootnotesMap }

interface LexerInstance {
  tokens: TokenList
  footnoteOrder: number
  options: MarkedOptions
  rules: BlockRuleSet
  checkFrontmatter: boolean
  lex(src: string): TokenList
  token(src: string, top: boolean): void
}

type LexerConstructor = {
  new (opts?: LexerInputOptions): LexerInstance
  prototype: LexerInstance
}

type ExecutableRule = {
  exec: (src: string) => RegExpExecArray | null | void
}

const execRule = (rule: unknown, src: string): RegExpExecArray | null => {
  const match = (rule as ExecutableRule).exec(src)
  return Array.isArray(match) ? match : null
}

const splitCellsWithOptionalCount = splitCells as unknown as (tableRow: string, count?: number) => string[]

const isParagraphToken = (token: LexerToken | undefined): token is ParagraphToken => {
  return token?.type === 'paragraph'
}

const Lexer = function Lexer (this: LexerInstance, opts?: LexerInputOptions) {
  this.tokens = [] as unknown as TokenList
  this.tokens.links = Object.create(null) as LinksMap
  this.tokens.footnotes = Object.create(null) as FootnotesMap
  this.footnoteOrder = 0
  this.options = Object.assign({}, options, opts) as MarkedOptions
  this.rules = normal

  if (this.options.pedantic) {
    this.rules = pedantic
  } else if (this.options.gfm) {
    this.rules = gfm
  }
} as unknown as LexerConstructor

Lexer.prototype.lex = function (this: LexerInstance, src: string): TokenList {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
  this.checkFrontmatter = true
  this.footnoteOrder = 0
  this.token(src, true)

  // Move footnote token to the end of tokens.
  const { tokens } = this
  const hasNoFootnoteTokens: LexerToken[] = []
  const footnoteTokens: LexerToken[] = []
  let isInFootnote = false
  for (const token of tokens) {
    const { type } = token
    if (type === 'footnote_start') {
      isInFootnote = true
      footnoteTokens.push(token)
    } else if (type === 'footnote_end') {
      isInFootnote = false
      footnoteTokens.push(token)
    } else if (isInFootnote) {
      footnoteTokens.push(token)
    } else {
      hasNoFootnoteTokens.push(token)
    }
  }

  const result = [...hasNoFootnoteTokens, ...footnoteTokens] as TokenList
  result.links = tokens.links
  result.footnotes = tokens.footnotes
  return result
}

Lexer.prototype.token = function (this: LexerInstance, src: string, top: boolean): void {
  const {
    footnote,
    frontMatter,
    isGitlabCompatibilityEnabled,
    math
  } = this.options
  src = src.replace(/^ +$/gm, '')

  let loose = false
  let bull = ''
  let space = 0

  // Only check front matter at the begining of a markdown file.
  // Please see note in "blockquote" why we need "checkFrontmatter" and "top".
  if (frontMatter) {
    const frontmatterMatch = execRule(this.rules.frontmatter, src)
    if (this.checkFrontmatter && top && frontmatterMatch) {
      src = src.substring(frontmatterMatch[0].length)
      let lang: string | undefined
      let style: string | undefined
      let text = ''
      if (frontmatterMatch[1]) {
        lang = 'yaml'
        style = '-'
        text = frontmatterMatch[1]
      } else if (frontmatterMatch[2]) {
        lang = 'toml'
        style = '+'
        text = frontmatterMatch[2]
      } else if (frontmatterMatch[3] || frontmatterMatch[4]) {
        lang = 'json'
        style = frontmatterMatch[3] ? ';' : '{'
        text = frontmatterMatch[3] || frontmatterMatch[4]
      }
      this.tokens.push({
        type: 'frontmatter',
        text,
        style,
        lang
      })
    }
    this.checkFrontmatter = false
  }

  while (src) {
    // newline
    const newlineMatch = execRule(this.rules.newline, src)
    if (newlineMatch) {
      src = src.substring(newlineMatch[0].length)
      if (newlineMatch[0].length > 1) {
        this.tokens.push({
          type: 'space'
        })
      }
    }

    // code
    // An indented code block cannot interrupt a paragraph.
    const codeMatch = execRule(this.rules.code, src)
    if (codeMatch) {
      const lastToken = this.tokens[this.tokens.length - 1]
      src = src.substring(codeMatch[0].length)
      if (isParagraphToken(lastToken)) {
        lastToken.text += `\n${codeMatch[0].trimRight()}`
      } else {
        const code = codeMatch[0].replace(/^ {4}/gm, '')
        this.tokens.push({
          type: 'code',
          codeBlockStyle: 'indented',
          text: !this.options.pedantic
            ? rtrim(code, '\n')
            : code
        })
      }
      continue
    }

    // multiple line math
    if (math) {
      const multipleMathMatch = execRule(this.rules.multiplemath, src)
      if (multipleMathMatch) {
        src = src.substring(multipleMathMatch[0].length)
        this.tokens.push({
          type: 'multiplemath',
          text: multipleMathMatch[1],
          mathStyle: ''
        })
        continue
      }

      // match GitLab display math blocks (```math)
      if (isGitlabCompatibilityEnabled) {
        const gitlabMathMatch = execRule(this.rules.multiplemathGitlab, src)
        if (gitlabMathMatch) {
          src = src.substring(gitlabMathMatch[0].length)
          this.tokens.push({
            type: 'multiplemath',
            text: gitlabMathMatch[2] || '',
            mathStyle: 'gitlab'
          })
          continue
        }
      }
    }

    // footnote
    if (footnote) {
      const footnoteMatch = execRule(this.rules.footnote, src)
      if (top && footnoteMatch) {
        src = src.substring(footnoteMatch[0].length)
        const identifier = footnoteMatch[1]
        this.tokens.push({
          type: 'footnote_start',
          identifier
        })

        // NOTE: Order is wrong if footnote identifier 1 is behind footnote identifier 2 in text.
        this.tokens.footnotes[identifier] = {
          order: ++this.footnoteOrder,
          identifier,
          footnoteId: getUniqueId()
        }

        /* eslint-disable no-useless-escape */
        // Remove the footnote identifer prefix. eg: `[^identifier]: `.
        let footnoteSrc = footnoteMatch[0].replace(/^\[\^[^\^\[\]\s]+?(?<!\\)\]:\s*/gm, '')
        // Remove the four whitespace before each block of footnote.
        footnoteSrc = footnoteSrc.replace(/\n {4}(?=[^\s])/g, '\n')
        /* eslint-enable no-useless-escape */

        this.token(footnoteSrc, top)

        this.tokens.push({
          type: 'footnote_end'
        })

        continue
      }
    }

    // fences
    const fencesMatch = execRule(this.rules.fences, src)
    if (fencesMatch) {
      src = src.substring(fencesMatch[0].length)
      const raw = fencesMatch[0]
      const text = indentCodeCompensation(raw, fencesMatch[3] || '')
      this.tokens.push({
        type: 'code',
        codeBlockStyle: 'fenced',
        lang: fencesMatch[2] ? fencesMatch[2].trim() : fencesMatch[2],
        text
      })
      continue
    }

    // heading
    const headingMatch = execRule(this.rules.heading, src)
    if (headingMatch) {
      src = src.substring(headingMatch[0].length)
      let text = headingMatch[2] ? headingMatch[2].trim() : ''

      if (text.endsWith('#')) {
        const trimmed = rtrim(text, '#')

        if (this.options.pedantic) {
          text = trimmed.trim()
        } else if (!trimmed || trimmed.endsWith(' ')) {
          // CommonMark requires space before trailing #s
          text = trimmed.trim()
        }
      }

      this.tokens.push({
        type: 'heading',
        headingStyle: 'atx',
        depth: headingMatch[1].length,
        text
      })
      continue
    }

    // table no leading pipe (gfm)
    const noLeadingPipeTableMatch = execRule(this.rules.nptable, src)
    if (noLeadingPipeTableMatch) {
      const tableToken: TableToken = {
        type: 'table',
        header: splitCellsWithOptionalCount(noLeadingPipeTableMatch[1].replace(/^ *| *\| *$/g, '')),
        align: noLeadingPipeTableMatch[2].replace(/^ *|\| *$/g, '').split(/ *\| */) as Array<'left' | 'right' | 'center' | null>,
        cells: (noLeadingPipeTableMatch[3] ? noLeadingPipeTableMatch[3].replace(/\n$/, '').split('\n') : []) as unknown as string[][]
      }

      if (tableToken.header.length === tableToken.align.length) {
        src = src.substring(noLeadingPipeTableMatch[0].length)

        for (let i = 0; i < tableToken.align.length; i++) {
          if (/^ *-+: *$/.test(tableToken.align[i] || '')) {
            tableToken.align[i] = 'right'
          } else if (/^ *:-+: *$/.test(tableToken.align[i] || '')) {
            tableToken.align[i] = 'center'
          } else if (/^ *:-+ *$/.test(tableToken.align[i] || '')) {
            tableToken.align[i] = 'left'
          } else {
            tableToken.align[i] = null
          }
        }

        for (let i = 0; i < tableToken.cells.length; i++) {
          tableToken.cells[i] = splitCellsWithOptionalCount(tableToken.cells[i] as unknown as string, tableToken.header.length)
        }

        this.tokens.push(tableToken)

        continue
      }
    }

    // hr
    const hrMatch = execRule(this.rules.hr, src)
    if (hrMatch) {
      const marker = hrMatch[0].replace(/\n*$/, '')
      src = src.substring(hrMatch[0].length)
      this.tokens.push({
        type: 'hr',
        marker
      })
      continue
    }

    // blockquote
    const blockquoteMatch = execRule(this.rules.blockquote, src)
    if (blockquoteMatch) {
      src = src.substring(blockquoteMatch[0].length)

      this.tokens.push({
        type: 'blockquote_start'
      })

      const blockquoteBody = blockquoteMatch[0].replace(/^ *> ?/gm, '')

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(blockquoteBody, top)

      this.tokens.push({
        type: 'blockquote_end'
      })

      continue
    }

    // NOTE: Complete list lexer part is a custom implementation based on an older marked.js version.

    // list
    const listMatch = execRule(this.rules.list, src)
    if (listMatch) {
      src = src.substring(listMatch[0].length)
      bull = listMatch[2]
      let isOrdered = bull.length > 1
      this.tokens.push({
        type: 'list_start',
        ordered: isOrdered,
        listType: bull.length > 1 ? 'order' : (/^( {0,3})([-*+]) \[[xX ]\]/.test(listMatch[0]) ? 'task' : 'bullet'),
        start: isOrdered ? +(bull.slice(0, -1)) : ''
      })

      let next = false
      let prevNext = true
      let listItemIndices: number[] = []
      let isTaskList = false

      // Get each top-level item.
      const listItems = listMatch[0].match(this.rules.item as RegExp) || []
      const length = listItems.length

      for (let i = 0; i < length; i++) {
        const itemWithBullet = listItems[i]
        let listItem = itemWithBullet
        let newIsTaskListItem = false

        // Remove the list item's bullet so it is seen as the next token.
        space = listItem.length
        let newBull = bull
        listItem = listItem.replace(/^ *([*+-]|\d+(?:\.|\))) {0,4}/, (_match, bulletMarker: string) => {
          // Get and remove list item bullet
          newBull = bulletMarker || bull
          return ''
        })

        const newIsOrdered = bull.length > 1 && /\d{1,9}/.test(newBull)
        let checked: boolean | undefined
        if (!newIsOrdered && this.options.gfm) {
          const checkedMatch = execRule(this.rules.checkbox, listItem)
          if (checkedMatch) {
            checked = checkedMatch[1] === 'x' || checkedMatch[1] === 'X'
            newIsTaskListItem = true

            // Remove the list item's checkbox and adjust indentation by removing checkbox length.
            listItem = listItem.replace(this.rules.checkbox, '')
            space -= 4
          } else {
            checked = undefined
          }
        }

        if (i === 0) {
          isTaskList = newIsTaskListItem
        } else if (
          // Changing the bullet or ordered list delimiter starts a new list (CommonMark 264 and 265)
          //   - unordered, unordered --> bull !== newBull --> new list (e.g "-" --> "*")
          //   - ordered, ordered --> lastChar !== lastChar --> new list (e.g "." --> ")")
          //   - else --> new list (e.g. ordered --> unordered)
          i !== 0 &&
          (
            (!isOrdered && !newIsOrdered && bull !== newBull) ||
            (isOrdered && newIsOrdered && bull.slice(-1) !== newBull.slice(-1)) ||
            (isOrdered !== newIsOrdered) ||
            // Changing to/from task list item from/to bullet, starts a new list(work for marktext issue #870)
            // Because we distinguish between task list and bullet list in MarkText,
            // the parsing here is somewhat different from the commonmark Spec,
            // and the task list needs to be a separate list.
            (isTaskList !== newIsTaskListItem)
          )
        ) {
          this.tokens.push({
            type: 'list_end'
          })

          // Start a new list
          bull = newBull
          isOrdered = newIsOrdered
          isTaskList = newIsTaskListItem
          this.tokens.push({
            type: 'list_start',
            ordered: isOrdered,
            listType: bull.length > 1 ? 'order' : (/^( {0,3})([-*+]) \[[xX ]\]/.test(itemWithBullet) ? 'task' : 'bullet'),
            start: isOrdered ? +(bull.slice(0, -1)) : ''
          })
        }

        // Outdent whatever the
        // list item contains. Hacky.
        if (~listItem.indexOf('\n ')) {
          space -= listItem.length
          listItem = !this.options.pedantic
            ? listItem.replace(new RegExp(`^ {1,${space}}`, 'gm'), '')
            : listItem.replace(/^ {1,4}/gm, '')
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (i !== length - 1) {
          const nextBullet = execRule(this.rules.bullet, listItems[i + 1])?.[0] || ''
          if (bull.length > 1
            ? nextBullet.length === 1
            : (nextBullet.length > 1 || (this.options.smartLists && nextBullet !== bull))) {
            src = listItems.slice(i + 1).join('\n') + src
            i = length - 1
          }
        }

        const prevItem = i === 0 ? listItem : listItems[i - 1]

        // Determine whether item is loose or not. If previous item is loose
        // this item is also loose.
        // A list is loose if any of its constituent list items are separated by blank lines,
        // or if any of its constituent list items directly contain two block-level elements with a blank line between them.
        // loose = next = next || /^ *([*+-]|\d{1,9}(?:\.|\)))( +\S+\n\n(?!\s*$)|\n\n(?!\s*$))/.test(itemWithBullet)
        loose = next = next || /\n\n(?!\s*$)/.test(listItem)
        // Check if previous line ends with a new line.
        if (!loose && (i !== 0 || length > 1) && prevItem.length !== 0 && prevItem.charAt(prevItem.length - 1) === '\n') {
          loose = next = true
        }

        // A list is either loose or tight, so update previous list items but not nested list items.
        if (next && prevNext !== next) {
          for (const index of listItemIndices) {
            const token = this.tokens[index] as ListItemStartToken | LooseItemStartToken
            if (token.type === 'list_item_start') {
              const looseToken = token as ListItemStartToken | LooseItemStartToken
              looseToken.type = 'loose_item_start'
            }
          }
          listItemIndices = []
        }
        prevNext = next

        if (!loose) {
          listItemIndices.push(this.tokens.length)
        }

        const isOrderedListItem = /\d/.test(bull)
        this.tokens.push({
          checked,
          listItemType: bull.length > 1 ? 'order' : (isTaskList ? 'task' : 'bullet'),
          bulletMarkerOrDelimiter: isOrderedListItem ? bull.slice(-1) : bull.charAt(0),
          type: loose ? 'loose_item_start' : 'list_item_start'
        })

        if (/^\s*$/.test(listItem)) {
          this.tokens.push({
            type: 'text',
            text: ''
          })
        } else {
          // Recurse.
          this.token(listItem, false)
        }

        this.tokens.push({
          type: 'list_item_end'
        })
      }

      this.tokens.push({
        type: 'list_end'
      })
      continue
    }

    // html
    const htmlMatch = execRule(this.rules.html, src)
    if (htmlMatch) {
      src = src.substring(htmlMatch[0].length)
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: !this.options.sanitizer &&
          (htmlMatch[1] === 'pre' || htmlMatch[1] === 'script' || htmlMatch[1] === 'style'),
        text: this.options.sanitize ? (this.options.sanitizer ? this.options.sanitizer(htmlMatch[0]) : escape(htmlMatch[0])) : htmlMatch[0]
      })
      continue
    }

    // def
    let defMatch = execRule(this.rules.def, src)
    if (top && defMatch) {
      let text = ''
      do {
        src = src.substring(defMatch[0].length)
        if (defMatch[3]) defMatch[3] = defMatch[3].substring(1, defMatch[3].length - 1)
        const tag = defMatch[1].toLowerCase().replace(/\s+/g, ' ')
        if (!this.tokens.links[tag]) {
          this.tokens.links[tag] = {
            href: defMatch[2],
            title: defMatch[3]
          }
        }

        text += defMatch[0]
        if (defMatch[0].endsWith('\n\n')) break
        defMatch = execRule(this.rules.def, src)
      } while (defMatch)

      if (this.options.disableInline) {
        this.tokens.push({
          type: 'paragraph',
          text: text.replace(/\n*$/, '')
        })
      }
      continue
    }

    // table (gfm)
    const tableMatch = execRule(this.rules.table, src)
    if (tableMatch) {
      const tableToken: TableToken = {
        type: 'table',
        header: splitCellsWithOptionalCount(tableMatch[1].replace(/^ *| *\| *$/g, '')),
        align: tableMatch[2].replace(/^ *|\| *$/g, '').split(/ *\| */) as Array<'left' | 'right' | 'center' | null>,
        cells: (tableMatch[3] ? tableMatch[3].replace(/\n$/, '').split('\n') : []) as unknown as string[][]
      }

      if (tableToken.header.length === tableToken.align.length) {
        src = src.substring(tableMatch[0].length)

        for (let i = 0; i < tableToken.align.length; i++) {
          if (/^ *-+: *$/.test(tableToken.align[i] || '')) {
            tableToken.align[i] = 'right'
          } else if (/^ *:-+: *$/.test(tableToken.align[i] || '')) {
            tableToken.align[i] = 'center'
          } else if (/^ *:-+ *$/.test(tableToken.align[i] || '')) {
            tableToken.align[i] = 'left'
          } else {
            tableToken.align[i] = null
          }
        }

        for (let i = 0; i < tableToken.cells.length; i++) {
          tableToken.cells[i] = splitCellsWithOptionalCount(
            (tableToken.cells[i] as unknown as string).replace(/^ *\| *| *\| *$/g, ''),
            tableToken.header.length)
        }

        this.tokens.push(tableToken)

        continue
      }
    }

    // lheading
    const lheadingMatch = execRule(this.rules.lheading, src)
    if (lheadingMatch) {
      const precededToken = this.tokens[this.tokens.length - 1]
      const chops = lheadingMatch[0].trim().split(/\n/)
      const marker = chops[chops.length - 1]
      src = src.substring(lheadingMatch[0].length)

      if (isParagraphToken(precededToken)) {
        this.tokens.pop()
        this.tokens.push({
          type: 'heading',
          headingStyle: 'setext',
          depth: lheadingMatch[2].charAt(0) === '=' ? 1 : 2,
          text: precededToken.text + '\n' + lheadingMatch[1],
          marker
        })
      } else {
        this.tokens.push({
          type: 'heading',
          headingStyle: 'setext',
          depth: lheadingMatch[2].charAt(0) === '=' ? 1 : 2,
          text: lheadingMatch[1],
          marker
        })
      }
      continue
    }

    // top-level paragraph
    const paragraphMatch = execRule(this.rules.paragraph, src)
    if (top && paragraphMatch) {
      src = src.substring(paragraphMatch[0].length)

      if (/^\[toc\]\n?$/i.test(paragraphMatch[1])) {
        this.tokens.push({ type: 'toc', text: '[TOC]' })
        continue
      }

      this.tokens.push({
        type: 'paragraph',
        text: paragraphMatch[1].charAt(paragraphMatch[1].length - 1) === '\n'
          ? paragraphMatch[1].slice(0, -1)
          : paragraphMatch[1]
      })
      continue
    }

    // text
    const textMatch = execRule(this.rules.text, src)
    if (textMatch) {
      // Top-level should never reach here.
      src = src.substring(textMatch[0].length)
      this.tokens.push({
        type: 'text',
        text: textMatch[0]
      })
      continue
    }

    if (src) {
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }
}

function indentCodeCompensation (raw: string, text: string): string {
  const matchIndentToCode = raw.match(/^(\s+)(?:```)/)

  if (matchIndentToCode === null) {
    return text
  }

  const indentToCode = matchIndentToCode[1]

  return text
    .split('\n')
    .map(node => {
      const matchIndentInNode = node.match(/^\s+/)
      if (matchIndentInNode === null) {
        return node
      }

      const [indentInNode] = matchIndentInNode

      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length)
      }

      return node
    })
    .join('\n')
}

export default Lexer
