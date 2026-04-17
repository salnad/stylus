import BaseScrollFloat from '../baseScrollFloat'
import type {
  BaseFloatCallback,
  BaseFloatEventCenterLike,
  BaseFloatOptions,
  FloatReference,
  MuyaLike as BaseFloatMuyaLike
} from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { search } from '../../prism/index'
import fileIcons from '../fileIcons'

import './index.css'

type RenderVNode = Parameters<typeof patch>[1]
type RenderTarget = Parameters<typeof patch>[0]

interface SearchLanguageEntry {
  name: string
  title?: string
  alias?: string | string[]
  [key: string]: unknown
}

type CodePickerCallback = (item: SearchLanguageEntry | null) => void

interface CodePickerEventPayload {
  reference: FloatReference | null
  lang?: string
  cb?: CodePickerCallback
}

interface CodePickerEventCenterLike extends BaseFloatEventCenterLike {
  subscribe(event: 'muya-code-picker', listener: (payload: CodePickerEventPayload) => void): void
}

interface FileIconsLike {
  getClassByLanguage(lang: string): string | null
  getClassByName(name: string): string | null
}

interface SnabbdomDataLike {
  dataset?: Record<string, string>
  on?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

type SnabbdomHelper = {
  (selector: string, children?: unknown): RenderVNode
  (selector: string, data: SnabbdomDataLike, children?: unknown): RenderVNode
}

const createVNode = h as unknown as SnabbdomHelper
const fileIconsApi = fileIcons as FileIconsLike

const defaultOptions: Partial<BaseFloatOptions> = {
  placement: 'bottom-start',
  modifiers: {
    offset: {
      offset: '0, 0'
    }
  },
  showArrow: false
}

class CodePicker extends BaseScrollFloat<SearchLanguageEntry> {
  static pluginName = 'codePicker'

  oldVnode: RenderVNode | null

  constructor (muya: BaseFloatMuyaLike, options: Partial<BaseFloatOptions> = {}) {
    const name = 'ag-list-picker'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.renderArray = []
    this.oldVnode = null
    this.activeItem = null
    this.listen()
  }

  listen (): void {
    super.listen()
    const { eventCenter } = this.muya as unknown as { eventCenter: CodePickerEventCenterLike }
    eventCenter.subscribe('muya-code-picker', ({ reference, lang, cb }) => {
      if (!reference || !lang || !cb) {
        this.hide()
        return
      }

      const modes = search(lang)
      if (modes.length) {
        this.show(reference, cb as unknown as BaseFloatCallback)
        this.renderArray = modes
        this.activeItem = modes[0]
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render (): void {
    const { renderArray, oldVnode, scrollElement, activeItem } = this
    const listContent: RenderVNode[] | RenderVNode = renderArray.length === 0
      ? createVNode('div.no-result', 'No result')
      : renderArray.map(item => {
        let iconClassNames: string | null = null

        if (item.name) {
          iconClassNames = fileIconsApi.getClassByLanguage(item.name)
        }

        // Because `markdown mode in Codemirror` don't have extensions.
        // if still can not get the className, add a common className 'atom-icon light-cyan'
        if (!iconClassNames) {
          iconClassNames = item.name === 'markdown'
            ? fileIconsApi.getClassByName('fackname.md') || 'atom-icon light-cyan'
            : 'atom-icon light-cyan'
        }

        const iconSelector = 'span' + iconClassNames.split(/\s/).map(s => `.${s}`).join('')
        const icon = createVNode('div.icon-wrapper', createVNode(iconSelector))
        const text = createVNode('div.language', item.name)
        const selector = activeItem === item ? 'li.item.active' : 'li.item'
        return createVNode(selector, {
          dataset: {
            label: item.name
          },
          on: {
            click: () => {
              this.selectItem(item)
            }
          }
        }, [icon, text])
      })

    const vnode = createVNode('ul', listContent)

    if (oldVnode) {
      patch(oldVnode as RenderTarget, vnode)
    } else {
      patch(scrollElement as RenderTarget, vnode)
    }
    this.oldVnode = vnode
  }

  getItemElement (item: SearchLanguageEntry | null): Element | null {
    const name = item?.name
    if (!name) {
      return null
    }

    return this.floatBox.querySelector(`[data-label="${name}"]`)
  }
}

export default CodePicker
