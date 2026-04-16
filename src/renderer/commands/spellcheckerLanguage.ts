import bus from '../bus'
import notice from '@/services/notification'
import { delay } from '@/util'
import { SpellChecker } from '@/spellchecker'
import { getLanguageName } from '@/spellchecker/languageMap'

interface SpellcheckerLanguageSubcommand {
  id: string
  description: string | null
  value: string
}

class SpellcheckerLanguageCommand {
  public readonly id = 'spellchecker.switch-language'
  public readonly description = 'Spelling: Switch language'
  public readonly placeholder = 'Select a language to switch to'
  public shortcut: string[] | null = null
  public readonly spellchecker: SpellChecker
  public subcommands: SpellcheckerLanguageSubcommand[] = []
  public subcommandSelectedIndex = -1

  constructor (spellchecker: SpellChecker) {
    this.spellchecker = spellchecker
  }

  run = async (): Promise<void> => {
    const langs = await SpellChecker.getAvailableDictionaries()
    this.subcommands = langs.map(lang => ({
      id: `spellchecker.switch-language-id-${lang}`,
      description: getLanguageName(lang),
      value: lang
    }))
    const currentLanguage = this.spellchecker.lang
    this.subcommandSelectedIndex = this.subcommands.findIndex(cmd => cmd.value === currentLanguage)
  }

  execute = async (): Promise<void> => {
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (id: string): Promise<void> => {
    const command = this.subcommands.find(cmd => cmd.id === id)
    if (!command) {
      return
    }

    if (this.spellchecker.isEnabled) {
      bus.$emit('switch-spellchecker-language', command.value)
    } else {
      notice.notify({
        title: 'Spelling',
        type: 'warning',
        message: 'Cannot change language because spellchecker is disabled.'
      })
    }
  }

  unload = (): void => {
    this.subcommands = []
  }
}

export default SpellcheckerLanguageCommand
