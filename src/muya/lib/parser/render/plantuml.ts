import zlib from 'zlib'
import { toHTML, h } from './snabbdom'

const PLANTUML_URL = 'https://www.plantuml.com/plantuml'

type HtmlRenderer = (node: unknown) => string
type SnabbdomHelper = (selector: string, data?: Record<string, unknown>) => unknown

const toHTMLRenderer = toHTML as unknown as HtmlRenderer
const createVNode = h as unknown as SnabbdomHelper

const replaceChar = (tableIn: string, tableOut: string, char: string): string => {
  const charIndex = tableIn.indexOf(char)
  return tableOut[charIndex] ?? ''
}

const maketrans = (tableIn: string, tableOut: string, value: string): string => {
  return [...value].map(char => replaceChar(tableIn, tableOut, char)).join('')
}

export default class Diagram {
  encodedInput = ''

  /**
   * Builds a Diagram object storing the encoded input value
   */
  static parse (input: string): Diagram {
    const diagram = new Diagram()
    diagram.encodedInput = Diagram.encode(input)
    return diagram
  }

  /**
   * Encodes a diagram following PlantUML specs
   *
   * From https://plantuml.com/text-encoding
   * 1. Encoded in UTF-8
   * 2. Compressed using Deflate or Brotli algorithm
   * 3. Reencoded in ASCII using a transformation close to base64
   */
  static encode (value: string): string {
    const tableIn =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const tableOut =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

    const utf8Value = decodeURIComponent(encodeURIComponent(value))
    const compressedValue = zlib.deflateSync(utf8Value, { level: 3 })
    const base64Value = compressedValue.toString('base64')
    return maketrans(tableIn, tableOut, base64Value)
  }

  insertImgElement (container: string | HTMLElement): void {
    const div = typeof container === 'string'
      ? document.getElementById(container)
      : container

    if (div === null || !('tagName' in div)) {
      throw new Error('Invalid container: ' + container)
    }

    const src = `${PLANTUML_URL}/svg/~1${this.encodedInput}`
    const node = createVNode('img', { attrs: { src } })
    div.innerHTML = toHTMLRenderer(node)
  }
}
