import { COMMANDS } from '../../commands'
import type { Menu } from 'electron'

type WindowLike = {
  webContents?: {
    send(channel: string, payload?: unknown): void
  }
} | null | undefined

interface SelectionMenuState {
  affiliation: Record<string, boolean>
  isDisabled?: boolean
  isMultiline?: boolean
  isCodeFences?: boolean
  isCodeContent?: boolean
  isLooseListItem?: boolean
  isTaskList?: boolean
  isTable?: boolean
}

const DISABLE_LABELS = [
  'heading1MenuItem', 'heading2MenuItem', 'heading3MenuItem', 'heading4MenuItem',
  'heading5MenuItem', 'heading6MenuItem',
  'upgradeHeadingMenuItem', 'degradeHeadingMenuItem',
  'tableMenuItem',
  'hyperlinkMenuItem', 'imageMenuItem'
] as const

const MENU_ID_MAP = Object.freeze({
  heading1MenuItem: 'h1',
  heading2MenuItem: 'h2',
  heading3MenuItem: 'h3',
  heading4MenuItem: 'h4',
  heading5MenuItem: 'h5',
  heading6MenuItem: 'h6',
  tableMenuItem: 'figure',
  codeFencesMenuItem: 'pre',
  htmlBlockMenuItem: 'html',
  mathBlockMenuItem: 'multiplemath',
  quoteBlockMenuItem: 'blockquote',
  orderListMenuItem: 'ol',
  bulletListMenuItem: 'ul',
  paragraphMenuItem: 'p',
  horizontalLineMenuItem: 'hr',
  frontMatterMenuItem: 'frontmatter'
} as const)

const transformEditorElement = (win: WindowLike, type: string): void => {
  win?.webContents?.send('mt::editor-paragraph-action', { type })
}

export const bulletList = (win: WindowLike): void => {
  transformEditorElement(win, 'ul-bullet')
}

export const codeFence = (win: WindowLike): void => {
  transformEditorElement(win, 'pre')
}

export const degradeHeading = (win: WindowLike): void => {
  transformEditorElement(win, 'degrade heading')
}

export const frontMatter = (win: WindowLike): void => {
  transformEditorElement(win, 'front-matter')
}

export const heading1 = (win: WindowLike): void => {
  transformEditorElement(win, 'heading 1')
}

export const heading2 = (win: WindowLike): void => {
  transformEditorElement(win, 'heading 2')
}

export const heading3 = (win: WindowLike): void => {
  transformEditorElement(win, 'heading 3')
}

export const heading4 = (win: WindowLike): void => {
  transformEditorElement(win, 'heading 4')
}

export const heading5 = (win: WindowLike): void => {
  transformEditorElement(win, 'heading 5')
}

export const heading6 = (win: WindowLike): void => {
  transformEditorElement(win, 'heading 6')
}

export const horizontalLine = (win: WindowLike): void => {
  transformEditorElement(win, 'hr')
}

export const htmlBlock = (win: WindowLike): void => {
  transformEditorElement(win, 'html')
}

export const looseListItem = (win: WindowLike): void => {
  transformEditorElement(win, 'loose-list-item')
}

export const mathFormula = (win: WindowLike): void => {
  transformEditorElement(win, 'mathblock')
}

export const orderedList = (win: WindowLike): void => {
  transformEditorElement(win, 'ol-order')
}

export const paragraph = (win: WindowLike): void => {
  transformEditorElement(win, 'paragraph')
}

export const quoteBlock = (win: WindowLike): void => {
  transformEditorElement(win, 'blockquote')
}

export const table = (win: WindowLike): void => {
  transformEditorElement(win, 'table')
}

export const taskList = (win: WindowLike): void => {
  transformEditorElement(win, 'ul-task')
}

export const increaseHeading = (win: WindowLike): void => {
  transformEditorElement(win, 'upgrade heading')
}

