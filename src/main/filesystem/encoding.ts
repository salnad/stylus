import ced from 'ced'

import type { Encoding } from 'common/types/documents'

const CED_ICONV_ENCODINGS: Record<string, string> = {
  'BIG5-CP950': 'big5',
  KSC: 'euckr',
  'ISO-2022-KR': 'euckr',
  GB: 'gb2312',
  ISO_2022_CN: 'gb2312',
  JIS: 'shiftjis',
  SJS: 'shiftjis',
  Unicode: 'utf8',

  // Map ASCII to UTF-8
  'ASCII-7-bit': 'utf8',
  ASCII: 'utf8',
  MACINTOSH: 'utf8'
}

const BOM_ENCODINGS: Record<string, number[]> = {
  utf8: [0xEF, 0xBB, 0xBF],
  utf16be: [0xFE, 0xFF],
  utf16le: [0xFF, 0xFE]
}

const checkSequence = (buffer: Buffer, sequence: number[]): boolean => {
  if (buffer.length < sequence.length) {
    return false
  }
  return sequence.every((value, index) => value === buffer[index])
}

export const guessEncoding = (buffer: Buffer, autoGuessEncoding: boolean): Encoding => {
  for (const [key, value] of Object.entries(BOM_ENCODINGS)) {
    if (checkSequence(buffer, value)) {
      return { encoding: key, isBom: true }
    }
  }

  let encoding = 'utf8'
  if (autoGuessEncoding) {
    const guessed = ced(buffer)
    if (CED_ICONV_ENCODINGS[guessed]) {
      encoding = CED_ICONV_ENCODINGS[guessed]
    } else {
      encoding = guessed.toLowerCase().replace(/-_/g, '')
    }
  }

  return { encoding, isBom: false }
}
