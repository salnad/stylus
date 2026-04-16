import { ENCODING_NAME_MAP } from 'common/encoding'

export interface SelectOption<T extends string | number> {
  label: string
  value: T
}

export const tabSizeOptions: SelectOption<number>[] = [{
  label: '1',
  value: 1
}, {
  label: '2',
  value: 2
}, {
  label: '3',
  value: 3
}, {
  label: '4',
  value: 4
}]

export const endOfLineOptions: SelectOption<'default' | 'crlf' | 'lf'>[] = [{
  label: 'Default',
  value: 'default'
}, {
  label: 'Carriage return and line feed (CRLF)',
  value: 'crlf'
}, {
  label: 'Line feed (LF)',
  value: 'lf'
}]

export const trimTrailingNewlineOptions: SelectOption<number>[] = [{
  label: 'Trim all trailing',
  value: 0
}, {
  label: 'Ensure exactly one trailing',
  value: 1
}, {
  label: 'Preserve style of original document',
  value: 2
}, {
  label: 'Do nothing',
  value: 3
}]

export const textDirectionOptions: SelectOption<'ltr' | 'rtl'>[] = [{
  label: 'Left to Right',
  value: 'ltr'
}, {
  label: 'Right to Left',
  value: 'rtl'
}]

let defaultEncodingOptions: Array<SelectOption<string>> | null = null

export const getDefaultEncodingOptions = (): Array<SelectOption<string>> => {
  if (defaultEncodingOptions) {
    return defaultEncodingOptions
  }

  defaultEncodingOptions = Object.entries(ENCODING_NAME_MAP).map(([value, label]) => ({
    label,
    value
  }))
  return defaultEncodingOptions
}
