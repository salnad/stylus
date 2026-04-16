import { type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/theme'

interface UserPreferenceLike {
  getAll(): {
    theme?: string
  }
}

const theme = (userPreference: UserPreferenceLike): MenuItemConstructorOptions => {
  const activeTheme = userPreference.getAll().theme
  const submenu: MenuItemConstructorOptions[] = [{
    label: 'Cadmium Light',
    type: 'radio',
    id: 'light',
    checked: activeTheme === 'light',
    click () {
      actions.selectTheme('light')
    }
  }, {
    label: 'Dark',
    type: 'radio',
    id: 'dark',
    checked: activeTheme === 'dark',
    click () {
      actions.selectTheme('dark')
    }
  }, {
    label: 'Graphite Light',
    type: 'radio',
    id: 'graphite',
    checked: activeTheme === 'graphite',
    click () {
      actions.selectTheme('graphite')
    }
  }, {
    label: 'Material Dark',
    type: 'radio',
    id: 'material-dark',
    checked: activeTheme === 'material-dark',
    click () {
      actions.selectTheme('material-dark')
    }
  }, {
    label: 'One Dark',
    type: 'radio',
    id: 'one-dark',
    checked: activeTheme === 'one-dark',
    click () {
      actions.selectTheme('one-dark')
    }
  }, {
    label: 'Ulysses Light',
    type: 'radio',
    id: 'ulysses',
    checked: activeTheme === 'ulysses',
    click () {
      actions.selectTheme('ulysses')
    }
  }]

  return {
    label: '&Theme',
    id: 'themeMenu',
    submenu
  }
}

export default theme
