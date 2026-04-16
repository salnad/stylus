import WindowManager from '../app/windowManager'
import Preference from '../preferences'
import DataCenter from '../dataCenter'
import Keybindings from '../keyboard/shortcutHandler'
import AppMenu from '../menu'
import { loadMenuCommands } from '../menu/actions'
import { CommandManager, loadDefaultCommands, type CommandManagerContract } from '../commands'
import type { AppEnvironment } from './env'
import type AppPaths from './paths'

class Accessor {
  readonly env: AppEnvironment
  readonly paths: AppPaths
  readonly preferences: InstanceType<typeof Preference>
  readonly dataCenter: InstanceType<typeof DataCenter>
  readonly commandManager: CommandManagerContract
  readonly keybindings: InstanceType<typeof Keybindings>
  readonly menu: InstanceType<typeof AppMenu>
  readonly windowManager: InstanceType<typeof WindowManager>

  constructor (appEnvironment: AppEnvironment) {
    const userDataPath = appEnvironment.paths.userDataPath

    this.env = appEnvironment
    this.paths = appEnvironment.paths

    this.preferences = new Preference(this.paths)
    this.dataCenter = new DataCenter(this.paths)

    this.commandManager = CommandManager
    this._loadCommands()

    this.keybindings = new Keybindings(this.commandManager, appEnvironment)
    this.menu = new AppMenu(this.preferences, this.keybindings, userDataPath)
    this.windowManager = new WindowManager(this.menu, this.preferences)
  }

  private _loadCommands (): void {
    const { commandManager } = this
    loadDefaultCommands(commandManager)
    loadMenuCommands(commandManager)

    if (this.env.isDevMode) {
      commandManager.__verifyDefaultCommands()
    }
  }
}

export default Accessor
