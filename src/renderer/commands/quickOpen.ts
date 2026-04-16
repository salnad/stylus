import path from 'path'
import { ipcRenderer } from 'electron'
import { isChildOfDirectory, hasMarkdownExtension, MARKDOWN_INCLUSIONS } from '../../common/filesystem/paths'
import bus from '../bus'
import { delay } from '@/util'
import FileSearcher from '@/node/fileSearcher'

const SPECIAL_CHARS = /[\[\]\\^$.\|\?\*\+\(\)\/]{1}/g // eslint-disable-line no-useless-escape

interface FileSearcherResult {
  filePath: string
  matches?: unknown[]
}

interface SearchPromise extends Promise<unknown> {
  cancel?: () => void
}

interface QuickOpenTab {
  pathname: string
}

interface RootProjectTree {
  pathname: string
}

interface RootStateLike {
  editor: {
    tabs: QuickOpenTab[]
  }
  project: {
    projectTree: RootProjectTree | null
  }
}

interface QuickOpenSubcommand {
  id: string
  description: string
  title?: string
}

class QuickOpenCommand {
  public readonly id = 'file.quick-open'
  public readonly description = 'File: Quick Open'
  public readonly placeholder = 'Search file to open'
  public shortcut: string[] | null
  public subcommands: QuickOpenSubcommand[]
  public subcommandSelectedIndex: number

  private readonly _editorState: RootStateLike['editor']
  private readonly _folderState: RootStateLike['project']
  private readonly _directorySearcher: FileSearcher
  private _cancelFn: (() => void) | null

  constructor (rootState: RootStateLike) {
    this.shortcut = null
    this.subcommands = []
    this.subcommandSelectedIndex = -1
    this._editorState = rootState.editor
    this._folderState = rootState.project
    this._directorySearcher = new FileSearcher()
    this._cancelFn = null
  }

  search = async (query: string): Promise<QuickOpenSubcommand[]> => {
    if (!query) {
      return this.subcommands
    }

    if (this._cancelFn) {
      this._cancelFn()
      this._cancelFn = null
    }

    const timeout = delay(300)
    this._cancelFn = () => {
      timeout.cancel()
      this._cancelFn = null
    }

    await timeout
    return this._doSearch(query)
  }

  run = async (): Promise<void> => {
    const { _editorState, _folderState } = this
    if (!_folderState.projectTree && _editorState.tabs.length === 0) {
      throw new Error('')
    }

    this.subcommands = _editorState.tabs
      .map(tab => tab.pathname)
      .filter((pathname): pathname is string => !!pathname)
      .map(pathname => {
        const item: QuickOpenSubcommand = {
          id: pathname,
          description: pathname
        }
        Object.assign(item, this._getPath(pathname))
        return item
      })
  }

  execute = async (): Promise<void> => {
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (id: string): Promise<void> => {
    const { windowId } = global.marktext.env
    ipcRenderer.send('mt::open-file-by-window-id', windowId, id)
  }

  unload = (): void => {
    this.subcommands = []
  }

  private _doSearch (query: string): Promise<QuickOpenSubcommand[]> | QuickOpenSubcommand[] {
    this._cancelFn = null
    const { _editorState, _folderState } = this
    const isRootDirOpened = !!_folderState.projectTree
    const tabsAvailable = _editorState.tabs.length > 0

    if (!isRootDirOpened && !tabsAvailable) {
      return []
    }

    const searchResult: Array<string | FileSearcherResult> = []
    const rootPath = isRootDirOpened && _folderState.projectTree ? _folderState.projectTree.pathname : null

    if (tabsAvailable) {
      const re = new RegExp(query.replace(SPECIAL_CHARS, match => {
        if (match === '*') return '.*'
        return match === '\\' ? '\\\\' : `\\${match}`
      }), 'i')

      for (const tab of _editorState.tabs) {
        const { pathname } = tab
        if (pathname && re.test(pathname) && (!rootPath || !isChildOfDirectory(rootPath, pathname))) {
          searchResult.push(pathname)
        }
      }
    }

    if (!isRootDirOpened || !rootPath) {
      return searchResult
        .map(result => typeof result === 'string' ? result : result.filePath)
        .map(pathname => ({
          id: pathname,
          description: pathname,
          title: pathname
        }))
    }

    return new Promise<QuickOpenSubcommand[]>((resolve, reject) => {
      let canceled = false
      const promises = this._directorySearcher.search([rootPath], '', {
        didMatch: (result: unknown) => {
          if (!canceled) {
            searchResult.push(result as FileSearcherResult)
          }
        },
        didSearchPaths: (numPathsFound: number) => {
          if (!canceled && numPathsFound > 30) {
            canceled = true
            if ((promises as SearchPromise).cancel) {
              (promises as SearchPromise).cancel?.()
            }
          }
        },
        inclusions: this._getInclusions(query)
      }) as SearchPromise

      promises
        .then(() => {
          this._cancelFn = null
          resolve(searchResult
            .map(result => typeof result === 'string' ? result : result.filePath)
            .map(pathname => {
              const item: QuickOpenSubcommand = {
                id: pathname,
                description: pathname
              }
              Object.assign(item, this._getPath(pathname))
              return item
            }))
        })
        .catch(error => {
          this._cancelFn = null
          reject(error)
        })

      this._cancelFn = () => {
        this._cancelFn = null
        canceled = true
        promises.cancel?.()
      }
    })
  }

  private _getInclusions (query: string): string[] {
    if (hasMarkdownExtension(query)) {
      return [`*${query}`]
    }

    return MARKDOWN_INCLUSIONS.map(inclusion => `*${query}${inclusion}`)
  }

  private _getPath (pathname: string): { title?: string, description: string } {
    const rootPath = this._folderState.projectTree?.pathname
    if (!rootPath || !isChildOfDirectory(rootPath, pathname)) {
      return { title: pathname, description: pathname }
    }

    const relativePath = path.relative(rootPath, pathname)
    const item: { title?: string, description: string } = { description: relativePath }
    if (relativePath.length > 50) {
      item.title = relativePath
    }
    return item
  }
}

export default QuickOpenCommand
