import execAll from 'execall'
import { defaultSearchOption } from '../config'

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  noHistory?: boolean
  start: CursorPosition
  end: CursorPosition
}

interface BlockLike {
  key: string
  text?: string
  children: BlockLike[]
}

interface SearchOptions {
  isCaseSensitive: boolean
  isWholeWord: boolean
  isRegexp: boolean
  selectHighlight: boolean
  highlightIndex: number
}

interface SearchOptionsInput extends Partial<SearchOptions> {
  isSingle?: boolean
}

interface ExecAllMatchLike {
  match: string
  subMatches: string[]
  index: number
}

interface SearchResultMatch extends ExecAllMatchLike {
  key: string
  start: number
  end: number
}

interface SearchCtrlMethods {
  buildRegexValue(match: SearchResultMatch, value: string): string
  replaceOne(match: SearchResultMatch, value: string): void
  replace(replaceValue: string, opt?: SearchOptionsInput): void
  setCursorToHighlight(): void
  find(action: string): void
  search(value: string, opt?: Partial<SearchOptions>): SearchResultMatch[]
}

interface ContentStateLike {
  blocks: BlockLike[]
  searchMatches: {
    value: string
    matches: SearchResultMatch[]
    index: number
  }
  cursor: CursorRangeLike
  getBlock(key: string): BlockLike
}

type ContentStateConstructor = {
  prototype: ContentStateLike & Partial<SearchCtrlMethods>
}

/* eslint-disable no-useless-escape */
const SPECIAL_CHAR_REG = /[\[\]\\^$.\|\?\*\+\(\)\/]{1}/g
/* eslint-enable no-useless-escape */

const baseSearchOption = defaultSearchOption as SearchOptions

const matchString = (text: string, value: string, options: SearchOptions): ExecAllMatchLike[] => {
  const { isCaseSensitive, isWholeWord, isRegexp } = options
  let searchReg: RegExp | null = null
  let regStr = value
  let flag = 'g'

  if (!isCaseSensitive) {
    flag += 'i'
  }

  if (!isRegexp) {
    regStr = value.replace(SPECIAL_CHAR_REG, (p: string) => {
      return p === '\\' ? '\\\\' : `\\${p}`
    })
  }

  if (isWholeWord) {
    regStr = `\\b${regStr}\\b`
  }

  try {
    // Add try catch expression because not all string can generate a valid RegExp. for example `\`.
    searchReg = new RegExp(regStr, flag)
    return execAll(searchReg, text) as ExecAllMatchLike[]
  } catch (_err) {
    return []
  }
}

const searchCtrl = (ContentState: ContentStateConstructor): void => {
  ContentState.prototype.buildRegexValue = function (match: SearchResultMatch, value: string): string {
    const groups = value.match(/(?<!\\)\$\d/g)

    if (Array.isArray(groups) && groups.length) {
      for (const group of groups) {
        const index = parseInt(group.replace(/^\$/, ''), 10)
        if (index === 0) {
          value = value.replace(group, match.match)
        } else if (index > 0 && index <= match.subMatches.length) {
          value = value.replace(group, match.subMatches[index - 1])
        }
      }
    }

    return value
  }

  ContentState.prototype.replaceOne = function (match: SearchResultMatch, value: string): void {
    const { start, end, key } = match
    const block = this.getBlock(key)
    const { text = '' } = block
    block.text = text.substring(0, start) + value + text.substring(end)
  }

  ContentState.prototype.replace = function (replaceValue: string, opt: SearchOptionsInput = { isSingle: true }): void {
    const self = this as ContentStateLike & SearchCtrlMethods
    const { isSingle, isRegexp } = opt
    delete opt.isSingle
    const searchOptions = Object.assign({}, baseSearchOption, opt) as SearchOptions
    const { matches, value, index } = self.searchMatches
    if (matches.length) {
      if (isRegexp) {
        replaceValue = self.buildRegexValue(matches[index] as SearchResultMatch, replaceValue)
      }
      if (isSingle) {
        // replace single
        self.replaceOne(matches[index] as SearchResultMatch, replaceValue)
      } else {
        // replace all
        for (const match of matches) {
          self.replaceOne(match, replaceValue)
        }
      }
      const highlightIndex = index < matches.length - 1 ? index : index - 1
      self.search(value, { ...searchOptions, highlightIndex: isSingle ? highlightIndex : -1 })
    }
  }

  ContentState.prototype.setCursorToHighlight = function (): void {
    const { matches, index } = this.searchMatches
    const match = matches[index]

    if (!match) return
    const { key, start, end } = match

    this.cursor = {
      noHistory: true,
      start: {
        key,
        offset: start
      },
      end: {
        key,
        offset: end
      }
    }
  }

  ContentState.prototype.find = function (action: string): void {
    const self = this as ContentStateLike & SearchCtrlMethods
    let { matches, index } = self.searchMatches
    const len = matches.length
    if (!len) return
    index = action === 'next' ? index + 1 : index - 1
    if (index < 0) index = len - 1
    if (index >= len) index = 0
    self.searchMatches.index = index

    self.setCursorToHighlight()
  }

  ContentState.prototype.search = function (value: string, opt = {}): SearchResultMatch[] {
    const self = this as ContentStateLike & SearchCtrlMethods
    const matches: SearchResultMatch[] = []
    const options = Object.assign({}, baseSearchOption, opt) as SearchOptions
    const { highlightIndex } = options
    const { blocks } = self

    const travel = (nestedBlocks: BlockLike[]): void => {
      for (const block of nestedBlocks) {
        const { text, key } = block

        if (text && typeof text === 'string') {
          const strMatches = matchString(text, value, options)
          matches.push(...strMatches.map(({ index, match, subMatches }) => {
            return {
              key,
              index,
              start: index,
              end: index + match.length,
              match,
              subMatches
            } as SearchResultMatch
          }))
        }
        if (block.children.length) {
          travel(block.children)
        }
      }
    }

    if (value) travel(blocks)
    let index = -1
    if (highlightIndex !== -1) {
      index = highlightIndex // If set the highlight index, then highlight the highlighIndex
    } else if (matches.length) {
      index = 0 // highlight the first word that matches.
    }
    Object.assign(self.searchMatches, { value, matches, index })
    if (value) {
      self.setCursorToHighlight()
    }
    return matches
  }
}

export default searchCtrl
