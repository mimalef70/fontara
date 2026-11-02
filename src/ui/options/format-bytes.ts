export function formatBytes(
  bytes: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  kilobyteUnit: string,
  megabyteUnit: string
): string {
  if (bytes <= 0) return `${formatNumber(0)} ${kilobyteUnit}`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) {
    return `${formatNumber(kilobytes, {
      maximumFractionDigits: 1
    })} ${kilobyteUnit}`
  }

  return `${formatNumber(kilobytes / 1024, {
    maximumFractionDigits: 1
  })} ${megabyteUnit}`
}
