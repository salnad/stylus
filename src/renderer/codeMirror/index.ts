/* eslint-disable @typescript-eslint/no-explicit-any */

import { filter } from 'fuzzaldrin'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/closetag'
import 'codemirror/addon/selection/active-line'
import 'codemirror/mode/meta'
import codeMirror from 'codemirror/lib/codemirror'

import loadmode from './loadmode'
import overlayMode from './overlayMode'
import multiplexMode from './mltiplexMode'
import languages from './modes'
import 'codemirror/lib/codemirror.css'
import './index.css'
import 'codemirror/theme/railscasts.css'

interface CodeMirrorModeInfoEntry {
  name?: string
  mode: string
  mime?: string | string[]
  mimes?: string[]
}

interface LanguageModeEntry {
  name: string
  mode: string
  mime: string
}

interface LanguageSearchResult {
  name: string
  mode: CodeMirrorModeInfoEntry
}

type CodeMirrorInstance = any
type CodeMirrorLibrary = any

const codeMirrorLibrary = codeMirror as CodeMirrorLibrary

loadmode(codeMirrorLibrary)
overlayMode(codeMirrorLibrary)
multiplexMode(codeMirrorLibrary)
window.CodeMirror = codeMirrorLibrary

const modes = codeMirrorLibrary.modeInfo as CodeMirrorModeInfoEntry[]
codeMirrorLibrary.modeURL = './codemirror/mode/%N/%N.js'

const getModeFromName = (name: string): LanguageSearchResult | null => {
  let result: LanguageSearchResult | null = null
  const lang = (languages as LanguageModeEntry[]).find(language => language.name === name)
  if (lang) {
    const { name: languageName, mode, mime } = lang
    const matched = modes.filter(entry => {
      if (entry.mime) {
        if (Array.isArray(entry.mime) && entry.mime.indexOf(mime) > -1 && entry.mode === mode) {
          return true
        } else if (typeof entry.mime === 'string' && entry.mime === mime && entry.mode === mode) {
          return true
        }
      }
      if (Array.isArray(entry.mimes) && entry.mimes.indexOf(mime) > -1 && entry.mode === mode) {
        return true
      }
      return false
    })
    if (matched.length && typeof matched[0] === 'object') {
      result = {
        name: languageName,
        mode: matched[0]
      }
    }
  }
  return result
}

export const search = (text: string): LanguageSearchResult[] => {
  const matchedLangs = filter(languages as LanguageModeEntry[], text, { key: 'name' }) as LanguageModeEntry[]
  return matchedLangs
    .map(({ name }) => getModeFromName(name))
    .filter((lang): lang is LanguageSearchResult => !!lang)
}

export const setCursorAtLastLine = (cm: CodeMirrorInstance): void => {
  const lastLine = cm.lastLine()
  const lineHandle = cm.getLineHandle(lastLine)

  cm.focus()
  cm.setCursor(lastLine, lineHandle.text.length)
}

export const isCursorAtFirstLine = (cm: CodeMirrorInstance): boolean => {
  const cursor = cm.getCursor()
  const { line, ch, outside } = cursor
  return line === 0 && ch === 0 && outside
}

export const isCursorAtLastLine = (cm: CodeMirrorInstance): boolean => {
  const lastLine = cm.lastLine()
  const cursor = cm.getCursor()
  const { line, outside, sticky } = cursor
  return line === lastLine && (outside || !sticky)
}

export const isCursorAtBegin = (cm: CodeMirrorInstance): boolean => {
  const cursor = cm.getCursor()
  const { line, ch, hitSide } = cursor
  return line === 0 && ch === 0 && !!hitSide
}

export const onlyHaveOneLine = (cm: CodeMirrorInstance): boolean => {
  return cm.lineCount() === 1
}

export const isCursorAtEnd = (cm: CodeMirrorInstance): boolean => {
  const lastLine = cm.lastLine()
  const lastLineHandle = cm.getLineHandle(lastLine)
  const cursor = cm.getCursor()
  const { line, ch, hitSide } = cursor
  return line === lastLine && ch === lastLineHandle.text.length && !!hitSide
}

export const getBeginPosition = () => {
  return {
    anchor: { line: 0, ch: 0 },
    head: { line: 0, ch: 0 }
  }
}

export const getEndPosition = (cm: CodeMirrorInstance) => {
  const lastLine = cm.lastLine()
  const lastLineHandle = cm.getLineHandle(lastLine)
  const line = lastLine
  const ch = lastLineHandle.text.length
  return { anchor: { line, ch }, head: { line, ch } }
}

export const setCursorAtFirstLine = (cm: CodeMirrorInstance): void => {
  cm.focus()
  cm.setCursor(0, 0)
}

export const setMode = (doc: CodeMirrorInstance, text: string): Promise<LanguageSearchResult> => {
  const match = getModeFromName(text)

  if (!match) {
    const errMsg = !text
      ? 'You\'d better provided a language mode when you create code block'
      : `${text} is not a valid language mode!`
    return Promise.reject(errMsg) // eslint-disable-line prefer-promise-reject-errors
  }

  const { mode, mime } = match.mode
  return new Promise(resolve => {
    codeMirrorLibrary.requireMode(mode, () => {
      doc.setOption('mode', mime || mode)
      codeMirrorLibrary.autoLoadMode(doc, mode)
      resolve(match)
    })
  })
}

export const setTextDirection = (cm: CodeMirrorInstance, textDirection: string): void => {
  cm.setOption('direction', textDirection)
}

export default codeMirrorLibrary
