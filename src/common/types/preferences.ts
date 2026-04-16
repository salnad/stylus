export type TitleBarStyle = 'custom' | 'native'
export type FileSortBy = 'modified' | 'created' | 'title'
export type StartUpAction = 'folder' | 'lastState' | 'blank'
export type EndOfLineSetting = 'default' | 'lf' | 'crlf'
export type TextDirection = 'ltr' | 'rtl'
export type ImageInsertAction = 'upload' | 'folder' | 'path'
export type BulletListMarker = '-' | '*' | '+'
export type OrderListDelimiter = '.' | ')'
export type HeadingStyle = 'atx' | 'setext'
export type ListIndentation = 'dfm' | 'tab' | 1 | 2 | 3 | 4
export type FrontmatterType = '-' | '+' | ';' | '{'
export type SequenceTheme = 'hand' | 'simple'
export type AutoSwitchTheme = 0 | 1 | 2

export interface PreferenceState {
  autoSave: boolean
  autoSaveDelay: number
  titleBarStyle: TitleBarStyle
  openFilesInNewWindow: boolean
  openFolderInNewWindow: boolean
  zoom: number
  hideScrollbar: boolean
  wordWrapInToc: boolean
  fileSortBy: FileSortBy
  startUpAction: StartUpAction
  defaultDirectoryToOpen: string
  language: string
  editorFontFamily: string
  fontSize: number
  lineHeight: number
  codeFontSize: number
  codeFontFamily: string
  codeBlockLineNumbers: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  editorLineWidth: string
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  endOfLine: EndOfLineSetting
  defaultEncoding: string
  autoGuessEncoding: boolean
  trimTrailingNewline: number
  textDirection: TextDirection
  hideQuickInsertHint: boolean
  imageInsertAction: ImageInsertAction
  imagePreferRelativeDirectory: boolean
  imageRelativeDirectoryName: string
  hideLinkPopup: boolean
  autoCheck: boolean
  preferLooseListItem: boolean
  bulletListMarker: BulletListMarker
  orderListDelimiter: OrderListDelimiter
  preferHeadingStyle: HeadingStyle
  tabSize: number
  listIndentation: ListIndentation
  frontmatterType: FrontmatterType
  superSubScript: boolean
  footnote: boolean
  isHtmlEnabled: boolean
  isGitlabCompatibilityEnabled: boolean
  sequenceTheme: SequenceTheme
  theme: string
  autoSwitchTheme: AutoSwitchTheme
  spellcheckerEnabled: boolean
  spellcheckerNoUnderline: boolean
  spellcheckerLanguage: string
  sideBarVisibility: boolean
  tabBarVisibility: boolean
  sourceCodeModeEnabled: boolean
  searchExclusions: string[]
  searchMaxFileSize: string
  searchIncludeHidden: boolean
  searchNoIgnore: boolean
  searchFollowSymlinks: boolean
  watcherUsePolling: boolean
}

export type PreferenceKey = keyof PreferenceState
