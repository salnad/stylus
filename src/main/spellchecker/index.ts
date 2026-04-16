import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { isOsx } from '../config'

export const addToDictionary = (win: BrowserWindow, word: string): boolean => {
  return win.webContents.session.addWordToSpellCheckerDictionary(word)
}

export const removeFromDictionary = (win: BrowserWindow, word: string): boolean => {
  return win.webContents.session.removeWordFromSpellCheckerDictionary(word)
}

export const getCustomDictionaryWords = async (win: BrowserWindow): Promise<string[]> => {
  return win.webContents.session.listWordsInSpellCheckerDictionary()
}

export const setSpellCheckerEnabled = (win: BrowserWindow, enabled: boolean): boolean => {
  win.webContents.session.setSpellCheckerEnabled(enabled)
  return win.webContents.session.isSpellCheckerEnabled() === enabled
}

export const switchLanguage = (win: BrowserWindow, lang: string): void => {
  win.webContents.session.setSpellCheckerLanguages([lang])
}

export const getAvailableDictionaries = (win: BrowserWindow): string[] => {
  if (!win.webContents.session.isSpellCheckerEnabled) {
    console.warn('Spell Checker not available but dictionaries requested.')
    return []
  } else if (isOsx) {
    return []
  }
  return win.webContents.session.availableSpellCheckerLanguages
}

const registerSpellcheckerListeners = (): void => {
  ipcMain.handle('mt::spellchecker-remove-word', async (event, word: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return false
    }
    return removeFromDictionary(win, word)
  })

  ipcMain.handle('mt::spellchecker-switch-language', async (event, lang: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      switchLanguage(win, lang)
    }
    return null
  })

  ipcMain.handle('mt::spellchecker-get-available-dictionaries', async event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? getAvailableDictionaries(win) : []
  })

  ipcMain.handle('mt::spellchecker-set-enabled', async (event, enabled: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return false
    }

    if (!setSpellCheckerEnabled(win, enabled)) {
      log.warn(`Failed to (de-)activate spell checking on editor (id=${win.id}).`)
      return false
    }
    return true
  })

  ipcMain.handle('mt::spellchecker-get-custom-dictionary-words', async event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? getCustomDictionaryWords(win) : []
  })
}

export default registerSpellcheckerListeners
