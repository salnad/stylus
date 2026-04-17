import {
  init,
  classModule,
  attributesModule,
  datasetModule,
  propsModule,
  styleModule,
  eventListenersModule,
  h as createH,
  toVNode as createToVNode,
  type VNode,
  type VNodeChildElement,
  type VNodeChildren,
  type Module
} from 'snabbdom'
import toHTML from 'snabbdom-to-html'

const modules: Module[] = [
  classModule,
  attributesModule,
  styleModule,
  propsModule,
  datasetModule,
  eventListenersModule
]

export const patch = init(modules)

export const h = createH
export const toVNode = createToVNode
export { toHTML }

export type HtmlVNode = VNode
export type HtmlVNodeChild = VNodeChildElement
export type HtmlVNodeChildren = VNodeChildren

export const htmlToVNode = (html: string): VNode[] => {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  return (toVNode(wrapper).children || []) as VNode[]
}
