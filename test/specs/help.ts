export const removeCustomClass = (html: string): string => {
  const customClass = ['indented-code-block', 'fenced-code-block', 'task-list-item']
  customClass.forEach(className => {
    if (html.indexOf(className) > -1) {
      const regExp = new RegExp(`class="${className}"`, 'g')
      const regExpSimple = new RegExp(className + ' *', 'g')
      html = html.replace(regExp, '')
        .replace(regExpSimple, '')
    }
  })
  return html
}

export const padding = (str: string, len: number, marker = ' '): string => {
  const spaceLen = len - str.length
  let preLen = 0
  let postLen = 0
  if (spaceLen % 2 === 0) {
    preLen = postLen = spaceLen / 2
  } else {
    preLen = (spaceLen - 1) / 2
    postLen = (spaceLen + 1) / 2
  }
  return marker.repeat(preLen) + str + marker.repeat(postLen)
}
