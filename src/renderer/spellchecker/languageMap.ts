import langMap from 'iso-639-1'

interface DictionaryLanguage {
  label: string
  value: string
}

export const getLanguageName = (languageCode: string): string | null => {
  if (!languageCode || languageCode.length < 2) {
    return null
  }

  let language: string | null = ''

  if (languageCode.length === 5) {
    language = getHunspellLanguageName(languageCode)
    if (language) {
      return language
    }
  }

  language = langMap.getNativeName(languageCode.substr(0, 2))
  if (language) {
    return `${language} (${languageCode})`
  }
  return `Unknown (${languageCode})`
}

const getHunspellLanguageName = (langCode: string): string | null => {
  const item = HUNSPELL_DICTIONARY_LANGUAGE_MAP.find(entry => entry.value === langCode)
  if (!item) {
    return null
  }
  return item.label
}

const HUNSPELL_DICTIONARY_LANGUAGE_MAP: ReadonlyArray<DictionaryLanguage> = Object.freeze([{
  label: 'Afrikaans',
  value: 'af-ZA'
}, {
  label: 'български език',
  value: 'bg-BG'
}, {
  label: 'Català',
  value: 'ca-ES'
}, {
  label: 'Česky',
  value: 'cs-CZ'
}, {
  label: 'Dansk',
  value: 'da-DK'
}, {
  label: 'Deutsch',
  value: 'de-DE'
}, {
  label: 'Ελληνικά',
  value: 'el-GR'
}, {
  label: 'English (en-AU)',
  value: 'en-AU'
}, {
  label: 'English (en-CA)',
  value: 'en-CA'
}, {
  label: 'English (en-GB)',
  value: 'en-GB'
}, {
  label: 'English (en-US)',
  value: 'en-US'
}, {
  label: 'Español',
  value: 'es-ES'
}, {
  label: 'Eesti',
  value: 'et-EE'
}, {
  label: 'Føroyskt',
  value: 'fo-FO'
}, {
  label: 'Français',
  value: 'fr-FR'
}, {
  label: 'עברית',
  value: 'he-IL'
}, {
  label: 'हिन्दी',
  value: 'hi-IN'
}, {
  label: 'Hhrvatski',
  value: 'hr-HR'
}, {
  label: 'Magyar',
  value: 'hu-HU'
}, {
  label: 'Bahasa Indonesia',
  value: 'id-ID'
}, {
  label: 'Italiano',
  value: 'it-IT'
}, {
  label: '한국어',
  value: 'ko'
}, {
  label: 'Lietuvių',
  value: 'lt-LT'
}, {
  label: 'Latviešu',
  value: 'lv-LV'
}, {
  label: 'Norsk',
  value: 'nb-NO'
}, {
  label: 'Nederlands',
  value: 'nl-NL'
}, {
  label: 'Polski',
  value: 'pl-PL'
}, {
  label: 'Português (pt-BR)',
  value: 'pt-BR'
}, {
  label: 'Português (pt-PT)',
  value: 'pt-PT'
}, {
  label: 'Română',
  value: 'ro-RO'
}, {
  label: 'Pусский',
  value: 'ru-RU'
}, {
  label: 'Cрпски језик (Latin)',
  value: 'sh'
}, {
  label: 'Slovenčina (sk-SK)',
  value: 'sk-SK'
}, {
  label: 'Slovenščina (sl-SI)',
  value: 'sl-SI'
}, {
  label: 'Shqip',
  value: 'sq'
}, {
  label: 'Cрпски језик',
  value: 'sr'
}, {
  label: 'Svenska',
  value: 'sv-SE'
}, {
  label: 'தமிழ்',
  value: 'ta-IN'
}, {
  label: 'тоҷикӣ',
  value: 'tg-TG'
}, {
  label: 'Türkçe',
  value: 'tr-TR'
}, {
  label: 'українська',
  value: 'uk-UA'
}, {
  label: 'Tiếng Việt',
  value: 'vi-VN'
}])
