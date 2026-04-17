interface LinkTokenRange {
  start: number
  end: number
}

interface LinkTokenLike {
  type: string
  content?: string
  href?: string
  raw: string
  range: LinkTokenRange
}

interface LinkInfoLike {
  key: string
  token: LinkTokenLike
}

interface ContentStateLike {
  getBlock(key: string): { text: string } | null
  singleRender(block: unknown): void
  muya: {
    dispatchChange(): void
  }
  cursor: {
    start: {
      key: string
      offset: number
    }
    end: {
      key: string
      offset: number
    }
  }
}

type ContentStateConstructor = {
  prototype: ContentStateLike & {
    unlink(linkInfo: LinkInfoLike): void
  }
}

const linkCtrl = (ContentState: ContentStateConstructor): void => {
  ContentState.prototype.unlink = function (linkInfo: LinkInfoLike) {
    const { key, token } = linkInfo
    const block = this.getBlock(key)
    if (!block) {
      return
    }

    const { text } = block
    let anchor = ''
    switch (token.type) {
      case 'html_tag':
        anchor = token.content ?? ''
        break
      case 'link':
        anchor = token.href ?? ''
        break
      case 'text': {
        const match = /^\[(.+?)\]/.exec(token.raw)
        if (match?.[1]) {
          anchor = match[1]
        }
        break
      }
      default:
        break
    }

    if (!anchor) {
      console.error('Can not find anchor when unlink')
      return
    }

    block.text = text.substring(0, token.range.start) + anchor + text.substring(token.range.end)
    this.cursor = {
      start: {
        key,
        offset: token.range.start
      },
      end: {
        key,
        offset: token.range.start + anchor.length
      }
    }

    this.singleRender(block)
    this.muya.dispatchChange()
  }
}

export default linkCtrl
