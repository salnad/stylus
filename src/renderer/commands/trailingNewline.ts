import { ipcRenderer } from 'electron'
import { delay } from '@/util'
import bus from '../bus'

const descriptions = [
  'Trim all trailing newlines',
  'Ensure single newline',
  'Disabled'
] as const

interface EditorStateLike {
  currentFile: {
    trimTrailingNewline?: number
  }
}

interface CommandSubcommand {
  id: string
  description: string
  value: number
}

class TrailingNewlineCommand {
  public readonly id = 'file.trailing-newline'
  public readonly description = 'File: Trailing Newline'
  public readonly placeholder = 'Select an option'
  public subcommands: CommandSubcommand[] = []
  public subcommandSelectedIndex = -1
  private readonly _editorState: EditorStateLike

  constructor (editorState: EditorStateLike) {
    this._editorState = editorState
  }

  run = async (): Promise<void> => {
    const { trimTrailingNewline } = this._editorState.currentFile
    let index = trimTrailingNewline
    if (index !== 0 && index !== 1) {
      index = 2
    }

    this.subcommands = [{
      id: 'file.trailing-newline-trim',
      description: descriptions[0],
      value: 0
    }, {
      id: 'file.trailing-newline-single',
      description: descriptions[1],
      value: 1
    }, {
      id: 'file.trailing-newline-disabled',
      description: descriptions[2],
      value: 3
    }]

    this.subcommands[index].description = `${descriptions[index]} - current`
    this.subcommandSelectedIndex = index
  }

  execute = async (): Promise<void> => {
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (_id: string, value: number): Promise<void> => {
    ipcRenderer.emit('mt::set-final-newline', null, value)
  }

  unload = (): void => {}
}

export default TrailingNewlineCommand
