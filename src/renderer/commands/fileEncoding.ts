import { ipcRenderer } from 'electron'
import { ENCODING_NAME_MAP, getEncodingName } from 'common/encoding'
import { delay } from '@/util'
import bus from '../bus'

interface EncodingValue {
  encoding: string
  isBom: boolean
}

interface CurrentFileLike {
  encoding?: EncodingValue
}

interface EditorStateLike {
  currentFile?: CurrentFileLike
}

interface CommandSubcommand {
  id: string
  description: string
}

class FileEncodingCommand {
  public readonly id = 'file.change-encoding'
  public readonly description = 'File: Change Encoding'
  public readonly placeholder = 'Select an option'
  public subcommands: CommandSubcommand[]
  public subcommandSelectedIndex: number
  private readonly _editorState: EditorStateLike

  constructor (editorState: EditorStateLike) {
    this.subcommands = []
    this.subcommandSelectedIndex = -1
    this._editorState = editorState
  }

  run = async (): Promise<void> => {
    this.subcommands = []
    this.subcommandSelectedIndex = -1

    const encodingObj = this._getCurrentEncoding()
    const { encoding, isBom } = encodingObj

    if (isBom) {
      this.subcommandSelectedIndex = 0
      this.subcommands.push({
        id: `${encoding}-bom`,
        description: `${getEncodingName(encodingObj)} - current`
      })
    }

    let i = 0
    for (const [key, value] of Object.entries(ENCODING_NAME_MAP)) {
      const isTabEncoding = !isBom && key === encoding
      const item = {
        id: key,
        description: isTabEncoding ? `${value} - current` : value
      }
      if (isTabEncoding) {
        this.subcommandSelectedIndex = i
        this.subcommands.unshift(item)
      } else {
        this.subcommands.push(item)
      }
      ++i
    }
  }

  execute = async (): Promise<void> => {
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (id: string): Promise<void> => {
    if (!id.endsWith('-bom')) {
      ipcRenderer.emit('mt::set-file-encoding', null, id)
    }
  }

  unload = (): void => {
    this.subcommands = []
  }

  private _getCurrentEncoding (): EncodingValue {
    const { currentFile } = this._editorState
    if (currentFile?.encoding) {
      return currentFile.encoding
    }
    return { encoding: 'utf8', isBom: false }
  }
}

export default FileEncodingCommand
