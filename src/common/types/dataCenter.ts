export type UploaderType = 'none' | 'github' | 'picgo' | 'cliScript' | string

export interface StoredImageReference {
  url: string
  timeStamp: number
}

export interface GitHubImageBed {
  owner: string
  repo: string
  branch: string
}

export interface ImageBedConfiguration {
  github: GitHubImageBed
}

export interface DataCenterState {
  imageFolderPath: string
  screenshotFolderPath: string
  webImages: StoredImageReference[]
  cloudImages: StoredImageReference[]
  currentUploader: UploaderType
  imageBed: ImageBedConfiguration
  cliScript?: string
}

export interface SecureDataCenterState {
  githubToken?: string | null
}

export type DataCenterMergedState = DataCenterState & SecureDataCenterState
