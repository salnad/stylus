import { CLASS_OR_ID } from '../config'

export const getParentCheckBox = (checkbox: HTMLInputElement): HTMLInputElement | null => {
  const parent = checkbox.parentElement?.parentElement?.parentElement
  if (!parent || parent.id === CLASS_OR_ID.AG_EDITOR_ID) {
    return null
  }

  const firstElementChild = parent.firstElementChild
  return firstElementChild instanceof HTMLInputElement ? firstElementChild : null
}
