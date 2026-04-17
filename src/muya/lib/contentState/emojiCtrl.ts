import { tokenizer, generator } from '../parser'

interface CursorPosition {
  key: string
  offset: number
}

interface RangeLike {
  start: number
  end: number
}

interface TokenLike {
  type: string
  content?: string
  raw?: string
  range: RangeLike
  children?: TokenLike[]
}

interface EmojiItemLike {
  aliases: string[]
}

interface TextBlockLike {
  text: string
}

interface ContentStateLike {
  muya: {
    options: Record<string, unknown>
  }
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  getBlock(key: string): TextBlockLike
  partialRender(): void
}

const emojiCtrl = (ContentState: { prototype: ContentStateLike & { setEmoji(item: EmojiItemLike): void } }): void => {
  ContentState.prototype.setEmoji = function (item: EmojiItemLike) {
    let { key, offset } = this.cursor.start
    const startBlock = this.getBlock(key)
    const { text } = startBlock
    const tokens = tokenizer(text, {
      options: this.muya.options
    }) as unknown as TokenLike[]
    let delta = 0

    const findEmojiToken = (nestedTokens: TokenLike[], cursorOffset: number): TokenLike | undefined => {
      for (const token of nestedTokens) {
        const { start, end } = token.range
        if (cursorOffset >= start && cursorOffset <= end) {
          delta = end - cursorOffset
          return token.children && Array.isArray(token.children) && token.children.length
            ? findEmojiToken(token.children, cursorOffset)
            : token
        }
      }
    }

    const token = findEmojiToken(tokens, offset)
    if (token && token.type === 'emoji' && typeof token.content === 'string') {
      const emojiText = item.aliases[0]
      offset += delta + emojiText.length - token.content.length
      token.content = emojiText
      token.raw = `:${emojiText}:`
      startBlock.text = generator(tokens as unknown as []) as unknown as string
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.partialRender()
    }
  }
}

export default emojiCtrl
