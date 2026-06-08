import * as React from "react"

import { getLocalValue } from "../../utils/storage"
import { fontaraConnector } from "../connect/connector"

type Initializer<T> = T | ((value: T | undefined) => T)

export function useStorageValue<T>(
  key: string,
  initialValue?: Initializer<T>
): [T, (value: T | ((current: T) => T)) => Promise<void>] {
  const initialValueRef = React.useRef(initialValue)
  initialValueRef.current = initialValue

  const resolveInitialValue = React.useCallback((value: T | undefined): T => {
    const initialValue = initialValueRef.current

    if (typeof initialValue === "function") {
      return (initialValue as (value: T | undefined) => T)(value)
    }
    if (value === undefined && initialValue !== undefined) {
      return initialValue
    }
    return value as T
  }, [])

  const [value, setValue] = React.useState<T>(() =>
    resolveInitialValue(undefined)
  )
  const valueRef = React.useRef(value)

  const setSyncedValue = React.useCallback((nextValue: T) => {
    valueRef.current = nextValue
    setValue(nextValue)
  }, [])

  React.useEffect(() => {
    let mounted = true

    getLocalValue<T>(key)
      .then((storedValue) => {
        if (mounted) {
          setSyncedValue(resolveInitialValue(storedValue))
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
      setSyncedValue(
        resolveInitialValue(changes[key].newValue as T | undefined)
      )
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      mounted = false
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [key, resolveInitialValue, setSyncedValue])

  const updateValue = React.useCallback(
    async (nextValue: T | ((current: T) => T)) => {
      const previousValue = valueRef.current
      const resolvedValue =
        typeof nextValue === "function"
          ? (nextValue as (current: T) => T)(previousValue)
          : nextValue

      setSyncedValue(resolvedValue)

      try {
        await fontaraConnector.changeSettings({ [key]: resolvedValue })
      } catch (error) {
        setSyncedValue(previousValue)
        throw error
      }
    },
    [key, setSyncedValue]
  )

  return [value, updateValue]
}
