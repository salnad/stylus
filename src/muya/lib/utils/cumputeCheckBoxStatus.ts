export const cumputeCheckboxStatus = (parentCheckbox: HTMLInputElement): boolean => {
  const children = parentCheckbox.parentElement?.lastElementChild?.children ?? []
  const len = children.length
  for (let i = 0; i < len; i++) {
    const checkbox = children[i]?.firstElementChild
    if (!(checkbox instanceof HTMLInputElement) || checkbox.checked === false) {
      return false
    }
  }
  return true
}
