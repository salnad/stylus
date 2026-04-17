/**
 * This file is copy from [medium-editor](https://github.com/yabwe/medium-editor)
 * and customize for specialized use.
 */
import Cursor from './cursor'
import { CLASS_OR_ID } from '../config'
import {
  isBlockContainer,
  traverseUp,
  getFirstSelectableLeafNode,
  getClosestBlockContainer,
  getCursorPositionWithinMarkedText,
  findNearestParagraph,
  getTextContent,
  getOffsetOfParagraph
} from './dom'

type NativeRange = globalThis.Range
type NativeSelection = globalThis.Selection
type CursorConstructorArgument = ConstructorParameters<typeof Cursor>[0]

interface SelectionState {
  start: number
  end: number
  startsWithImage?: boolean
  emptyBlocksIndex?: number
  trailingImageCount?: number
}

interface CursorPosition {
  key: string
  offset: number
}

interface CursorRangeLike {
  anchor?: CursorPosition | null
  focus?: CursorPosition | null
  start?: CursorPosition | null
  end?: CursorPosition | null
}

interface CaretOffsets {
  left: number
  right: number
}

interface CursorCoords {
  x: number
  y: number
  width: number
}

interface CursorYOffset {
  topOffset: number
  bottomOffset: number
}

interface NodeAndOffset {
  node: Node
  offset: number
}

interface LegacyCreateTreeWalker {
  (root: Node, whatToShow: number, filter: NodeFilter | null, entityReferenceExpansion?: boolean): TreeWalker
}

