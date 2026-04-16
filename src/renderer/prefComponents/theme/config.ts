export interface ThemeDefinition {
  name: string
}

export const themes: ThemeDefinition[] = [
  { name: 'light' },
  { name: 'dark' },
  { name: 'graphite' },
  { name: 'material-dark' },
  { name: 'ulysses' },
  { name: 'one-dark' }
]

export const autoSwitchThemeOptions = [{
  label: 'Adjust theme at startup',
  value: 0
}, {
  label: 'Never',
  value: 2
}]
