import { ipcRenderer } from 'electron'
import log from 'electron-log'
import bus from '../bus'
import staticCommands, { RootCommand } from '../commands'

interface CommandEntry {
  id: string
  description: string
  shortcut?: string[]
  execute(): unknown
}

interface RootCommandLike {
  subcommands: CommandEntry[]
}

interface CommandCenterState {
  rootCommand: RootCommandLike
}

type KeybindingMap = Record<string, string | undefined>

const state: CommandCenterState = {
  rootCommand: new RootCommand(staticCommands) as unknown as RootCommandLike
}

const getters = {}

const mutations = {
  REGISTER_COMMAND (currentState: CommandCenterState, command: CommandEntry): void {
    currentState.rootCommand.subcommands.push(command)
  },
  SORT_COMMANDS (currentState: CommandCenterState): void {
    currentState.rootCommand.subcommands.sort((a, b) => a.description.localeCompare(b.description))
  }
}

const actions = {
  LISTEN_COMMAND_CENTER_BUS ({ commit, state: currentState }: {
    commit(type: string, payload?: unknown): void
    state: CommandCenterState
  }): void {
    bus.$on('cmd::sort-commands', () => {
      commit('SORT_COMMANDS')
    })

    ipcRenderer.on('mt::keybindings-response', (_event, keybindingMap: KeybindingMap) => {
      const { subcommands } = currentState.rootCommand
      for (const entry of subcommands) {
        const value = keybindingMap[entry.id]
        if (value) {
          entry.shortcut = normalizeAccelerator(value)
        }
      }
    })

    bus.$on('cmd::register-command', (command: CommandEntry) => {
      commit('REGISTER_COMMAND', command)
    })

    bus.$on('cmd::execute', (commandId: string) => {
      executeCommand(currentState, commandId)
    })

    ipcRenderer.on('mt::execute-command-by-id', (_event, commandId: string) => {
      executeCommand(currentState, commandId)
    })
  }
}

const executeCommand = (currentState: CommandCenterState, commandId: string): void => {
  const { subcommands } = currentState.rootCommand
  const command = subcommands.find(candidate => candidate.id === commandId)
  if (!command) {
    const errorMsg = `Cannot execute command "${commandId}" because it's missing.`
    log.error(errorMsg)
    throw new Error(errorMsg)
  }
  command.execute()
}

const normalizeAccelerator = (acc: string): string[] => {
  try {
    return acc
      .replace(/cmdorctrl|cmd/i, 'Cmd')
      .replace(/ctrl/i, 'Ctrl')
      .split('+')
  } catch (_) {
    return [acc]
  }
}

export default { state, getters, mutations, actions }
