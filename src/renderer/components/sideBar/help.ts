import FilesIcon from '@/assets/icons/files.svg'
import SearchIcon from '@/assets/icons/search.svg'
import TocIcon from '@/assets/icons/toc.svg'
import SettingIcon from '@/assets/icons/setting.svg'

interface SideBarIconEntry {
  name: string
  icon: {
    id?: string
    url: string
    viewBox: string
  }
}

export const sideBarIcons: SideBarIconEntry[] = [
  {
    name: 'files',
    icon: FilesIcon
  }, {
    name: 'search',
    icon: SearchIcon
  }, {
    name: 'toc',
    icon: TocIcon
  }
]

export const sideBarBottomIcons: SideBarIconEntry[] = [
  {
    name: 'settings',
    icon: SettingIcon
  }
]
