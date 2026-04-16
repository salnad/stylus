export interface UploaderService {
  name: string
  isGdprCompliant: boolean
  privacyUrl: string
  tosUrl: string
  agreedToLegalNotices: boolean
}

export type UploaderServiceMap = Record<string, UploaderService>

const services: UploaderServiceMap = {
  none: {
    name: 'None',
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',
    agreedToLegalNotices: true
  },
  picgo: {
    name: 'Picgo',
    isGdprCompliant: false,
    privacyUrl: '',
    tosUrl: 'https://github.com/PicGo/PicGo-Core',
    agreedToLegalNotices: true
  },
  github: {
    name: 'GitHub',
    isGdprCompliant: true,
    privacyUrl: 'https://github.com/site/privacy',
    tosUrl: 'https://github.com/site/terms',
    agreedToLegalNotices: false
  },
  cliScript: {
    name: 'Command line script',
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',
    agreedToLegalNotices: true
  }
}

export const isValidService = (name: string): boolean => {
  return name !== 'none' && Object.prototype.hasOwnProperty.call(services, name)
}

export default services
