import { ipcRenderer } from 'electron'
import { isOsx } from '@/util'

export class SpellChecker {
  public enabled: boolean
  public currentSpellcheckerLanguage: string
  public isProviderAvailable: boolean

  constructor (enabled = true, lang = '') {
    this.enabled = enabled
    this.currentSpellcheckerLanguage = lang
    this.isProviderAvailable = true
  }

  get isEnabled (): boolean {
    return this.isProviderAvailable && this.enabled
  }

  async activateSpellchecker (lang?: string): Promise<boolean> {
    try {
      this.enabled = true
      this.isProviderAvailable = true
      if (isOsx) {
        return await ipcRenderer.invoke('mt::spellchecker-set-enabled', true)
      }
      return await this.switchLanguage(lang || this.currentSpellcheckerLanguage)
    } catch (error) {
      this.deactivateSpellchecker()
      throw error
    }
  }

  deactivateSpellchecker (): void {
    this.enabled = false
    this.isProviderAvailable = false
    ipcRenderer.invoke('mt::spellchecker-set-enabled', false).catch(() => {})
  }

  get lang (): string {
    if (this.isEnabled) {
      return this.currentSpellcheckerLanguage
    }
    return ''
  }

  set lang (lang: string) {
    this.currentSpellcheckerLanguage = lang
  }

  async switchLanguage (lang: string): Promise<boolean> {
    if (isOsx) {
      return true
    } else if (!lang) {
      throw new Error('Expected non-empty language for spell checker.')
    } else if (this.isEnabled) {
      await ipcRenderer.invoke('mt::spellchecker-switch-language', lang)
      this.lang = lang
      return true
    }
    return false
  }

  static async getAvailableDictionaries (): Promise<string[]> {
    if (isOsx) {
      return []
    }
    return ipcRenderer.invoke('mt::spellchecker-get-available-dictionaries')
  }
}