export const loadParagraphCommands = (commandManager: { add(id: string, callback: unknown): void }): void => {
  commandManager.add(COMMANDS.PARAGRAPH_BULLET_LIST, bulletList)
  commandManager.add(COMMANDS.PARAGRAPH_CODE_FENCE, codeFence)
  commandManager.add(COMMANDS.PARAGRAPH_DEGRADE_HEADING, degradeHeading)
  commandManager.add(COMMANDS.PARAGRAPH_FRONT_MATTER, frontMatter)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_1, heading1)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_2, heading2)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_3, heading3)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_4, heading4)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_5, heading5)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_6, heading6)
  commandManager.add(COMMANDS.PARAGRAPH_HORIZONTAL_LINE, horizontalLine)
  commandManager.add(COMMANDS.PARAGRAPH_HTML_BLOCK, htmlBlock)
  commandManager.add(COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM, looseListItem)
  commandManager.add(COMMANDS.PARAGRAPH_MATH_FORMULA, mathFormula)
  commandManager.add(COMMANDS.PARAGRAPH_ORDERED_LIST, orderedList)
  commandManager.add(COMMANDS.PARAGRAPH_PARAGRAPH, paragraph)
  commandManager.add(COMMANDS.PARAGRAPH_QUOTE_BLOCK, quoteBlock)
  commandManager.add(COMMANDS.PARAGRAPH_TABLE, table)
  commandManager.add(COMMANDS.PARAGRAPH_TASK_LIST, taskList)
  commandManager.add(COMMANDS.PARAGRAPH_INCREASE_HEADING, increaseHeading)
}

const setParagraphMenuItemStatus = (applicationMenu: Menu, enabled: boolean): void => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem?.submenu?.items.forEach(item => {
    item.enabled = enabled
  })
}

const setMultipleStatus = (applicationMenu: Menu, list: readonly string[], status: boolean): void => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem?.submenu?.items
    .filter(item => !!item.id && list.includes(item.id))
    .forEach(item => {
      item.enabled = status
    })
}

const setCheckedMenuItem = (applicationMenu: Menu, state: SelectionMenuState): void => {
  const { affiliation, isTable, isLooseListItem, isTaskList } = state
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem?.submenu?.items.forEach(item => {
    item.checked = false
  })
  paragraphMenuItem?.submenu?.items.forEach(item => {
    if (!item.id) {
      return
    }

    if (item.id === 'looseListItemMenuItem') {
      item.checked = !!isLooseListItem
      return
    }

    const shouldCheck = Object.keys(affiliation).some(block => {
      if (block === 'ul' && isTaskList) {
        return item.id === 'taskListMenuItem'
      } else if (isTable && item.id === 'tableMenuItem') {
        return true
      } else if (item.id === 'codeFencesMenuItem' && /code$/.test(block)) {
        return true
      }
      return MENU_ID_MAP[item.id as keyof typeof MENU_ID_MAP] === block
    })

    if (shouldCheck) {
      item.checked = true
    }
  })
}

export const updateSelectionMenus = (applicationMenu: Menu, state: SelectionMenuState): void => {
  const {
    affiliation,
    isDisabled = false,
    isMultiline = false,
    isCodeFences = false,
    isCodeContent = false
  } = state

  const formatMenuItem = applicationMenu.getMenuItemById('formatMenuItem')
  formatMenuItem?.submenu?.items.forEach(item => {
    item.enabled = true
  })

  setCheckedMenuItem(applicationMenu, state)

  setParagraphMenuItemStatus(applicationMenu, !isDisabled)
  if (isDisabled) {
    return
  }

  if (isCodeFences) {
    setParagraphMenuItemStatus(applicationMenu, false)
    if (isCodeContent) {
      const formatMenuItem = applicationMenu.getMenuItemById('formatMenuItem')
      formatMenuItem?.submenu?.items.forEach(item => {
        item.enabled = false
      })
    }
    return
  }

  if (isMultiline) {
    setMultipleStatus(applicationMenu, DISABLE_LABELS, false)
  }

  if (Object.keys(affiliation).length > 0) {
    const disableHeading = !affiliation.p && !affiliation.blockquote
    setMultipleStatus(applicationMenu, [
      'heading1MenuItem',
      'heading2MenuItem',
      'heading3MenuItem',
      'heading4MenuItem',
      'heading5MenuItem',
      'heading6MenuItem',
      'upgradeHeadingMenuItem',
      'degradeHeadingMenuItem'
    ], !disableHeading)
  }
}
