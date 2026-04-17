import unlinkIcon from '../../assets/pngicon/unlink/2.png'
import linkJumpIcon from '../../assets/pngicon/link_jump/2.png'

interface LinkToolIconConfig {
  type: 'unlink' | 'jump'
  icon: string
}

const icons: LinkToolIconConfig[] = [
  {
    type: 'unlink',
    icon: unlinkIcon
  },
  {
    type: 'jump',
    icon: linkJumpIcon
  }
]

export default icons
