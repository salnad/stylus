export interface TreeNode {
  parent: TreeNode | null
  lvl: number | null
  label: string | null
  slug: string | null
  children: TreeNode[]
}

interface TocItem {
  parent?: TreeNode | null
  lvl: number
  content: string
  slug: string
}

class Node implements TreeNode {
  parent: TreeNode | null
  lvl: number | null
  label: string | null
  slug: string | null
  children: TreeNode[]

  constructor (item: TocItem | { parent: null, lvl: null, content: null, slug: null }) {
    const { parent, lvl, content, slug } = item
    this.parent = parent ?? null
    this.lvl = lvl
    this.label = content
    this.slug = slug
    this.children = []
  }

  addChild (node: TreeNode): void {
    this.children.push(node)
  }
}

const findParent = (item: TocItem, lastNode: TreeNode | null, rootNode: TreeNode): TreeNode => {
  if (!lastNode) {
    return rootNode
  }
  const { lvl: lastLvl } = lastNode
  const { lvl } = item

  if (lastLvl !== null && lvl < lastLvl) {
    return findParent(item, lastNode.parent, rootNode)
  } else if (lvl === lastLvl) {
    return lastNode.parent ?? rootNode
  } else {
    return lastNode
  }
}

const listToTree = (list: TocItem[]): TreeNode[] => {
  const rootNode = new Node({ parent: null, lvl: null, content: null, slug: null })
  let lastNode: TreeNode | null = null

  for (const item of list) {
    const parent = findParent(item, lastNode, rootNode)
    const node = new Node({ parent, ...item })
    if (parent instanceof Node) {
      parent.addChild(node)
    } else {
      parent.children.push(node)
    }
    lastNode = node
  }

  return rootNode.children
}

export default listToTree
