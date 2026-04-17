/**
 * This file copy from prismjs/plugins/prism-line-number
 */

/**
 * Regular expression used for determining line breaks
 */
const NEW_LINE_EXP = /\n(?!$)/g

interface LegacyStyleElement extends Element {
  currentStyle?: CSSStyleDeclaration | null
}

const getStyles = (element: LegacyStyleElement | null): CSSStyleDeclaration | null => {
  if (!element) {
    return null
  }

  return typeof window.getComputedStyle === 'function'
    ? getComputedStyle(element)
    : (element.currentStyle || null)
}

/**
 * Resizes line numbers spans according to height of line of code
 *
 * @param element `<pre>` element
 */
const resizeCodeBlockLineNumber = (element: LegacyStyleElement): void => {
  // FIXME: Heavy performance issues with this function, please see #1648.

  const codeStyles = getStyles(element)
  const whiteSpace = codeStyles?.getPropertyValue('white-space') || ''

  if (whiteSpace === 'pre' || whiteSpace === 'pre-wrap' || whiteSpace === 'pre-line') {
    const codeElement = element.querySelector<HTMLElement>('code')
    const lineNumbersWrapper = element.querySelector<HTMLElement>('.line-numbers-rows')
    let lineNumberSizer = element.querySelector<HTMLElement>('.line-numbers-sizer')
    const codeLines = codeElement?.textContent?.split(NEW_LINE_EXP) ?? []

    if (!codeElement || !lineNumbersWrapper) {
      return
    }

    if (!lineNumberSizer) {
      lineNumberSizer = document.createElement('span')
      lineNumberSizer.className = 'line-numbers-sizer'

      codeElement.appendChild(lineNumberSizer)
    }

    lineNumberSizer.style.display = 'block'

    codeLines.forEach((line, lineNumber) => {
      lineNumberSizer!.textContent = line || '\n'
      const lineSize = lineNumberSizer!.getBoundingClientRect().height
      const row = lineNumbersWrapper.children[lineNumber] as HTMLElement | undefined
      if (row) {
        row.style.height = `${lineSize}px`
      }
    })

    lineNumberSizer.textContent = ''
    lineNumberSizer.style.display = 'none'
  }
}

export default resizeCodeBlockLineNumber
