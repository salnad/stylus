import COMMAND_CONSTANTS from 'common/commands/constants'
import { loadFileCommands } from './file'
import { loadTabCommands } from './tab'

export const COMMANDS = COMMAND_CONSTANTS

export type CommandCallback = (...args: unknown[]) => unknown

export interface CommandManagerContract {
  add(id: string, callback: CommandCallback): void
  remove(id: string): boolean
  has(id: string): boolean
  execute(id: string, ...args: unknown[]): unknown
  __verifyDefaultCommands(): void
}

export const loadDefaultCommands = (commandManager: CommandManagerContract): void => {
  loadFileCommands(commandManager)
  loadTabCommands(commandManager)
}

class CommandManagerImpl implements CommandManagerContract {
  private readonly _commands = new Map<string, CommandCallback>()

  add (id: string, callback: CommandCallback): void {
    const { _commands } = this
    if (_commands.has(id)) {
      throw new Error(`Command with id="${id}" already exists.`)
    }
    _commands.set(id, callback)
  }

  remove (id: string): boolean {
    return this._commands.delete(id)
  }

  has (id: string): boolean {
    return this._commands.has(id)
  }

  execute (id: string, ...args: unknown[]): unknown {
    const command = this._commands.get(id)
    if (!command) {
      throw new Error(`No command found with id="${id}".`)
    }
    return command(...args)
  }

  __verifyDefaultCommands (): void {
    const { _commands } = this
    Object.keys(COMMANDS).forEach(propertyName => {
      const id = COMMANDS[propertyName as keyof typeof COMMANDS]
      if (!_commands.has(id)) {
        console.error(`[DEBUG] Default command with id="${id}" isn't available!`)
      }
    })
  }
}

const commandManagerInstance = new CommandManagerImpl()

export { commandManagerInstance as CommandManager }
