interface BlockLike {
  key: string
  type: string
  headingStyle?: string
  children: Array<{
    text: string
    [key: string]: unknown
  }>
}

interface TocItem {
  content: string
  lvl: number
  slug: string
}

interface ContentStateLike {
  blocks: BlockLike[]
}

interface TocCtrlMethods {
  getTOC(): TocItem[]
}

type ContentStateConstructor = {
  prototype: unknown
}

const tocCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & TocCtrlMethods

  prototype.getTOC = function (): TocItem[] {
    const { blocks } = this
    const toc: TocItem[] = []

    for (const block of blocks) {
      if (/^h\d$/.test(block.type)) {
        const { headingStyle, key, type } = block
        const text = block.children[0]?.text ?? ''
        const content = headingStyle === 'setext'
          ? text.trim()
          : text.replace(/^\s*#{1,6}\s{1,}/, '').trim()
        const lvl = +type.substring(1)
        const slug = key
        toc.push({
          content,
          lvl,
          slug
        })
      }
    }

    return toc
  }
}

export default tocCtrl
