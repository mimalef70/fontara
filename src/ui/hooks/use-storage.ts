import * as React from "react"

import { fontaraConnector } from "../connect/connector"
import { useExtensionData } from "./use-extension-data"

type Initializer<T> = T | ((value: T | undefined) => T)

export function useStorageValue<T>(
  key: string,
  initialValue?: Initializer<T>
): [T, (value: T | ((current: T) => T)) => Promise<void>] {
  const extensionData = useExtensionData()
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
    if (!extensionData) return

    setSyncedValue(
      resolveInitialValue(extensionData.settings[key] as T | undefined)
    )
  }, [extensionData, key, resolveInitialValue, setSyncedValue])

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
