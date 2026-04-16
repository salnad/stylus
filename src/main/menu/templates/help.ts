import path from 'path'
import { shell, type MenuItemConstructorOptions, type BrowserWindow, type MenuItem } from 'electron'
import { isFile } from 'common/filesystem'
import * as actions from '../actions/help'
import { checkUpdates } from '../actions/marktext'

const isUpdatable = (): boolean => {
  const resFile = isFile(path.join(process.resourcesPath, 'app-update.yml'))
  if (!resFile) {
    return false
  } else if (process.env.APPIMAGE) {
    return true
  } else if (process.platform === 'win32' && isFile(path.join(process.resourcesPath, 'md.ico'))) {
    return true
  }

  return false
}

const openExternal = (url: string): void => {
  shell.openExternal(url).catch(error => {
    console.error(error)
  })
}

type MenuClickContext = {
  item: MenuItem
  win: BrowserWindow | undefined
}

const withContext = (handler: (context: MenuClickContext) => void): MenuItemConstructorOptions['click'] => {
  return (item, win) => {
    handler({ item, win })
  }
}

const help = (): MenuItemConstructorOptions => {
  const submenu: MenuItemConstructorOptions[] = [{
    label: 'Quick Start...',
    click: () => {
      openExternal('https://github.com/marktext/marktext/blob/master/docs/README.md')
    }
  }, {
    label: 'Markdown Reference...',
    click: () => {
      openExternal('https://github.com/marktext/marktext/blob/master/docs/MARKDOWN_SYNTAX.md')
    }
  }, {
    label: 'Changelog...',
    click: () => {
      openExternal('https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Donate via Open Collective...',
    click: () => {
      openExternal('https://opencollective.com/marktext')
    }
  }, {
    label: 'Feedback via Twitter...',
    click: withContext(({ win }) => {
      if (win) {
        actions.showTweetDialog(win, 'twitter')
      }
    })
  }, {
    label: 'Report Issue or Request Feature...',
    click: () => {
      openExternal('https://github.com/marktext/marktext/issues')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Website...',
    click: () => {
      openExternal('https://github.com/marktext/marktext')
    }
  }, {
    label: 'Watch on GitHub...',
    click: () => {
      openExternal('https://github.com/marktext/marktext')
    }
  }, {
    label: 'Follow us on Github...',
    click: () => {
      openExternal('https://github.com/Jocs')
    }
  }, {
    label: 'Follow us on Twitter...',
    click: () => {
      openExternal('https://twitter.com/marktextapp')
    }
  }, {
    type: 'separator'
  }, {
    label: 'License...',
    click: () => {
      openExternal('https://github.com/marktext/marktext/blob/master/LICENSE')
    }
  }]

  if (isUpdatable()) {
    submenu.push({
      type: 'separator'
    }, {
      label: 'Check for updates...',
      click: withContext(({ win }) => {
        if (win) {
          checkUpdates(win)
        }
      })
    })
  }

  if (process.platform !== 'darwin') {
    submenu.push({
      type: 'separator'
    }, {
      label: 'About MarkText...',
      click: withContext(({ win }) => {
        if (win) {
          actions.showAboutDialog(win)
        }
      })
    })
  }

  return {
    label: '&Help',
    role: 'help',
    submenu
  }
}

export default help
