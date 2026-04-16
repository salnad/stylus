import { getImageInfo } from 'muya/lib/utils'

class MarkdownPrint {
  private container: HTMLElement | null

  constructor () {
    this.container = null
  }

  renderMarkdown (html: string, renderStatic = false): void {
    this.clearup()
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    this.container = printContainer
    printContainer.innerHTML = html

    if (renderStatic) {
      const images = printContainer.getElementsByTagName('img')
      for (const image of Array.from(images)) {
        const rawSrc = image.getAttribute('src') ?? ''
        image.src = getImageInfo(rawSrc).src
      }
    }
    document.body.appendChild(printContainer)
  }

  clearup (): void {
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }
}

export default MarkdownPrint
