import { rgPath } from 'vscode-ripgrep'
import EnvPaths from 'common/envPaths'

const rgDiskPath = rgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')

class RendererPaths extends EnvPaths {
  private readonly _ripgrepBinaryPath: string

  constructor (userDataPath: string) {
    if (!userDataPath) {
      throw new Error('No user data path is given.')
    }

    super(userDataPath)

    if (process.env.MARKTEXT_RIPGREP_PATH) {
      this._ripgrepBinaryPath = process.env.MARKTEXT_RIPGREP_PATH
    } else {
      this._ripgrepBinaryPath = rgDiskPath
    }
  }

  get ripgrepBinaryPath (): string {
    return this._ripgrepBinaryPath
  }
}

export default RendererPaths
