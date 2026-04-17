import { isValidAttribute } from '../utils/dompurify'
import { isWin } from '../config' // __MARKTEXT_PATCH__
import { hasMarkdownExtension } from './markdownFile' // __MARKTEXT_PATCH__

type IsValidAttribute = (tag: string, attr: string, value: string) => boolean

const isValidAttributeFn = isValidAttribute as IsValidAttribute

export const sanitizeHyperlink = (rawLink?: string | null): string => {
  if (rawLink && typeof rawLink === 'string') {
    if (isValidAttributeFn('a', 'href', rawLink)) {
      return rawLink
    }

    // __MARKTEXT_PATCH__
    if (isWin && /^[a-zA-Z]:[/\\].+/.test(rawLink) && hasMarkdownExtension(rawLink)) {
      // Create and try UNC path on Windows because "C:\file.md" isn't allowed.
      const uncPath = `\\\\?\\${rawLink}`
      if (isValidAttributeFn('a', 'href', uncPath)) {
        return uncPath
      }
    }
    // END __MARKTEXT_PATCH__
  }

  return ''
}
