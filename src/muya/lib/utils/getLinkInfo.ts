import { findNearestParagraph } from '../selection/dom'
import { tokenizer } from '../parser'

interface LinkInfoToken {
  range?: {
    start: string | null
    end: string | null
  }
  [key: string]: unknown
}

interface LinkElementLike extends HTMLElement {
  getAttribute(name: string): string | null
}

export const getLinkInfo = (anchor: LinkElementLike): {
  key: string
  token: LinkInfoToken
  href: string | null
} => {
  const paragraph = findNearestParagraph(anchor) as HTMLElement
  const raw = anchor.getAttribute('data-raw') ?? ''
  const start = anchor.getAttribute('data-start')
  const end = anchor.getAttribute('data-end')
  const tokens = tokenizer(raw) as unknown as LinkInfoToken[]
  const token = tokens[0]
  const href = anchor.getAttribute('href')

  token.range = {
    start,
    end
  }

  return {
    key: paragraph.id,
    token,
    href
  }
}
