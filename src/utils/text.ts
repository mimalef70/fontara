export function toPersianNumbers(input: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]
  return input.toString().replace(/\d/g, (x) => persianDigits[parseInt(x, 10)])
}
