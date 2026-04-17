import Prism from 'prismjs'
import { filter } from 'fuzzaldrin'
import initLoadLanguage, { loadedLanguages, transformAliasToOrigin } from './loadLanguage'
import { languages } from 'prismjs/components.js'

type PrismLanguageEntry = {
  title?: string
  alias?: string | string[]
  [key: string]: unknown
}

interface SearchLanguageEntry extends PrismLanguageEntry {
  name: string
}

const prism = Prism
;(window as Window & { Prism?: typeof Prism }).Prism = Prism
import('prismjs/plugins/keep-markup/prism-keep-markup')

const langs: SearchLanguageEntry[] = []

for (const name of Object.keys(languages as Record<string, PrismLanguageEntry>)) {
  const lang = (languages as Record<string, PrismLanguageEntry>)[name]
  langs.push({
    name,
    ...lang
  })
  if (lang.alias) {
    if (typeof lang.alias === 'string') {
      langs.push({
        name: lang.alias,
        ...lang
      })
    } else if (Array.isArray(lang.alias)) {
      langs.push(...lang.alias.map(alias => ({
        name: alias,
        ...lang
      })))
    }
  }
}

const loadLanguage = initLoadLanguage(Prism as unknown as { languages: Record<string, unknown> })

const search = (text: string): SearchLanguageEntry[] => {
  return filter(langs, text, { key: 'name' }) as SearchLanguageEntry[]
}

loadLanguage('latex')
loadLanguage('yaml')

export {
  search,
  loadLanguage,
  loadedLanguages,
  transformAliasToOrigin
}

export default prism
