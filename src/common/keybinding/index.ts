const isOsx = process.platform === 'darwin'

const normalizeAccelerator = (accelerator: string): string => {
  return accelerator.toLowerCase()
    .replace('commandorcontrol', isOsx ? 'cmd' : 'ctrl')
    .replace('cmdorctrl', isOsx ? 'cmd' : 'ctrl')
    .replace('control', 'ctrl')
    .replace('meta', 'cmd')
    .replace('command', 'cmd')
    .replace('option', 'alt')
}

export const isEqualAccelerator = (a: string, b: string): boolean => {
  const normalizedA = normalizeAccelerator(a)
  const normalizedB = normalizeAccelerator(b)
  const firstPlusIndex = normalizedA.indexOf('+')
  const secondPlusIndex = normalizedB.indexOf('+')

  if (firstPlusIndex === -1 && secondPlusIndex === -1) {
    return normalizedA === normalizedB
  } else if (firstPlusIndex === -1 || secondPlusIndex === -1) {
    return false
  }

  const partsA = normalizedA.split('+')
  const partsB = normalizedB.split('+')
  if (partsA.length !== partsB.length) {
    return false
  }

  const intersection = new Set([...partsA, ...partsB])
  return intersection.size === partsB.length
}
