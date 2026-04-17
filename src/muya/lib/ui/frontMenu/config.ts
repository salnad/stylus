import copyIcon from '../../assets/pngicon/copy/2.png'
import newIcon from '../../assets/pngicon/paragraph/2.png'
import deleteIcon from '../../assets/pngicon/delete/2.png'
import turnIcon from '../../assets/pngicon/turninto/2.png'
import { isOsx } from '../../config'
import { quickInsertObj, type QuickInsertMenuItem } from '../quickInsert/config'

interface FrontMenuItem {
  icon: string
  label: string
  text: string
  shortCut?: string
}

interface BlockLike {
  type: string
  functionType?: string
  listType?: string
}

const wholeSubMenu: QuickInsertMenuItem[] = Object.values(quickInsertObj).reduce<QuickInsertMenuItem[]>((acc, items) => {
  return [...acc, ...items]
}, [])

const COMMAND_KEY = isOsx ? '⌘' : '⌃'

export const menu: FrontMenuItem[] = [{
  icon: copyIcon,
  label: 'duplicate',
  text: 'Duplicate',
  shortCut: `⇧${COMMAND_KEY}P`
}, {
  icon: turnIcon,
  label: 'turnInto',
  text: 'Turn Into'
}, {
  icon: newIcon,
  label: 'new',
  text: 'New Paragraph',
  shortCut: `⇧${COMMAND_KEY}N`
}, {
  icon: deleteIcon,
  label: 'delete',
  text: 'Delete',
  shortCut: `⇧${COMMAND_KEY}D`
}]

export const getLabel = (block: BlockLike): string => {
  const { type, functionType, listType } = block
  switch (type) {
    case 'p':
      return 'paragraph'
    case 'figure':
      if (functionType === 'table') {
        return 'table'
      } else if (functionType === 'html') {
        return 'html'
      } else if (functionType === 'multiplemath') {
        return 'mathblock'
      }
      break
    case 'pre':
      if (functionType === 'fencecode' || functionType === 'indentcode') {
        return 'pre'
      } else if (functionType === 'frontmatter') {
        return 'front-matter'
      }
      break
    case 'ul':
      return listType === 'task' ? 'ul-task' : 'ul-bullet'
    case 'ol':
      return 'ol-order'
    case 'blockquote':
      return 'blockquote'
    case 'h1':
      return 'heading 1'
    case 'h2':
      return 'heading 2'
    case 'h3':
      return 'heading 3'
    case 'h4':
      return 'heading 4'
    case 'h5':
      return 'heading 5'
    case 'h6':
      return 'heading 6'
    case 'hr':
      return 'hr'
    default:
      break
  }
  return 'paragraph'
}

export const getSubMenu = (block: BlockLike, startBlock: { key: string }, endBlock: { key: string }): QuickInsertMenuItem[] => {
  const { type } = block
  switch (type) {
    case 'p':
      return wholeSubMenu.filter(menuItem => {
        const regExp = startBlock.key === endBlock.key
          ? /front-matter|hr|table/
          : /front-matter|hr|table|heading/

        return !regExp.test(menuItem.label)
      })
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return wholeSubMenu.filter(menuItem => /heading|paragraph/.test(menuItem.label))
    case 'ul':
    case 'ol':
      return wholeSubMenu.filter(menuItem => /ul|ol/.test(menuItem.label))
    default:
      return []
  }
}
