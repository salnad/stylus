import { ipcMain, MenuItem, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import log from 'electron-log'
import { isOsx } from '../../config'
import { addToDictionary } from '../../spellchecker'
import { SEPARATOR } from './menuItems'

type SpellingSubmenuItem = MenuItem | MenuItemConstructorOptions

const createSuggestionItem = (misspelledWord: string, replacement: string): MenuItemConstructorOptions => ({
  label: replacement,
  click (_menuItem, targetWindow) {
    if (!targetWindow) {
      return
    }

    targetWindow.webContents.send('mt::spelling-replace-misspelling', {
      word: misspelledWord,
      replacement
    })
  }
})

const spellcheckMenuBuilder = (
  isMisspelled: boolean,
  misspelledWord?: string,
  wordSuggestions?: string[]
): SpellingSubmenuItem[] => {
  const spellingSubmenu: SpellingSubmenuItem[] = []

  spellingSubmenu.push(new MenuItem({
    label: 'Change Language...',
    visible: !isOsx,
    click (_menuItem, targetWindow) {
      if (targetWindow) {
        targetWindow.webContents.send('mt::spelling-show-switch-language')
      }
    }
  }))

  if (isMisspelled && misspelledWord && wordSuggestions) {
    spellingSubmenu.push({
      label: 'Add to Dictionary',
      click (_menuItem, targetWindow) {
        if (!targetWindow) {
          return
        }

        if (!addToDictionary(targetWindow as BrowserWindow, misspelledWord)) {
          log.error(`Error while adding "${misspelledWord}" to dictionary.`)
          return
        }

        targetWindow.webContents.replaceMisspelling(misspelledWord)
      }
    })

    if (wordSuggestions.length > 0) {
      spellingSubmenu.push(SEPARATOR)
      for (const word of wordSuggestions) {
        spellingSubmenu.push(createSuggestionItem(misspelledWord, word))
      }
    }
  } else {
    spellingSubmenu.push({
      label: 'Edit Dictionary...',
      click () {
        ipcMain.emit('app-create-settings-window', 'spelling')
      }
    })
  }

  return spellingSubmenu
}

export default spellcheckMenuBuilder
