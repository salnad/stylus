import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import Store from 'electron-store'
import log from 'electron-log'
import { ensureDirSync } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import schema from './schema.json'
import type AppPaths from '../app/paths'
import type {
  DataCenterMergedState,
  DataCenterState,
  SecureDataCenterState,
  StoredImageReference
} from 'common/types/dataCenter'

const DATA_CENTER_NAME = 'dataCenter'
type DataCenterStoreOptions = import('electron-store').Options<DataCenterState>

class DataCenter extends EventEmitter {
  public readonly dataCenterPath: string
  public readonly userDataPath: string
  public readonly serviceName: string
  public readonly encryptKeys: readonly (keyof SecureDataCenterState)[]
  public readonly hasDataCenterFile: boolean
  public readonly store: Store<DataCenterState>

  constructor (paths: AppPaths) {
    super()

    const { dataCenterPath, userDataPath } = paths
    const storeOptions = {
      schema,
      name: DATA_CENTER_NAME
    } as unknown as DataCenterStoreOptions

    this.dataCenterPath = dataCenterPath
    this.userDataPath = userDataPath
    this.serviceName = 'marktext'
    this.encryptKeys = ['githubToken']
    this.hasDataCenterFile = fs.existsSync(path.join(this.dataCenterPath, `./${DATA_CENTER_NAME}.json`))
    this.store = new Store<DataCenterState>(storeOptions)

    this.init()
  }

  init (): void {
    const defaultData: DataCenterState = {
      imageFolderPath: path.join(this.userDataPath, 'images'),
      screenshotFolderPath: path.join(this.userDataPath, 'screenshot'),
      webImages: [],
      cloudImages: [],
      currentUploader: 'none',
      imageBed: {
        github: {
          owner: '',
          repo: '',
          branch: ''
        }
      }
    }

    if (!this.hasDataCenterFile) {
      this.store.set(defaultData)
      ensureDirSync(this.store.get('screenshotFolderPath'))
    }
    this._listenForIpcMain()
  }

  async getAll (): Promise<DataCenterMergedState> {
    const data = { ...this.store.store }
    try {
      const encryptData = await Promise.all(this.encryptKeys.map(key => keytar.getPassword(this.serviceName, key)))
      const encryptObj = this.encryptKeys.reduce<SecureDataCenterState>((accumulator, key, index) => {
        accumulator[key] = encryptData[index]
        return accumulator
      }, {})

      return Object.assign(data, encryptObj)
    } catch (err) {
      log.error('Failed to decrypt secure keys:', err)
      return data
    }
  }

  addImage (key: 'webImages' | 'cloudImages', url: string): void {
    const items = [...this.store.get(key)]
    const existingItem = items.find(item => item.url === url)
    let item: StoredImageReference

    if (existingItem) {
      existingItem.timeStamp = Date.now()
      item = existingItem
    } else {
      item = {
        url,
        timeStamp: Date.now()
      }
      items.push(item)
    }

    ipcMain.emit('broadcast-web-image-added', { type: key, item })
    this.store.set(key, items)
  }

  removeImage (type: 'webImages' | 'cloudImages', url: string): void {
    const items = [...this.store.get(type)]
    const index = items.findIndex(item => item.url === url)
    if (index === -1) {
      return
    }

    const [item] = items.splice(index, 1)
    ipcMain.emit('broadcast-web-image-removed', { type, item })
    this.store.set(type, items)
  }

  getItem<K extends keyof DataCenterState | keyof SecureDataCenterState> (
    key: K
  ): Promise<(DataCenterState & SecureDataCenterState)[K]> {
    if (this.encryptKeys.includes(key as keyof SecureDataCenterState)) {
      return keytar.getPassword(this.serviceName, key as keyof SecureDataCenterState) as Promise<(DataCenterState & SecureDataCenterState)[K]>
    }

    const value = this.store.get(key as keyof DataCenterState)
    return Promise.resolve(value as (DataCenterState & SecureDataCenterState)[K])
  }

  async setItem<K extends keyof DataCenterState | keyof SecureDataCenterState> (
    key: K,
    value: (DataCenterState & SecureDataCenterState)[K]
  ): Promise<void> {
    if (key === 'screenshotFolderPath' && typeof value === 'string') {
      ensureDirSync(value)
    }

    ipcMain.emit('broadcast-user-data-changed', { [key]: value })
    if (this.encryptKeys.includes(key as keyof SecureDataCenterState)) {
      try {
        await keytar.setPassword(this.serviceName, key as keyof SecureDataCenterState, value as string)
      } catch (err) {
        log.error('Keytar error:', err)
      }
      return
    }

    this.store.set(key as keyof DataCenterState, value as DataCenterState[keyof DataCenterState])
  }

  setItems (settings: Partial<DataCenterMergedState> | null | undefined): void {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    for (const key of Object.keys(settings) as (keyof DataCenterMergedState)[]) {
      const value = settings[key]
      if (typeof value !== 'undefined') {
        this.setItem(key, value).catch(err => {
          log.error(`Failed to set user data entry "${key}":`, err)
        })
      }
    }
  }

  private _listenForIpcMain (): void {
    ipcMain.on('set-image-folder-path', (_event, newPath: string) => {
      this.setItem('imageFolderPath', newPath).catch(err => {
        log.error('Failed to set image folder path:', err)
      })
    })

    ipcMain.on('mt::ask-for-user-data', async event => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return
      }

      const userData = await this.getAll()
      win.webContents.send('mt::user-preference', userData)
    })

    ipcMain.on('mt::ask-for-modify-image-folder-path', async (event, imagePath?: string) => {
      if (!imagePath) {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) {
          return
        }
        const { filePaths } = await dialog.showOpenDialog(win, {
          properties: ['openDirectory', 'createDirectory']
        })
        if (filePaths && filePaths[0]) {
          imagePath = filePaths[0]
        }
      }

      if (imagePath) {
        await this.setItem('imageFolderPath', imagePath)
      }
    })

    ipcMain.on('mt::set-user-data', (_event, userData: Partial<DataCenterMergedState>) => {
      this.setItems(userData)
    })

    ipcMain.on('mt::ask-for-image-path', async event => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        event.returnValue = ''
        return
      }
      const { filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{
          name: 'Images',
          extensions: [...IMAGE_EXTENSIONS]
        }]
      })

      event.returnValue = filePaths && filePaths[0] ? filePaths[0] : ''
    })
  }
}

export default DataCenter
