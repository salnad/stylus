import fs from 'fs'
import path from 'path'

const loadMarkdownContent = (pathname: string): string => {
  // Load file and ensure LF line endings.
  return fs.readFileSync(path.resolve('test/unit/data', pathname), 'utf-8').replace(/(?:\r\n|\n)/g, '\n')
}

export const BasicTextFormattingTemplate = (): string => {
  return loadMarkdownContent('common/BasicTextFormatting.md')
}

export const BlockquotesTemplate = (): string => {
  return loadMarkdownContent('common/Blockquotes.md')
}

export const CodeBlocksTemplate = (): string => {
  return loadMarkdownContent('common/CodeBlocks.md')
}

export const EscapesTemplate = (): string => {
  return loadMarkdownContent('common/Escapes.md')
}

export const HeadingsTemplate = (): string => {
  return loadMarkdownContent('common/Headings.md')
}

export const ImagesTemplate = (): string => {
  return loadMarkdownContent('common/Images.md')
}

export const LinksTemplate = (): string => {
  return loadMarkdownContent('common/Links.md')
}

export const ListsTemplate = (): string => {
  return loadMarkdownContent('common/Lists.md')
}

// --------------------------------------------------------
// GFM templates
//

export const GfmBasicTextFormattingTemplate = (): string => {
  return loadMarkdownContent('gfm/BasicTextFormatting.md')
}

export const GfmListsTemplate = (): string => {
  return loadMarkdownContent('gfm/Lists.md')
}

export const GfmTablesTemplate = (): string => {
  return loadMarkdownContent('gfm/Tables.md')
}
