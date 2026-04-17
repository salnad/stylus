import { CLASS_OR_ID } from '../../../config'
import { sanitizeHyperlink } from '../../../utils/url'
import type {
  BlockLike,
  CursorRangeLike,
  InlineRenderContextLike,
  RenderChildren,
  SnabbdomHelper,
  TokenLike
} from './types'

interface AutoLinkExtensionToken extends TokenLike {
  linkType: 'www' | 'url' | string
  www: string
  url: string
  email: string
}

// render auto_link to vdom
export default function autoLinkExtension (
  this: InlineRenderContextLike,
  h: SnabbdomHelper,
  _cursor: CursorRangeLike,
  block: BlockLike,
  token: AutoLinkExtensionToken,
  _outerClass?: string
): RenderChildren {
  const { linkType, www, url, email } = token
  const { start, end } = token.range

  const content = this.highlight(h, block, start, end, token)
  const hyperlink = linkType === 'www'
    ? encodeURI(`http://${www}`)
    : (linkType === 'url' ? encodeURI(url) : `mailto:${email}`)

  return [
    h(`a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_AUTO_LINK_EXTENSION}`, {
      attrs: {
        spellcheck: 'false'
      },
      props: {
        href: sanitizeHyperlink(hyperlink),
        target: '_blank'
      }
    }, content)
  ]
}
