export type LineEnding = 'lf' | 'crlf'

export interface Encoding {
  encoding: string
  isBom: boolean
}

export interface MarkdownDocumentOptions {
  encoding: Encoding
  lineEnding: LineEnding
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
}

export interface MarkdownDocumentRaw extends MarkdownDocumentOptions {
  markdown: string
  filename: string
  pathname: string
  isMixedLineEndings: boolean
}
