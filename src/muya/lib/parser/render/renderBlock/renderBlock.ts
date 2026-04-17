import type { BlockLike, MatchLike, RenderBlockContextLike } from './types'

/**
 * [renderBlock render one block, no matter it is a container block or text block]
 */
export default function renderBlock (
  this: RenderBlockContextLike,
  parent: BlockLike | null,
  block: BlockLike,
  activeBlocks: BlockLike[],
  matches: MatchLike[],
  useCache = false
) {
  const method = Array.isArray(block.children) && block.children.length > 0
    ? 'renderContainerBlock'
    : 'renderLeafBlock'
  const renderMethod = this[method] as RenderBlockContextLike['renderContainerBlock'] | RenderBlockContextLike['renderLeafBlock']

  return renderMethod.call(this, parent, block, activeBlocks, matches, useCache)
}
