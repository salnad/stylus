type ClassListController = 'add' | 'remove'

export const operateClassName = (
  element: { classList: { add(className: string): void, remove(className: string): void } },
  ctrl: ClassListController,
  className: string
): void => {
  element.classList[ctrl](className)
}

export const insertBefore = (newNode: Node, originNode: Node): void => {
  const parentNode = originNode.parentNode
  parentNode?.insertBefore(newNode, originNode)
}

export const insertAfter = (newNode: Node, originNode: Node): void => {
  const parentNode = originNode.parentNode
  if (!parentNode) {
    return
  }

  if (originNode.nextSibling) {
    parentNode.insertBefore(newNode, originNode.nextSibling)
  } else {
    parentNode.appendChild(newNode)
  }
}
