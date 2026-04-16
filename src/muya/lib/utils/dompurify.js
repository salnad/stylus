import DOMPurify from 'dompurify'

const { sanitize, isValidAttribute } = DOMPurify

export { isValidAttribute }

export default sanitize
