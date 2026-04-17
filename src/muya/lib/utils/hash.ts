/**
 * generate constants map hash, the value is lowercase of the key,
 * also translate `_` to `-`]
 */
export const genUpper2LowerKeyHash = <T extends string>(keys: T[]): Record<T, string> => {
  return keys.reduce((acc, key) => {
    const value = key.toLowerCase().replace(/_/g, '-')
    return Object.assign(acc, { [key]: value })
  }, {} as Record<T, string>)
}

/**
 * generate constants map, the value is the key.
 */
export const generateKeyHash = <T extends string>(keys: T[]): Record<T, T> => {
  return keys.reduce((acc, key) => {
    return Object.assign(acc, { [key]: key })
  }, {} as Record<T, T>)
}
