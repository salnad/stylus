const FUNCTION_TYPE_LANG: Record<string, string> = {
  multiplemath: 'latex',
  flowchart: 'yaml',
  mermaid: 'yaml',
  sequence: 'yaml',
  plantuml: 'yaml',
  'vega-lite': 'yaml',
  html: 'markup'
}

type FunctionType = keyof typeof FUNCTION_TYPE_LANG | string

type MathStyle = string | undefined

interface CursorPosition {
  key: string
  offset: number
}

interface BlockLike {
  key: string
  type: string
  text: string
  children: BlockLike[]
  editable?: boolean
  functionType?: string
  lang?: string
  mathStyle?: string
  [key: string]: unknown
}

interface CreatePreAndPreviewResult {
  preBlock: BlockLike
  preview: BlockLike
}

interface ContentStateLike {
  isGitlabCompatibilityEnabled: boolean
  cursor: {
    start: CursorPosition
    end: CursorPosition
  }
  createBlock(type?: string, extras?: Record<string, unknown>): BlockLike
  appendChild(parent: BlockLike, block: BlockLike): void
  createPreAndPreview(functionType: FunctionType, value?: string): CreatePreAndPreviewResult
  getBlock(key: string): BlockLike
  partialRender(): void
}

interface ContainerCtrlMethods {
  createContainerBlock(functionType: FunctionType, value?: string, style?: MathStyle): BlockLike
  createPreAndPreview(functionType: FunctionType, value?: string): CreatePreAndPreviewResult
  initContainerBlock(functionType: FunctionType, block: BlockLike, style?: MathStyle): BlockLike
  handleContainerBlockClick(figureEle: HTMLElement): void
  updateMathBlock(block: BlockLike): BlockLike | false
}

type ContentStateConstructor = {
  prototype: unknown
}

const containerCtrl = (ContentState: ContentStateConstructor): void => {
  const prototype = ContentState.prototype as ContentStateLike & ContainerCtrlMethods

  prototype.createContainerBlock = function (functionType: FunctionType, value = '', style: MathStyle = undefined): BlockLike {
    const figureBlock = this.createBlock('figure', {
      functionType
    })

    if (functionType === 'multiplemath') {
      if (style === undefined) {
        figureBlock.mathStyle = this.isGitlabCompatibilityEnabled ? 'gitlab' : ''
      }
      figureBlock.mathStyle = style
    }

    const { preBlock, preview } = this.createPreAndPreview(functionType, value)
    this.appendChild(figureBlock, preBlock)
    this.appendChild(figureBlock, preview)
    return figureBlock
  }

  prototype.createPreAndPreview = function (functionType: FunctionType, value = ''): CreatePreAndPreviewResult {
    const lang = FUNCTION_TYPE_LANG[functionType]
    const preBlock = this.createBlock('pre', {
      functionType,
      lang
    })
    const codeBlock = this.createBlock('code', {
      lang
    })

    this.appendChild(preBlock, codeBlock)

    if (typeof value === 'string' && value) {
      value = value.replace(/^\s+/, '')
      const codeContent = this.createBlock('span', {
        text: value,
        lang,
        functionType: 'codeContent'
      })
      this.appendChild(codeBlock, codeContent)
    } else {
      const emptyCodeContent = this.createBlock('span', {
        functionType: 'codeContent',
        lang
      })

      this.appendChild(codeBlock, emptyCodeContent)
    }

    const preview = this.createBlock('div', {
      editable: false,
      functionType
    })

    return { preBlock, preview }
  }

  prototype.initContainerBlock = function (functionType: FunctionType, block: BlockLike, style: MathStyle = undefined): BlockLike {
    block.type = 'figure'
    block.functionType = functionType
    block.children = []

    if (functionType === 'multiplemath') {
      if (style === undefined) {
        block.mathStyle = this.isGitlabCompatibilityEnabled ? 'gitlab' : ''
      }
      block.mathStyle = style
    }

    const { preBlock, preview } = this.createPreAndPreview(functionType)

    this.appendChild(block, preBlock)
    this.appendChild(block, preview)
    return preBlock.children[0].children[0]
  }

  prototype.handleContainerBlockClick = function (figureEle: HTMLElement): void {
    const { id } = figureEle
    const mathBlock = this.getBlock(id)
    const preBlock = mathBlock.children[0]
    const firstLine = preBlock.children[0].children[0]

    const { key } = firstLine
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }

  prototype.updateMathBlock = function (block: BlockLike): BlockLike | false {
    const functionType = 'multiplemath'
    const { type } = block

    // TODO(GitLab): Allow "functionType" 'languageInput' to convert an existing
    //   code block into math block.
    if (type === 'span' && block.functionType === 'paragraphContent') {
      const isMathBlock = !!block.text.match(/^`{3,}math\s*/)
      if (isMathBlock) {
        const result = this.initContainerBlock(functionType, block, 'gitlab')
        if (result) {
          // Set cursor at the first line
          const { key } = result
          const offset = 0
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }

          // Force render
          this.partialRender()
          return result
        }
      }
      return false
    } else if (type !== 'p') {
      return false
    }

    const { text } = block.children[0]
    return text.trim() === '$$' ? this.initContainerBlock(functionType, block, '') : false
  }
}

export default containerCtrl
