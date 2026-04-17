import ContentState from '../../../src/muya/lib/contentState'
import EventCenter from '../../../src/muya/lib/eventHandler/event'
import ExportMarkdown from '../../../src/muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from '../../../src/muya/lib/config'

type ListIndentation = number | string

interface TestContentState extends ContentState {
  importMarkdown(markdown: string): void
}

interface MuyaListContext {
  options: Record<string, unknown>
  eventCenter: EventCenter
  contentState: TestContentState
}

const createMuyaContext = (listIdentation: ListIndentation): MuyaListContext => {
  const ctx = {} as MuyaListContext
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, { listIdentation })
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx as unknown as ConstructorParameters<typeof ContentState>[0], ctx.options) as TestContentState
  return ctx
}

// ----------------------------------------------------------------------------
// Muya parser (Markdown to HTML to Markdown)
//

const verifyMarkdown = (expectedMarkdown: string, listIdentation: ListIndentation, markdown = ''): void => {
  if (!markdown) {
    markdown = `start

- foo
- foo
  - foo
  - foo
    - foo
    - foo
      - foo
  - foo
- foo

sep

1. foo
2. foo
   1. foo
   2. foo
      1. foo
   3. foo
3. foo
   20. foo
       141. foo
            1. foo
`
  }

  const ctx = createMuyaContext(listIdentation)
  ctx.contentState.importMarkdown(markdown)

  const blocks = ctx.contentState.getBlocks()
  const exportedMarkdown = new ExportMarkdown(blocks, listIdentation).generate()
  expect(exportedMarkdown).to.equal(expectedMarkdown)
}

describe('Muya list identation', () => {
  it('Indent by 1 space', () => {
    const md = `start

- foo
- foo
  - foo
  - foo
    - foo
    - foo
      - foo
  - foo
- foo

sep

1. foo
2. foo
   1. foo
   2. foo
      1. foo
   3. foo
3. foo
   20. foo
       141. foo
            1. foo
`
    verifyMarkdown(md, 1)
  })
  it('Indent by 2 spaces', () => {
    const md = `start

- foo
- foo
   - foo
   - foo
      - foo
      - foo
         - foo
   - foo
- foo

sep

1. foo
2. foo
    1. foo
    2. foo
        1. foo
    3. foo
3. foo
    20. foo
         141. foo
               1. foo
`
    verifyMarkdown(md, 2)
  })
  it('Indent by 3 spaces', () => {
    const md = `start

- foo
- foo
    - foo
    - foo
        - foo
        - foo
            - foo
    - foo
- foo

sep

1. foo
2. foo
     1. foo
     2. foo
          1. foo
     3. foo
3. foo
     20. foo
           141. foo
                  1. foo
`
    verifyMarkdown(md, 3)
  })
  it('Indent by 4 spaces', () => {
    const md = `start

- foo
- foo
     - foo
     - foo
          - foo
          - foo
               - foo
     - foo
- foo

sep

1. foo
2. foo
      1. foo
      2. foo
            1. foo
      3. foo
3. foo
      20. foo
             141. foo
                     1. foo
`

    verifyMarkdown(md, 4)
  })
  /*  it('Indent by one tab', () => {
    const md = `start

- foo
- foo
\t- foo
\t- foo
\t\t- foo
\t\t- foo
\t\t\t- foo
\t- foo
- foo

sep

1. foo
2. foo
\t1. foo
\t2. foo
\t\t1. foo
\t3. foo
3. foo
\t20. foo
\t\t141. foo
\t\t\t1. foo
`
    verifyMarkdown(md, "tab")
  }) */
  it('Indent using Daring Fireball Markdown Spec', () => {
    const md = `start

- foo
- foo
    - foo
    - foo
        - foo
        - foo
            - foo
    - foo
- foo

sep

1. foo
2. foo
    1. foo
    2. foo
        1. foo
    3. foo
3. foo
    20. foo
        99. foo
            1. foo
`

    verifyMarkdown(md, 'dfm', md)
  })
})
