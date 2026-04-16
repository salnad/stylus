import { filter } from 'fuzzaldrin'
import emojis from './emojisJson.json'
import { CLASS_OR_ID } from '../../config'

interface EmojiEntry {
  aliases: string[]
  tags: string[]
  category: string
  [key: string]: unknown
}

interface SearchableEmojiEntry extends EmojiEntry {
  search: string
}

type EmojiSearchMap = Record<string, SearchableEmojiEntry[]>

const emojisForSearch: EmojiSearchMap = {}

for (const emoji of emojis as EmojiEntry[]) {
  const nextEmoji: SearchableEmojiEntry = Object.assign({}, emoji, {
    search: [...emoji.aliases, ...emoji.tags].join(' ')
  })

  if (emojisForSearch[nextEmoji.category]) {
    emojisForSearch[nextEmoji.category].push(nextEmoji)
  } else {
    emojisForSearch[nextEmoji.category] = [nextEmoji]
  }
}

export const validEmoji = (text: string): EmojiEntry | undefined => {
  return (emojis as EmojiEntry[]).find(emoji => emoji.aliases.includes(text))
}

export const checkEditEmoji = (node: Element | null): Element | false => {
  if (node && node.classList.contains(CLASS_OR_ID.AG_EMOJI_MARKED_TEXT)) {
    return node
  }
  return false
}

class Emoji {
  public cache: Map<string, EmojiSearchMap>

  constructor () {
    this.cache = new Map()
  }

  search (text: string): EmojiSearchMap {
    const { cache } = this
    const cached = cache.get(text)
    if (cached) {
      return cached
    }

    const result: EmojiSearchMap = {}
    Object.keys(emojisForSearch).forEach(category => {
      const list = filter(emojisForSearch[category], text, { key: 'search' }) as SearchableEmojiEntry[]
      if (list.length) {
        result[category] = list
      }
    })
    cache.set(text, result)
    return result
  }

  destroy (): void {
    this.cache.clear()
  }
}

export default Emoji
