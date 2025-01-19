import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

declare const chrome: any
declare const browser: any
export const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome
