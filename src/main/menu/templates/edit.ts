import { type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/edit'
import { isOsx } from '../../config'
import { COMMANDS } from '../../commands'

interface KeybindingsLike {
  getAccelerator(commandId: string): string | null
}

export default function configureEditMenu (keybindings: KeybindingsLike): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [{
    label: 'Undo',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_UNDO) ?? undefined,
    click: (_menuItem, browserWindow) => {
      actions.editorUndo(browserWindow)
    }
  }, {
    label: 'Redo',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_REDO) ?? undefined,
    click: (_menuItem, browserWindow) => {
      actions.editorRedo(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Cut',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_CUT) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.nativeCut(browserWindow)
    }
  }, {
    label: 'Copy',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.nativeCopy(browserWindow)
    }
  }, {
    label: 'Paste',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_PASTE) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.nativePaste(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Copy as Markdown',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY_AS_MARKDOWN) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorCopyAsMarkdown(browserWindow)
    }
  }, {
    label: 'Copy as HTML',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY_AS_HTML) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorCopyAsHtml(browserWindow)
    }
  }, {
    label: 'Paste as Plain Text',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_PASTE_AS_PLAINTEXT) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorPasteAsPlainText(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Select All',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_SELECT_ALL) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorSelectAll(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Duplicate',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_DUPLICATE) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorDuplicate(browserWindow)
    }
  }, {
    label: 'Create Paragraph',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_CREATE_PARAGRAPH) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorCreateParagraph(browserWindow)
    }
  }, {
    label: 'Delete Paragraph',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_DELETE_PARAGRAPH) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorDeleteParagraph(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Find',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorFind(browserWindow)
    }
  }, {
    label: 'Find Next',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND_NEXT) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorFindNext(browserWindow)
    }
  }, {
    label: 'Find Previous',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND_PREVIOUS) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorFindPrevious(browserWindow)
    }
  }, {
    label: 'Replace',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_REPLACE) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.editorReplace(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Find in Folder',
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND_IN_FOLDER) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.findInFolder(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Screenshot',
    id: 'screenshot',
    visible: isOsx,
    accelerator: keybindings.getAccelerator(COMMANDS.EDIT_SCREENSHOT) ?? undefined,
    click (_menuItem, browserWindow) {
      actions.screenshot(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Line Ending',
    submenu: [{
      id: 'crlfLineEndingMenuEntry',
      label: 'Carriage return and line feed (CRLF)',
      type: 'radio',
      click (_menuItem, browserWindow) {
        actions.lineEnding(browserWindow, 'crlf')
      }
    }, {
      id: 'lfLineEndingMenuEntry',
      label: 'Line feed (LF)',
      type: 'radio',
      click (_menuItem, browserWindow) {
        actions.lineEnding(browserWindow, 'lf')
      }
    }]
  }]

  return {
    label: '&Edit',
    submenu
  }
}
