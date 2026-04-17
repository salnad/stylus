import { downcode } from './urlify'

class Slugger {
  public seen: Record<string, number>
  public downcodeUnicode: boolean

  constructor () {
    this.seen = {}
    this.downcodeUnicode = true
  }

  slug (value: string): string {
    let slug = this.downcodeUnicode ? downcode(value) : value
    slug = slug
      .toLowerCase()
      .trim()
      .replace(/<[!/a-z].*?>/ig, '')
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
      .replace(/\s/g, '-')

    if (Object.prototype.hasOwnProperty.call(this.seen, slug)) {
      const originalSlug = slug
      do {
        this.seen[originalSlug]++
        slug = `${originalSlug}-${this.seen[originalSlug]}`
      } while (Object.prototype.hasOwnProperty.call(this.seen, slug))
    }
    this.seen[slug] = 0

    return slug
  }
}

export default Slugger
