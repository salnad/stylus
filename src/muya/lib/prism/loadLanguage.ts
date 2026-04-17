import components from 'prismjs/components.js'
import getLoader from 'prismjs/dependencies'

type PrismLike = {
  languages: Record<string, unknown>
}

type ComponentLanguageEntry = {
  alias?: string | string[]
}

type ComponentsLike = {
  languages: Record<string, ComponentLanguageEntry>
}

export interface LoadLanguageResult {
  lang: string
  status: 'noexist' | 'cached' | 'loaded'
}

export const loadedLanguages = new Set<string>(['markup', 'css', 'clike', 'javascript'])

const { languages } = components as ComponentsLike

export const transformAliasToOrigin = (langs: string[]): string[] => {
  const result: string[] = []
  for (const lang of langs) {
    if (languages[lang]) {
      result.push(lang)
    } else {
      const language = Object.keys(languages).find(name => {
        const item = languages[name]
        if (item.alias) {
          return item.alias === lang || (Array.isArray(item.alias) && item.alias.includes(lang))
        }
        return false
      })

      if (language) {
        result.push(language)
      } else {
        result.push(lang)
      }
    }
  }

  return result
}

const initLoadLanguage = (prism: PrismLike) => {
  return async function loadLanguages (langs?: string[] | string): Promise<LoadLanguageResult[]> {
    let nextLangs = langs
    if (!nextLangs) {
      nextLangs = Object.keys(languages).filter(lang => lang !== 'meta')
    }

    if (Array.isArray(nextLangs) && nextLangs.length === 0) {
      return Promise.reject(new Error('The first parameter should be a list of load languages or single language.'))
    }

    if (!Array.isArray(nextLangs)) {
      nextLangs = [nextLangs]
    }

    const promises: Array<Promise<LoadLanguageResult>> = []
    const loaded = [...loadedLanguages, ...Object.keys(prism.languages)]

    getLoader(components, nextLangs, loaded).load(lang => {
      if (!(lang in languages)) {
        promises.push(Promise.resolve({
          lang,
          status: 'noexist'
        }))
      } else if (loadedLanguages.has(lang)) {
        promises.push(Promise.resolve({
          lang,
          status: 'cached'
        }))
      } else {
        delete prism.languages[lang]
        promises.push(
          import(`prismjs/components/prism-${lang}`)
            .then(() => {
              loadedLanguages.add(lang)
              return {
                lang,
                status: 'loaded'
              } as LoadLanguageResult
            })
        )
      }
    })

    return Promise.all(promises)
  }
}

export default initLoadLanguage
