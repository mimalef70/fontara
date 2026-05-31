import * as React from "react"

import { getLocalValue, setLocalValue } from "../../utils/storage"

type Initializer<T> = T | ((value: T | undefined) => T)

export function useStorageValue<T>(
  key: string,
  initialValue?: Initializer<T>
): [T, (value: T | ((current: T) => T)) => Promise<void>] {
  const resolveInitialValue = React.useCallback(
    (value: T | undefined): T => {
      if (typeof initialValue === "function") {
        return (initialValue as (value: T | undefined) => T)(value)
      }
      if (value === undefined && initialValue !== undefined) {
        return initialValue
      }
      return value as T
    },
    [initialValue]
  )

  const [value, setValue] = React.useState<T>(() =>
    resolveInitialValue(undefined)
  )

  React.useEffect(() => {
    let mounted = true

    getLocalValue<T>(key)
      .then((storedValue) => {
        if (mounted) {
          setValue(resolveInitialValue(storedValue))
        }
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn(`Failed to read ${key} from extension storage.`, error)
        }
      })

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local" || !changes[key]) return
      setValue(resolveInitialValue(changes[key].newValue as T | undefined))
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      mounted = false
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [key, resolveInitialValue])

  const updateValue = React.useCallback(
    async (nextValue: T | ((current: T) => T)) => {
      const resolvedValue =
        typeof nextValue === "function"
          ? (nextValue as (current: T) => T)(value)
          : nextValue

      const previousValue = value
      setValue(resolvedValue)

      try {
        await setLocalValue(key, resolvedValue)
      } catch (error) {
        setValue(previousValue)
        throw error
      }
    },
    [key, value]
  )

  return [value, updateValue]
}
