import renderBlock from './renderBlock'
import renderLeafBlock from './renderLeafBlock'
import renderContainerBlock from './renderContainerBlock'
import renderIcon from './renderIcon'

type RenderBlockLike = (...args: unknown[]) => unknown

interface RenderBlockCollection {
  renderBlock: RenderBlockLike
  renderLeafBlock: RenderBlockLike
  renderContainerBlock: RenderBlockLike
  renderIcon: RenderBlockLike
}

const renderBlockCollection: RenderBlockCollection = {
  renderBlock: renderBlock as RenderBlockLike,
  renderLeafBlock: renderLeafBlock as RenderBlockLike,
  renderContainerBlock: renderContainerBlock as RenderBlockLike,
  renderIcon: renderIcon as RenderBlockLike
}

export default renderBlockCollection
