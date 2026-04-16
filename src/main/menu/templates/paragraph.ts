import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/paragraph'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

const withWindowAction = (
  handler: (focusedWindow?: BrowserWindow | null) => void
): NonNullable<MenuItemConstructorOptions['click']> => {
  return (_menuItem, focusedWindow) => {
    handler(focusedWindow)
  }
}

const paragraph = (keybindings: KeybindingsLike): MenuItemConstructorOptions => {
  const submenu: MenuItemConstructorOptions[] = [{
    id: 'heading1MenuItem',
    label: 'Heading 1',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.heading-1') ?? undefined,
    click: withWindowAction(actions.heading1)
  }, {
    id: 'heading2MenuItem',
    label: 'Heading 2',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.heading-2') ?? undefined,
    click: withWindowAction(actions.heading2)
  }, {
    id: 'heading3MenuItem',
    label: 'Heading 3',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.heading-3') ?? undefined,
    click: withWindowAction(actions.heading3)
  }, {
    id: 'heading4MenuItem',
    label: 'Heading 4',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.heading-4') ?? undefined,
    click: withWindowAction(actions.heading4)
  }, {
    id: 'heading5MenuItem',
    label: 'Heading 5',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.heading-5') ?? undefined,
    click: withWindowAction(actions.heading5)
  }, {
    id: 'heading6MenuItem',
    label: 'Heading 6',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.heading-6') ?? undefined,
    click: withWindowAction(actions.heading6)
  }, {
    type: 'separator'
  }, {
    id: 'upgradeHeadingMenuItem',
    label: 'Promote Heading',
    accelerator: keybindings.getAccelerator('paragraph.upgrade-heading') ?? undefined,
    click: withWindowAction(actions.increaseHeading)
  }, {
    id: 'degradeHeadingMenuItem',
    label: 'Demote Heading',
    accelerator: keybindings.getAccelerator('paragraph.degrade-heading') ?? undefined,
    click: withWindowAction(actions.degradeHeading)
  }, {
    type: 'separator'
  }, {
    id: 'tableMenuItem',
    label: 'Table',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.table') ?? undefined,
    click: withWindowAction(actions.table)
  }, {
    id: 'codeFencesMenuItem',
    label: 'Code Fences',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.code-fence') ?? undefined,
    click: withWindowAction(actions.codeFence)
  }, {
    id: 'quoteBlockMenuItem',
    label: 'Quote Block',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.quote-block') ?? undefined,
    click: withWindowAction(actions.quoteBlock)
  }, {
    id: 'mathBlockMenuItem',
    label: 'Math Block',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.math-formula') ?? undefined,
    click: withWindowAction(actions.mathFormula)
  }, {
    id: 'htmlBlockMenuItem',
    label: 'Html Block',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.html-block') ?? undefined,
    click: withWindowAction(actions.htmlBlock)
  }, {
    type: 'separator'
  }, {
    id: 'orderListMenuItem',
    label: 'Ordered List',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.order-list') ?? undefined,
    click: withWindowAction(actions.orderedList)
  }, {
    id: 'bulletListMenuItem',
    label: 'Bullet List',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.bullet-list') ?? undefined,
    click: withWindowAction(actions.bulletList)
  }, {
    id: 'taskListMenuItem',
    label: 'Task List',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.task-list') ?? undefined,
    click: withWindowAction(actions.taskList)
  }, {
    type: 'separator'
  }, {
    id: 'looseListItemMenuItem',
    label: 'Loose List Item',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.loose-list-item') ?? undefined,
    click: withWindowAction(actions.looseListItem)
  }, {
    type: 'separator'
  }, {
    id: 'paragraphMenuItem',
    label: 'Paragraph',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.paragraph') ?? undefined,
    click: withWindowAction(actions.paragraph)
  }, {
    id: 'horizontalLineMenuItem',
    label: 'Horizontal Rule',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.horizontal-line') ?? undefined,
    click: withWindowAction(actions.horizontalLine)
  }, {
    id: 'frontMatterMenuItem',
    label: 'Front Matter',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraph.front-matter') ?? undefined,
    click: withWindowAction(actions.frontMatter)
  }]

  return {
    id: 'paragraphMenuEntry',
    label: '&Paragraph',
    submenu
  }
}

export default paragraph
