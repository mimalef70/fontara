export const RTL_SCRIPT_REGEX = /[\p{Script=Arabic}\p{Script=Hebrew}]/u

const LTR_SCRIPT_REGEX = /\p{Script=Latin}/u
const STRONG_DIRECTIONAL_CHAR_REGEX = /[\p{L}\p{N}]/u
const STRONG_LETTER_REGEX = /\p{L}/u

export function isRtlCharacter(value: string): boolean {
  return RTL_SCRIPT_REGEX.test(value)
}

export function isRtlText(value: string): boolean {
  return RTL_SCRIPT_REGEX.test(value)
}

export function isLtrCharacter(value: string): boolean {
  return LTR_SCRIPT_REGEX.test(value)
}

export function isStrongDirectionalCharacter(value: string): boolean {
  return STRONG_DIRECTIONAL_CHAR_REGEX.test(value)
}

export function isStrongLetter(value: string): boolean {
  return STRONG_LETTER_REGEX.test(value)
}
