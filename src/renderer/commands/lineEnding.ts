import { ipcRenderer } from 'electron'
import { delay } from '@/util'
import bus from '../bus'

const crlfDescription = 'Carriage return and line feed (CRLF)'
const lfDescription = 'Line feed (LF)'

interface CurrentFileLike {
  lineEnding?: 'lf' | 'crlf'
}

interface EditorStateLike {
  currentFile: CurrentFileLike
}

interface LineEndingSubcommand {
  id: string
  description: string
  value: 'lf' | 'crlf'
}

class LineEndingCommand {
  public readonly id = 'file.line-ending'
  public readonly description = 'File: Change Line Ending'
  public readonly placeholder = 'Select an option'
  public readonly subcommands: LineEndingSubcommand[]
  public subcommandSelectedIndex: number
  private readonly _editorState: EditorStateLike

  constructor (editorState: EditorStateLike) {
    this._editorState = editorState
    this.subcommands = [{
      id: 'file.line-ending-crlf',
      description: crlfDescription,
      value: 'crlf'
    }, {
      id: 'file.line-ending-lf',
      description: lfDescription,
      value: 'lf'
    }]
    this.subcommandSelectedIndex = -1
  }

  run = async (): Promise<void> => {
    const { lineEnding } = this._editorState.currentFile
    if (lineEnding === 'crlf') {
      this.subcommandSelectedIndex = 0
      this.subcommands[0].description = `${crlfDescription} - current`
      this.subcommands[1].description = lfDescription
    } else {
      this.subcommandSelectedIndex = 1
      this.subcommands[0].description = crlfDescription
      this.subcommands[1].description = `${lfDescription} - current`
    }
  }

  execute = async (): Promise<void> => {
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (_id: string, value: 'lf' | 'crlf'): Promise<void> => {
    ipcRenderer.emit('mt::set-line-ending', null, value)
  }

  unload = (): void => {}
}

export default LineEndingCommand
