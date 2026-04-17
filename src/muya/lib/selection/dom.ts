import {
  LOWERCASE_TAGS, CLASS_OR_ID, blockContainerElementNames, emptyElementNames
} from '../config'

const CHOP_TEXT_REG = /(\*{1,3})([^*]+)(\1)/g

type ClassNameList = string[]

interface MarkedTextChunk {
  index: number
  leftSymbol: string
  rightSymbol: string
  lastIndex: number
}

type CursorPositionWithinMarkedText =
  | { type: 'OUT', info?: undefined }
  | { type: 'IN', info: string }
  | { type: 'LEFT', info: number }
  | { type: 'RIGHT', info: number }

const isElementNode = (node: Node | null | undefined): node is Element => {
  return !!node && node.nodeType === Node.ELEMENT_NODE
}

const isTextNode = (node: Node | null | undefined): node is Text => {
  return !!node && node.nodeType === Node.TEXT_NODE
}

export const getTextContent = (node: Node, blackList?: ClassNameList): string => {
  if (isTextNode(node)) {
    return node.textContent as string
  } else if (!blackList) {
    return node.textContent as string
  }

  let text = ''
  if (isElementNode(node) && blackList.some(className => node.classList.contains(className))) {
    return text
  }

  // Handle inline image
  if (isElementNode(node) && node.classList.contains('ag-inline-image')) {
    const raw = node.getAttribute('data-raw')
    const imageContainer = node.querySelector('.ag-image-container') as Element
    const hasImg = imageContainer.querySelector('img')
    const childNodes = imageContainer.childNodes
    if (childNodes.length && hasImg) {
      for (const child of childNodes) {
        if (isElementNode(child) && child.nodeName === 'IMG') {
          text += raw as string
        } else if (isTextNode(child)) {
          text += child.textContent as string
        }
      }
      return text
    }
    return text + (raw as string)
  }

  const childNodes = node.childNodes
  for (const child of childNodes) {
    text += getTextContent(child, blackList)
  }
  return text
}

export const getOffsetOfParagraph = (node: Node, paragraph: Node): number => {
  let offset = 0
  let preSibling: Node | null = node

  if (node === paragraph) return offset

  do {
    preSibling = preSibling.previousSibling
    if (preSibling) {
      offset += getTextContent(preSibling, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER]).length
    }
  } while (preSibling)

  return (node === paragraph || node.parentNode === paragraph)
    ? offset
    : offset + getOffsetOfParagraph(node.parentNode as Node, paragraph)
}

export const findNearestParagraph = (node: Node | null): Element | null => {
  if (!node) {
    return null
  }

  let current: Node | null = node
  do {
    if (isAganippeParagraph(current)) return current
    current = current.parentNode
  } while (current)

  return null
}

export const findOutMostParagraph = (node: Node): Element | undefined => {
  let current: Node | null = node

  do {
    const parentNode: Node | null = current.parentNode
    if (isMuyaEditorElement(parentNode) && isAganippeParagraph(current)) return current
    current = parentNode
  } while (current)
}

export const isAganippeParagraph = (element: Node | null | undefined): element is HTMLElement => {
  return isElementNode(element) && element.classList.contains(CLASS_OR_ID.AG_PARAGRAPH)
}

export const isBlockContainer = (element: Node | null | undefined): element is Element => {
  return isElementNode(element) &&
    blockContainerElementNames.indexOf(element.nodeName.toLowerCase()) !== -1
}

export const isMuyaEditorElement = (element: Node | null | undefined): element is HTMLElement => {
  return isElementNode(element) && element.id === CLASS_OR_ID.AG_EDITOR_ID
}

export const traverseUp = (
  current: Node | null,
  testElementFunction: (element: Element) => boolean
): Element | false => {
  if (!current) {
    return false
  }

  let node: Node | null = current
  do {
    if (isElementNode(node)) {
      if (testElementFunction(node)) {
        return node
      }
      // do not traverse upwards past the nearest containing editor
      if (isMuyaEditorElement(node)) {
        return false
      }
    }

    node = node.parentNode
  } while (node)

  return false
}

export const getFirstSelectableLeafNode = (element: Node | null): Node => {
  let current = element
  while (current && current.firstChild) {
    current = current.firstChild
  }

  // We don't want to set the selection to an element that can't have children, this messes up Gecko.
  current = traverseUp(current, el => {
    return emptyElementNames.indexOf(el.nodeName.toLowerCase()) === -1
  }) as unknown as Node

  // Selecting at the beginning of a table doesn't work in PhantomJS.
  if ((current as Element).nodeName.toLowerCase() === LOWERCASE_TAGS.table) {
    const firstCell = (current as Element).querySelector('th, td')
    if (firstCell) {
      current = firstCell
    }
  }

  return current as Node
}

export const getClosestBlockContainer = (node: Node | null): Element | false => {
  return traverseUp(node, current => {
    return isBlockContainer(current) || isMuyaEditorElement(current)
  })
}

export const getCursorPositionWithinMarkedText = (
  markedText: string,
  cursorOffset: number
): CursorPositionWithinMarkedText => {
  const chunks: MarkedTextChunk[] = []
  let match: RegExpExecArray | null
  let result: CursorPositionWithinMarkedText = { type: 'OUT' }

  do {
    match = CHOP_TEXT_REG.exec(markedText)
    if (match) {
      chunks.push({
        index: match.index + match[1].length,
        leftSymbol: match[1],
        rightSymbol: match[3],
        lastIndex: CHOP_TEXT_REG.lastIndex - match[3].length
      })
    }
  } while (match)

  chunks.forEach(chunk => {
    const { index, leftSymbol, rightSymbol, lastIndex } = chunk
    if (cursorOffset > index && cursorOffset < lastIndex) {
      result = { type: 'IN', info: leftSymbol } // rightSymbol is also ok
    } else if (cursorOffset === index) {
      result = { type: 'LEFT', info: leftSymbol.length }
    } else if (cursorOffset === lastIndex) {
      result = { type: 'RIGHT', info: rightSymbol.length }
    }
  })

  return result
}

export const compareParagraphsOrder = (paragraph1: Element, paragraph2: Element): number => {
  return paragraph1.compareDocumentPosition(paragraph2) & Node.DOCUMENT_POSITION_FOLLOWING
}