const filterOnlyParentElements = (node: Node): number => {
  return isBlockContainer(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
}

const blockContainerFilter: NodeFilter = {
  acceptNode: filterOnlyParentElements
}

const isElementNode = (node: Node | null | undefined): node is Element => {
  return !!node && node.nodeType === Node.ELEMENT_NODE
}

const isTextNode = (node: Node | null | undefined): node is Text => {
  return !!node && node.nodeType === Node.TEXT_NODE
}

class Selection {
  doc: Document

  constructor (doc: Document) {
    this.doc = doc // document
  }

  findMatchingSelectionParent (
    testElementFunction: (element: Element) => boolean,
    contentWindow: Window
  ): Element | false {
    const selection = contentWindow.getSelection() as NativeSelection

    if (selection.rangeCount === 0) {
      return false
    }

    const range = selection.getRangeAt(0)
    const current = range.commonAncestorContainer

    return traverseUp(current, testElementFunction)
  }

  // https://stackoverflow.com/questions/17678843/cant-restore-selection-after-html-modify-even-if-its-the-same-html
  // Tim Down
  //
  // {object} selectionState - the selection to import
  // {DOMElement} root - the root element the selection is being restored inside of
  // {boolean} [favorLaterSelectionAnchor] - defaults to false. If true, import the cursor immediately
  //      subsequent to an anchor tag if it would otherwise be placed right at the trailing edge inside the
  //      anchor. This cursor positioning, even though visually equivalent to the user, can affect behavior
  //      in MS IE.
  importSelection (selectionState: SelectionState, root: Node, favorLaterSelectionAnchor?: boolean): void {
    if (!selectionState || !root) {
      throw new Error('your must provide a [selectionState] and a [root] element')
    }

    let range = this.doc.createRange()
    range.setStart(root, 0)
    range.collapse(true)

    let node: Node | null = root
    const nodeStack: Node[] = []
    let charIndex = 0
    let foundStart = false
    let foundEnd = false
    let trailingImageCount = 0
    let stop = false
    let nextCharIndex = 0
    let allowRangeToStartAtEndOfNode = false
    let lastTextNode: Text | null = null

    // When importing selection, the start of the selection may lie at the end of an element
    // or at the beginning of an element.  Since visually there is no difference between these 2
    // we will try to move the selection to the beginning of an element since this is generally
    // what users will expect and it's a more predictable behavior.
    //
    // However, there are some specific cases when we don't want to do this:
    //  1) We're attempting to move the cursor outside of the end of an anchor [favorLaterSelectionAnchor = true]
    //  2) The selection starts with an image, which is special since an image doesn't have any 'content'
    //     as far as selection and ranges are concerned
    //  3) The selection starts after a specified number of empty block elements (selectionState.emptyBlocksIndex)
    //
    // For these cases, we want the selection to start at a very specific location, so we should NOT
    // automatically move the cursor to the beginning of the first actual chunk of text
    if (favorLaterSelectionAnchor || selectionState.startsWithImage || typeof selectionState.emptyBlocksIndex !== 'undefined') {
      allowRangeToStartAtEndOfNode = true
    }

    while (!stop && node) {
      // Only iterate over elements and text nodes
      if (node.nodeType > 3) {
        node = nodeStack.pop() || null
        continue
      }

      // If we hit a text node, we need to add the amount of characters to the overall count
      if (isTextNode(node) && !foundEnd) {
        nextCharIndex = charIndex + node.length
        // Check if we're at or beyond the start of the selection we're importing
        if (!foundStart && selectionState.start >= charIndex && selectionState.start <= nextCharIndex) {
          // NOTE: We only want to allow a selection to start at the END of an element if
          //  allowRangeToStartAtEndOfNode is true
          if (allowRangeToStartAtEndOfNode || selectionState.start < nextCharIndex) {
            range.setStart(node, selectionState.start - charIndex)
            foundStart = true
          } else {
            // We're at the end of a text node where the selection could start but we shouldn't
            // make the selection start here because allowRangeToStartAtEndOfNode is false.
            // However, we should keep a reference to this node in case there aren't any more
            // text nodes after this, so that we have somewhere to import the selection to
            lastTextNode = node
          }
        }
        // We've found the start of the selection, check if we're at or beyond the end of the selection we're importing
        if (foundStart && selectionState.end >= charIndex && selectionState.end <= nextCharIndex) {
          if (!selectionState.trailingImageCount) {
            range.setEnd(node, selectionState.end - charIndex)
            stop = true
          } else {
            foundEnd = true
          }
        }
        charIndex = nextCharIndex
      } else {
        if (selectionState.trailingImageCount && foundEnd) {
          if (node.nodeName.toLowerCase() === 'img') {
            trailingImageCount++
          }
          if (trailingImageCount === selectionState.trailingImageCount) {
            // Find which index the image is in its parent's children
            let endIndex = 0
            const parentNode = node.parentNode as Node & ParentNode
            while (parentNode.childNodes[endIndex] !== node) {
              endIndex++
            }
            range.setEnd(parentNode, endIndex + 1)
            stop = true
          }
        }

        if (!stop && node.nodeType === 1) {
          // this is an element
          // add all its children to the stack
          let i = node.childNodes.length - 1
          while (i >= 0) {
            nodeStack.push(node.childNodes[i])
            i -= 1
          }
        }
      }

      if (!stop) {
        node = nodeStack.pop() || null
      }
    }

    // If we've gone through the entire text but didn't find the beginning of a text node
    // to make the selection start at, we should fall back to starting the selection
    // at the END of the last text node we found
    if (!foundStart && lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.length)
      range.setEnd(lastTextNode, lastTextNode.length)
    }

    if (typeof selectionState.emptyBlocksIndex !== 'undefined') {
      range = this.importSelectionMoveCursorPastBlocks(root, selectionState.emptyBlocksIndex, range)
    }

    // If the selection is right at the ending edge of a link, put it outside the anchor tag instead of inside.
    if (favorLaterSelectionAnchor) {
      range = this.importSelectionMoveCursorPastAnchor(selectionState, range)
    }

    this.selectRange(range)
  }

  // Utility method called from importSelection only
  importSelectionMoveCursorPastAnchor (selectionState: SelectionState, range: NativeRange): NativeRange {
    const nodeInsideAnchorTagFunction = (node: Element): boolean => {
      return node.nodeName.toLowerCase() === 'a'
    }

    if (selectionState.start === selectionState.end &&
      range.startContainer.nodeType === 3 &&
      range.startOffset === (range.startContainer.nodeValue as string).length &&
      traverseUp(range.startContainer, nodeInsideAnchorTagFunction)) {
      let prevNode: Node = range.startContainer
      let currentNode: Node | null = range.startContainer.parentNode
      while (currentNode !== null && currentNode.nodeName.toLowerCase() !== 'a') {
        const childNodes = (currentNode as ParentNode).childNodes
        if (childNodes[childNodes.length - 1] !== prevNode) {
          currentNode = null
        } else {
          prevNode = currentNode
          currentNode = currentNode.parentNode
        }
      }
      if (currentNode !== null && currentNode.nodeName.toLowerCase() === 'a') {
        let currentNodeIndex: number | null = null
        const parentNode = currentNode.parentNode as Node & ParentNode
        for (let i = 0; currentNodeIndex === null && i < parentNode.childNodes.length; i++) {
          if (parentNode.childNodes[i] === currentNode) {
            currentNodeIndex = i
          }
        }
        range.setStart(parentNode, (currentNodeIndex as number) + 1)
        range.collapse(true)
      }
    }
    return range
  }

  // Uses the emptyBlocksIndex calculated by getIndexRelativeToAdjacentEmptyBlocks
  // to move the cursor back to the start of the correct paragraph
  importSelectionMoveCursorPastBlocks (root: Node, index = 1, range: NativeRange): NativeRange {
    const createTreeWalker = this.doc.createTreeWalker as unknown as LegacyCreateTreeWalker
    const treeWalker = createTreeWalker.call(this.doc, root, NodeFilter.SHOW_ELEMENT, blockContainerFilter, false)
    const startContainer = range.startContainer
    let startBlock: Node | false
    let targetNode: Node | false | null = null
    let currIndex = 0
    // If index is 0, we still want to move to the next block

    // Chrome counts newlines and spaces that separate block elements as actual elements.
    // If the selection is inside one of these text nodes, and it has a previous sibling
    // which is a block element, we want the treewalker to start at the previous sibling
    // and NOT at the parent of the textnode
    if (startContainer.nodeType === 3 && isBlockContainer(startContainer.previousSibling)) {
      startBlock = startContainer.previousSibling
    } else {
      startBlock = getClosestBlockContainer(startContainer)
    }

    // Skip over empty blocks until we hit the block we want the selection to be in
    while (treeWalker.nextNode()) {
      if (!targetNode) {
        // Loop through all blocks until we hit the starting block element
        if (startBlock === treeWalker.currentNode) {
          targetNode = treeWalker.currentNode
        }
      } else {
        targetNode = treeWalker.currentNode
        currIndex++
        // We hit the target index, bail
        if (currIndex === index) {
          break
        }
        // If we find a non-empty block, ignore the emptyBlocksIndex and just put selection here
        if ((targetNode.textContent as string).length > 0) {
          break
        }
      }
    }

    if (!targetNode) {
      targetNode = startBlock
    }

    // We're selecting a high-level block node, so make sure the cursor gets moved into the deepest
    // element at the beginning of the block
    range.setStart(getFirstSelectableLeafNode(targetNode as Node), 0)

    return range
  }

  // https://stackoverflow.com/questions/4176923/html-of-selected-text
  // by Tim Down
  getSelectionHtml (): string {
    const sel = this.doc.getSelection() as NativeSelection
    let i
    let html = ''
    let len
    let container: HTMLDivElement

    if (sel.rangeCount) {
      container = this.doc.createElement('div')
      for (i = 0, len = sel.rangeCount; i < len; i += 1) {
        container.appendChild(sel.getRangeAt(i).cloneContents())
      }
      html = container.innerHTML
    }
    return html
  }

  chopHtmlByCursor (root: HTMLElement): { pre: string, post: string } {
    const { left } = this.getCaretOffsets(root)
    const markedText = root.textContent as string
    const position = getCursorPositionWithinMarkedText(markedText, left)
    const pre = markedText.slice(0, left)
    const post = markedText.slice(left)

    switch (position.type) {
      case 'OUT':
        return {
          pre,
          post
        }
      case 'IN':
        return {
          pre: `${pre}${position.info}`,
          post: `${position.info}${post}`
        }
      case 'LEFT':
        return {
          pre: markedText.slice(0, left - position.info),
          post: markedText.slice(left - position.info)
        }
      case 'RIGHT':
        return {
          pre: markedText.slice(0, left + position.info),
          post: markedText.slice(left + position.info)
        }
    }
  }

  /**
   *  Find the caret position within an element irrespective of any inline tags it may contain.
   *
   *  @param {DOMElement} An element containing the cursor to find offsets relative to.
   *  @param {Range} A Range representing cursor position. Will window.getSelection if none is passed.
   *  @return {Object} 'left' and 'right' attributes contain offsets from beginning and end of Element
   */
  getCaretOffsets (element: Node, range?: NativeRange): CaretOffsets {
    if (!range) {
      range = (window.getSelection() as NativeSelection).getRangeAt(0)
    }

    const preCaretRange = range.cloneRange()
    const postCaretRange = range.cloneRange()

    preCaretRange.selectNodeContents(element)
    preCaretRange.setEnd(range.endContainer, range.endOffset)

    postCaretRange.selectNodeContents(element)
    postCaretRange.setStart(range.endContainer, range.endOffset)

    return {
      left: preCaretRange.toString().length,
      right: postCaretRange.toString().length
    }
  }

  selectNode (node: Node): void {
    const range = this.doc.createRange()
    range.selectNodeContents(node)
    this.selectRange(range)
  }

  select (startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): NativeRange {
    const range = this.doc.createRange()
    range.setStart(startNode, startOffset)
    if (endNode) {
      range.setEnd(endNode, endOffset as number)
    } else {
      range.collapse(true)
    }
    this.selectRange(range)
    return range
  }

  setFocus (focusNode: Node, focusOffset: number): void {
    const selection = this.doc.getSelection() as NativeSelection
    selection.extend(focusNode, focusOffset)
  }

  /**
   *  Clear the current highlighted selection and set the caret to the start or the end of that prior selection, defaults to end.
   *
   *  @param {boolean} moveCursorToStart  A boolean representing whether or not to set the caret to the beginning of the prior selection.
   */
  clearSelection (moveCursorToStart?: boolean): void {
    const selection = this.doc.getSelection() as NativeSelection
    const { rangeCount } = selection
    if (!rangeCount) return
    if (moveCursorToStart) {
      selection.collapseToStart()
    } else {
      selection.collapseToEnd()
    }
  }

  /**
   * Move cursor to the given node with the given offset.
   *
   * @param  {DomElement}  node    Element where to jump
   * @param  {integer}     offset  Where in the element should we jump, 0 by default
   */
  moveCursor (node: Node, offset: number): void {
    this.select(node, offset)
  }

  getSelectionRange (): NativeRange | null {
    const selection = this.doc.getSelection() as NativeSelection
    if (selection.rangeCount === 0) {
      return null
    }
    return selection.getRangeAt(0)
  }

  selectRange (range: NativeRange): void {
    const selection = this.doc.getSelection() as NativeSelection

    selection.removeAllRanges()
    selection.addRange(range)
  }

  // https://stackoverflow.com/questions/1197401/
  // how-can-i-get-the-element-the-caret-is-in-with-javascript-when-using-contenteditable
  // by You
  getSelectionStart (): Node | null {
    const node = (this.doc.getSelection() as NativeSelection).anchorNode
    const startNode = (node && node.nodeType === 3 ? node.parentNode : node)

    return startNode
  }

  setCursorRange (cursorRange: CursorRangeLike): void {
    const { anchor, focus } = cursorRange as { anchor: CursorPosition, focus: CursorPosition }
    const anchorParagraph = document.querySelector<HTMLElement>(`#${anchor.key}`) as Node
    const focusParagraph = document.querySelector<HTMLElement>(`#${focus.key}`) as Node
    const getNodeAndOffset = (node: Node, offset: number): NodeAndOffset => {
      if (node.nodeType === 3) {
        return {
          node,
          offset
        }
      }

      const childNodes = node.childNodes
      const len = childNodes.length
      let i
      let count = 0
      for (i = 0; i < len; i++) {
        const child = childNodes[i]
        const textContent = getTextContent(child, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER])
        const textLength = textContent.length
        if (isElementNode(child) && child.classList.contains(CLASS_OR_ID.AG_FRONT_ICON)) {
          continue
        }

        // Fix #1460 - put the cursor at the next text node or element if it can be put at the last of /^\n$/ or the next text node/element.
        if (/^\n$/.test(textContent) && i !== len - 1 ? count + textLength > offset : count + textLength >= offset) {
          if (
            isElementNode(child) && child.classList.contains('ag-inline-image')
          ) {
            const imageContainer = child.querySelector('.ag-image-container') as Node & ParentNode
            const hasImg = (imageContainer as Element).querySelector('img')

            if (!hasImg) {
              return {
                node: child,
                offset: 0
              }
            }
            if (count + textLength === offset) {
              if (child.nextElementSibling) {
                return {
                  node: child.nextElementSibling,
                  offset: 0
                }
              } else {
                return {
                  node: imageContainer,
                  offset: 1
                }
              }
            } else if (count === offset && count === 0) {
              return {
                node: imageContainer,
                offset: 0
              }
            } else {
              return {
                node: child,
                offset: 0
              }
            }
          } else {
            return getNodeAndOffset(child, offset - count)
          }
        } else {
          count += textLength
        }
      }
      return { node, offset }
    }

    let { node: anchorNode, offset: anchorOffset } = getNodeAndOffset(anchorParagraph, anchor.offset)
    let { node: focusNode, offset: focusOffset } = getNodeAndOffset(focusParagraph, focus.offset)

    if (isTextNode(anchorNode) || (isElementNode(anchorNode) && !anchorNode.classList.contains('ag-image-container'))) {
      anchorOffset = Math.min(anchorOffset, (anchorNode.textContent as string).length)
      focusOffset = Math.min(focusOffset, (focusNode.textContent as string).length)
    }

    // First set the anchor node and anchor offset, make it collapsed
    this.select(anchorNode, anchorOffset)
    // Secondly, set the focus node and focus offset.
    this.setFocus(focusNode, focusOffset)
  }

  isValidCursorNode (node: Node | null): Element | null | false {
    if (!node) return false
    let current: Node | null = node
    if (current.nodeType === 3) {
      current = current.parentNode
    }

    return isElementNode(current) ? current.closest('span.ag-paragraph') : false
  }

  getCursorRange (): InstanceType<typeof Cursor> {
    let { anchorNode, anchorOffset, focusNode, focusOffset } = (this.doc.getSelection() as NativeSelection)
    const isAnchorValid = this.isValidCursorNode(anchorNode)
    const isFocusValid = this.isValidCursorNode(focusNode)
    let needFix = false
    if (!isAnchorValid && isFocusValid) {
      needFix = true
      anchorNode = focusNode
      anchorOffset = focusOffset
    } else if (isAnchorValid && !isFocusValid) {
      needFix = true
      focusNode = anchorNode
      focusOffset = anchorOffset
    } else if (!isAnchorValid && !isFocusValid) {
      const editor = (document.querySelector('#ag-editor-id') as Element).parentNode as HTMLElement
      editor.blur()

      return new Cursor({
        start: null,
        end: null,
        anchor: null,
        focus: null
      } as unknown as CursorConstructorArgument)
    }

    // fix bug click empty line, the cursor will jump to the end of pre line.
    if (
      anchorNode === focusNode &&
      anchorOffset === focusOffset &&
      anchorNode?.textContent === '\n' &&
      focusOffset === 0
    ) {
      focusOffset = anchorOffset = 1
    }

    const anchorParagraph = findNearestParagraph(anchorNode as Node) as HTMLElement
    const focusParagraph = findNearestParagraph(focusNode as Node) as HTMLElement

    let aOffset = getOffsetOfParagraph(anchorNode as Node, anchorParagraph) + anchorOffset
    let fOffset = getOffsetOfParagraph(focusNode as Node, focusParagraph) + focusOffset

    // fix input after image.
    if (
      anchorNode === focusNode &&
      anchorOffset === focusOffset &&
      isElementNode(anchorNode?.parentNode) &&
      anchorNode.parentNode.classList.contains('ag-image-container') &&
      (anchorNode as Node & { previousElementSibling: Element | null }).previousElementSibling &&
      (anchorNode as Node & { previousElementSibling: Element | null }).previousElementSibling?.nodeName === 'IMG'
    ) {
      const imageWrapper = anchorNode.parentNode.parentNode as Element
      const preElement = imageWrapper.previousElementSibling
      aOffset = 0
      if (preElement) {
        aOffset += getOffsetOfParagraph(preElement, anchorParagraph)
        aOffset += getTextContent(preElement, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER]).length
      }
      aOffset += getTextContent(imageWrapper, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER]).length
      fOffset = aOffset
    }

    if (
      anchorNode === focusNode &&
      isElementNode(anchorNode) &&
      anchorNode.classList.contains('ag-image-container')
    ) {
      const imageWrapper = anchorNode.parentNode as Element
      const preElement = imageWrapper.previousElementSibling
      aOffset = 0
      if (preElement) {
        aOffset += getOffsetOfParagraph(preElement, anchorParagraph)
        aOffset += getTextContent(preElement, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER]).length
      }
      if (anchorOffset === 1) {
        aOffset += getTextContent(imageWrapper, [CLASS_OR_ID.AG_MATH_RENDER, CLASS_OR_ID.AG_RUBY_RENDER]).length
      }
      fOffset = aOffset
    }

    const anchor = { key: anchorParagraph.id, offset: aOffset }

    const focus = { key: focusParagraph.id, offset: fOffset }
    const result = new Cursor({ anchor, focus })

    if (needFix) {
      this.setCursorRange(result as unknown as CursorRangeLike)
    }

    return result
  }

  // topOffset is the line counts above cursor, and bottomOffset is line counts below cursor.
  getCursorYOffset (paragraph: Element): CursorYOffset {
    const { y } = this.getCursorCoords()
    const { height, top } = paragraph.getBoundingClientRect()
    const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight)
    const topOffset = Math.round((y - top) / lineHeight)
    const bottomOffset = Math.round((top + height - lineHeight - y) / lineHeight)

    return {
      topOffset,
      bottomOffset
    }
  }

  getCursorCoords (): CursorCoords {
    const sel = this.doc.getSelection() as NativeSelection
    let range: NativeRange
    let x = 0
    let y = 0
    let width = 0

    if (sel.rangeCount) {
      range = sel.getRangeAt(0).cloneRange()
      if (range.getClientRects) {
        // range.collapse(true)
        let rects = range.getClientRects()
        if (rects.length === 0 && range.startContainer && (range.startContainer.nodeType === Node.ELEMENT_NODE || range.startContainer.nodeType === Node.TEXT_NODE)) {
          const parentElement = isElementNode(range.startContainer)
            ? range.startContainer
            : (range.startContainer.parentElement as Element)
          rects = parentElement.getClientRects()
          // prevent tiny vibrations
          if (rects.length) {
            const rect = rects[0] as DOMRect
            rect.y = rect.y + 1
          }
        }
        if (rects.length) {
          const { left, top, x: rectX, y: rectY, width: rWidth } = rects[0]
          x = rectX || left
          y = rectY || top
          width = rWidth
        }
      }
    }

    return { x, y, width }
  }

  getSelectionEnd (): Node | null {
    const node = (this.doc.getSelection() as NativeSelection).focusNode
    const endNode = (node && node.nodeType === 3 ? node.parentNode : node)

    return endNode
  }
}

export default new Selection(document)
