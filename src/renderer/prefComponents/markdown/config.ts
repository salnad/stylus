export const bulletListMarkerOptions = [{
  label: '*',
  value: '*'
}, {
  label: '-',
  value: '-'
}, {
  label: '+',
  value: '+'
}] as const

export const orderListDelimiterOptions = [{
  label: '.',
  value: '.'
}, {
  label: ')',
  value: ')'
}] as const

export const preferHeadingStyleOptions = [{
  label: 'ATX heading',
  value: 'atx'
}, {
  label: 'Setext heading',
  value: 'setext'
}] as const

export const listIndentationOptions = [{
  label: 'DocFX style',
  value: 'dfm'
}, {
  label: 'True tab character',
  value: 'tab'
}, {
  label: 'Single space character',
  value: 1
}, {
  label: 'Two space characters',
  value: 2
}, {
  label: 'Three space characters',
  value: 3
}, {
  label: 'Four space characters',
  value: 4
}] as const

export const frontmatterTypeOptions = [{
  label: 'YAML',
  value: '-'
}, {
  label: 'TOML',
  value: '+'
}, {
  label: 'JSON (;;;)',
  value: ';'
}, {
  label: 'JSON ({})',
  value: '{'
}] as const

export const sequenceThemeOptions = [{
  label: 'Hand drawn',
  value: 'hand'
}, {
  label: 'Simple',
  value: 'simple'
}] as const
