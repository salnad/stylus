import { getUniqueId, cloneObj } from '../util'
import type { Encoding, MarkdownDocumentOptions } from 'common/types/documents'

export interface HistoryState {
  stack: unknown[]
  index: number
}

export interface WordCount {
  paragraph: number
  word: number
  character: number
  all: number
}

export interface SearchMatches {
  index: number
  matches: unknown[]
  value: string
}

export interface DocumentState {
  id: string
  isSaved: boolean
  pathname: string
  filename: string
  markdown: string
  encoding: Encoding
  lineEnding: 'lf' | 'crlf'
  trimTrailingNewline: number
  adjustLineEndingOnSave: boolean
  history: HistoryState
  cursor: unknown
  wordCount: WordCount
  searchMatches: SearchMatches
  notifications: Array<Record<string, unknown>>
}

export interface DocumentStateInput extends MarkdownDocumentOptions {
  id?: string
  markdown: string
  filename: string
  pathname: string
  cursor?: unknown
}

export const defaultFileState: Omit<DocumentState, 'id'> = {
  isSaved: true,
  pathname: '',
  filename: 'Untitled-1',
  markdown: '',
  encoding: {
    encoding: 'utf8',
    isBom: false
  },
  lineEnding: 'lf',
  trimTrailingNewline: 3,
  adjustLineEndingOnSave: false,
  history: {
    stack: [],
    index: -1
  },
  cursor: null,
  wordCount: {
    paragraph: 0,
    word: 0,
    character: 0,
    all: 0
  },
  searchMatches: {
    index: -1,
    matches: [],
    value: ''
  },
  notifications: []
}

export const getOptionsFromState = (file: Pick<DocumentState, 'encoding' | 'lineEnding' | 'adjustLineEndingOnSave' | 'trimTrailingNewline'>): MarkdownDocumentOptions => {
  const { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline } = file
  return { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline }
}

export const getFileStateFromData = (data: DocumentStateInput): DocumentState => {
  const fileState = JSON.parse(JSON.stringify(defaultFileState)) as Omit<DocumentState, 'id'>
  const {
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline
  } = data
  const id = data.id ?? getUniqueId()

  assertLineEnding(adjustLineEndingOnSave, lineEnding)

  return Object.assign(fileState, {
    id,
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline
  })
}

export const getBlankFileState = (
  tabs: Array<Pick<DocumentState, 'pathname' | 'filename'>>,
  defaultEncoding = 'utf8',
  lineEnding: 'lf' | 'crlf' = 'lf',
  markdown = ''
): DocumentState => {
  const fileState = cloneObj(defaultFileState, true) as Omit<DocumentState, 'id'>
  let untitleId = Math.max(...tabs.map(file => {
    if (file.pathname === '') {
      return Number(file.filename.split('-')[1])
    }
    return 0
  }), 0)

  const id = getUniqueId()
  const nextMarkdown = markdown == null ? '' : markdown

  fileState.encoding.encoding = defaultEncoding
  return Object.assign(fileState, {
    id,
    lineEnding,
    adjustLineEndingOnSave: lineEnding.toLowerCase() === 'crlf',
    filename: `Untitled-${++untitleId}`,
    markdown: nextMarkdown
  })
}

export const getSingleFileState = (input: {
  id?: string
  markdown: string
  filename: string
  pathname: string
  options: MarkdownDocumentOptions
}): DocumentState => {
  const fileState = cloneObj(defaultFileState, true) as Omit<DocumentState, 'id'>
  const {
    id = getUniqueId(),
    markdown,
    filename,
    pathname,
    options
  } = input
  const { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline } = options

  assertLineEnding(adjustLineEndingOnSave, lineEnding)

  return Object.assign(fileState, {
    id,
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline
  })
}

export const createDocumentState = (
  markdownDocument: DocumentStateInput,
  id = getUniqueId()
): DocumentState => {
  const docState = cloneObj(defaultFileState, true) as Omit<DocumentState, 'id'>
  const {
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline,
    cursor = null
  } = markdownDocument

  assertLineEnding(adjustLineEndingOnSave, lineEnding)

  return Object.assign(docState, {
    id,
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    cursor,
    adjustLineEndingOnSave,
    trimTrailingNewline
  })
}

const assertLineEnding = (adjustLineEndingOnSave: boolean, lineEnding: string): void => {
  const normalizedLineEnding = lineEnding.toLowerCase()
  if ((adjustLineEndingOnSave && normalizedLineEnding !== 'crlf') ||
    (!adjustLineEndingOnSave && normalizedLineEnding === 'crlf')) {
    console.error('Assertion failed: Line ending is "CRLF" but document is saved as "LF".')
  }
}
