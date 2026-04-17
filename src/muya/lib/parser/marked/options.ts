interface MarkedOptions {
  baseUrl: string | null
  breaks: boolean
  gfm: boolean
  headerIds: boolean
  headerPrefix: string
  highlight: ((code: string, lang?: string) => string) | null
  mathRenderer: ((content: string) => string) | null
  emojiRenderer: ((content: string) => string) | null
  tocRenderer: ((content: string) => string) | null
  langPrefix: string
  mangle: boolean
  pedantic: boolean
  renderer: unknown
  silent: boolean
  smartLists: boolean
  smartypants: boolean
  xhtml: boolean
  disableInline: boolean
  sanitize: boolean
  sanitizer: ((html: string) => string) | null
  emoji: boolean
  math: boolean
  frontMatter: boolean
  superSubScript: boolean
  footnote: boolean
  isGitlabCompatibilityEnabled: boolean
  isHtmlEnabled: boolean
}

const options: MarkedOptions = {
  baseUrl: null,
  breaks: false,
  gfm: true,
  headerIds: true,
  headerPrefix: '',
  highlight: null,
  mathRenderer: null,
  emojiRenderer: null,
  tocRenderer: null,
  langPrefix: 'language-',
  mangle: true,
  pedantic: false,
  renderer: null,
  silent: false,
  smartLists: false,
  smartypants: false,
  xhtml: false,
  disableInline: false,
  sanitize: false,
  sanitizer: null,
  emoji: true,
  math: true,
  frontMatter: true,
  superSubScript: false,
  footnote: false,
  isGitlabCompatibilityEnabled: false,
  isHtmlEnabled: true
}

export type { MarkedOptions }
export default options
