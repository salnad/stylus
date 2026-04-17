import TurndownService from 'turndown'
import { gfm } from 'joplin-turndown-plugin-gfm'
import { identity } from './index'

type KeepSelector = string

interface RuleNodeLike {
  nodeName: string
  classList?: {
    contains(className: string): boolean
  }
  previousElementSibling?: Element | null
  parentNode?: ParentNode | null
  nextSibling?: Node | null
}

interface TurndownOptionsLike {
  bulletListMarker: string
  [key: string]: unknown
}

interface TurndownRule {
  filter: string | string[] | ((node: RuleNodeLike, options: TurndownOptionsLike) => boolean)
  replacement(content: string, node: RuleNodeLike, options: TurndownOptionsLike): string
}

interface TurndownServiceLike {
  use(plugin: unknown): void
  addRule(name: string, rule: TurndownRule): void
  keep(selectors: KeepSelector[]): void
  escape: typeof identity
}

export const usePluginAddRules = (turndownService: TurndownServiceLike, keeps: KeepSelector[]): void => {
  // Use the gfm plugin
  turndownService.use(gfm)

  // We need a extra strikethrough rule because the strikethrough rule in gfm is single `~`.
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement (content) {
      return '~~' + content + '~~'
    }
  })

  turndownService.addRule('paragraph', {
    filter: 'p',

    replacement (content, node) {
      const isTaskListItemParagraph = node.previousElementSibling?.tagName === 'INPUT'

      return isTaskListItemParagraph ? content + '\n\n' : '\n\n' + content + '\n\n'
    }
  })

  turndownService.addRule('listItem', {
    filter: 'li',

    replacement (content, node, options) {
      content = content
        .replace(/^\n+/, '') // remove leading newlines
        .replace(/\n+$/, '\n') // replace trailing newlines with just a single one
        .replace(/\n/gm, '\n  ') // indent

      let prefix = options.bulletListMarker + ' '
      const parent = node.parentNode
      if (parent?.nodeName === 'OL') {
        const start = parent instanceof Element ? parent.getAttribute('start') : null
        const index = Array.prototype.indexOf.call(parent.children, node)
        prefix = (start ? Number(start) + index : index + 1) + '. '
      }
      return (
        prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
      )
    }
  })

  // Handle multiple math lines
  turndownService.addRule('multiplemath', {
    filter (node) {
      return node.nodeName === 'PRE' && node.classList?.contains('multiple-math') === true
    },
    replacement (content) {
      return `$$\n${content}\n$$`
    }
  })

  turndownService.escape = identity
  turndownService.keep(keeps)
}

export default TurndownService
