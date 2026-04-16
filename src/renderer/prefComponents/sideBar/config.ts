import GeneralIcon from '@/assets/icons/pref_general.svg'
import EditorIcon from '@/assets/icons/pref_editor.svg'
import MarkdownIcon from '@/assets/icons/pref_markdown.svg'
import ThemeIcon from '@/assets/icons/pref_theme.svg'
import ImageIcon from '@/assets/icons/pref_image.svg'
import SpellIcon from '@/assets/icons/pref_spellcheck.svg'
import KeyBindingIcon from '@/assets/icons/pref_key_binding.svg'

import preferences from '../../../main/preferences/schema.json'

interface PreferenceCategory {
  name: string
  label: string
  icon: {
    url: string
    viewBox: string
    id?: string
  }
  path: string
}

interface PreferenceSchemaEntry {
  description: string
  enum?: Array<string | number | boolean>
}

export const category: PreferenceCategory[] = [{
  name: 'General',
  label: 'general',
  icon: GeneralIcon,
  path: '/preference/general'
}, {
  name: 'Editor',
  label: 'editor',
  icon: EditorIcon,
  path: '/preference/editor'
}, {
  name: 'Markdown',
  label: 'markdown',
  icon: MarkdownIcon,
  path: '/preference/markdown'
}, {
  name: 'Spelling',
  label: 'spelling',
  icon: SpellIcon,
  path: '/preference/spelling'
}, {
  name: 'Theme',
  label: 'theme',
  icon: ThemeIcon,
  path: '/preference/theme'
}, {
  name: 'Image',
  label: 'image',
  icon: ImageIcon,
  path: '/preference/image'
}, {
  name: 'Key Bindings',
  label: 'keybindings',
  icon: KeyBindingIcon,
  path: '/preference/keybindings'
}]

const preferenceSchema = preferences as Record<string, PreferenceSchemaEntry>

export const searchContent = Object.keys(preferenceSchema)
  .map(key => {
    const { description, enum: enums } = preferenceSchema[key]
    let [preferenceCategory, preference] = description.split('--')
    if (Array.isArray(enums)) {
      preference += ` optional values: ${enums.join(', ')}`
    }
    return {
      category: preferenceCategory,
      preference
    }
  })
  .filter(({ category: preferenceCategory }) => category.some(item => item.label === preferenceCategory.toLowerCase()))
