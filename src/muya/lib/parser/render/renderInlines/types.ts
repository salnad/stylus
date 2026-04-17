import type {
  BlockLike,
  CursorRangeLike,
  MuyaLike,
  RenderChildren,
  RenderVNode,
  SnabbdomHelper
} from '../renderBlock/types'

export type {
  BlockLike,
  CursorRangeLike,
  RenderChildren,
  RenderVNode,
  SnabbdomDataLike,
  SnabbdomHelper
} from '../renderBlock/types'

export interface ImageAttrs {
  alt?: string
  src?: string
  title?: string
  width?: number
  height?: number
  'data-align'?: string
  [key: string]: string | number | boolean | undefined
}

export interface HtmlAttrs {
  id?: string
  class?: string
  [key: string]: string | number | boolean | undefined
}

export interface LabelValue {
  href: string
  title: string
}

export interface LoadImageAsyncResult {
  id?: string
  isSuccess?: boolean
  domsrc?: string
  width?: number
  height?: number
}

export interface LoadedImageCacheValue extends LoadImageAsyncResult {
  dispMsec?: number
  touchMsec?: number
}

export interface ImageInfoLike {
  src: string
  isUnknownType?: boolean
}

export interface TokenRangeLike {
  start: number
  end: number
}

export interface InlineHighlightLike {
  start: number
  end: number
  active: boolean | undefined
}

export interface TokenLike {
  type: string
  range: TokenRangeLike
  children?: TokenLike[] | string
  highlights?: InlineHighlightLike[]
  [key: string]: unknown
}

export interface SelectedImageTokenLike {
  attrs: ImageAttrs
  range: {
    start: number
    end: number
  }
}

export interface SelectedImageLike {
  key: string
  token: SelectedImageTokenLike
  imageId?: string
}

type BaseInlineContentStateLike = MuyaLike['contentState']

export interface InlineContentStateLike extends BaseInlineContentStateLike {
  selectedImage?: SelectedImageLike | null
}

export interface InlineMuyaLike extends Omit<MuyaLike, 'contentState'> {
  contentState: InlineContentStateLike
}

export type HighlightTokenLike = TokenLike

export type HtmlToVNodeLike = (html: string) => RenderChildren

export type InlineRenderChunk = RenderChildren | RenderVNode | string

export interface InlineRenderContextLike {
  muya: InlineMuyaLike
  labels: Map<string, LabelValue>
  loadImageMap: Map<string, LoadedImageCacheValue>
  loadMathMap: Map<string, RenderChildren>
  urlMap: Map<string, string>
  getClassName(
    outerClass: string | undefined,
    block: BlockLike,
    token: TokenLike,
    cursor: CursorRangeLike
  ): string
  highlight(
    createVNode: SnabbdomHelper,
    block: BlockLike,
    start: number,
    end: number,
    token: TokenLike | HighlightTokenLike
  ): RenderChildren
  getHighlightClassName(active: boolean | undefined): string
  backlashInToken(
    createVNode: SnabbdomHelper,
    backlashes: string,
    outerClass: string,
    start: number,
    token: TokenLike | HighlightTokenLike
  ): RenderChildren
  delEmStrongFac(
    type: 'del' | 'em' | 'strong',
    createVNode: SnabbdomHelper,
    cursor: CursorRangeLike,
    block: BlockLike,
    token: TokenLike,
    outerClass?: string
  ): RenderChildren
  htmlRuby(
    createVNode: SnabbdomHelper,
    cursor: CursorRangeLike,
    block: BlockLike,
    token: TokenLike,
    outerClass?: string
  ): RenderChildren
  image(
    createVNode: SnabbdomHelper,
    cursor: CursorRangeLike,
    block: BlockLike,
    token: TokenLike,
    outerClass?: string
  ): RenderChildren
  loadImageAsync(
    imageInfo: ImageInfoLike,
    attrs: ImageAttrs,
    className?: string,
    imageClass?: string
  ): LoadImageAsyncResult
  [methodName: string]: unknown
}

export type InlineRenderer<TToken extends TokenLike = TokenLike, TResult = InlineRenderChunk> = (
  this: InlineRenderContextLike,
  createVNode: SnabbdomHelper,
  cursor: CursorRangeLike,
  block: BlockLike,
  token: TToken,
  outerClass?: string
) => TResult
