const ID_PREFIX = 'ag-'
let id = 0

export const getUniqueId = (): string => `${ID_PREFIX}${id++}`

export const getLongUniqueId = (): string => `${getUniqueId()}-${Date.now().toString(32)}`
