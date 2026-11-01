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
  const mutationSequenceRef = React.useRef(0)
  const pendingMutationRef = React.useRef<{
    acknowledgedRevision: number | null
    id: number
    previousValue: T
  } | null>(null)

  const setSyncedValue = React.useCallback((nextValue: T) => {
    valueRef.current = nextValue
    setValue(nextValue)
  }, [])

  React.useEffect(() => {
    if (!extensionData) return

    const pendingMutation = pendingMutationRef.current
    if (pendingMutation) {
      if (pendingMutation.acknowledgedRevision === null) return
      if (
        extensionData.settingsRevision < pendingMutation.acknowledgedRevision
      ) {
        return
      }
      pendingMutationRef.current = null
    }

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
      const mutationId = mutationSequenceRef.current + 1
      mutationSequenceRef.current = mutationId
      pendingMutationRef.current = {
        acknowledgedRevision: null,
        id: mutationId,
        previousValue
      }

      setSyncedValue(resolvedValue)

      try {
        const result = await fontaraConnector.changeSettings({
          [key]: resolvedValue
        })
        if (pendingMutationRef.current?.id === mutationId) {
          pendingMutationRef.current.acknowledgedRevision = result.revision
        }
      } catch (error) {
        if (pendingMutationRef.current?.id === mutationId) {
          pendingMutationRef.current = null
          setSyncedValue(previousValue)
        }
        throw error
      }
    },
    [key, setSyncedValue]
  )

  return [value, updateValue]
}

export function useDebouncedStorageValue<T>(
  key: string,
  initialValue?: Initializer<T>,
  delayMs = 150
): [T, (value: T | ((current: T) => T)) => Promise<void>, () => Promise<void>] {
  const [storedValue, setStoredValue] = useStorageValue(key, initialValue)
  const [value, setValue] = React.useState(storedValue)
  const valueRef = React.useRef(value)
  const storedValueRef = React.useRef(storedValue)
  const pendingRef = React.useRef<{ generation: number; value: T } | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = React.useRef(0)

  storedValueRef.current = storedValue

  const setVisualValue = React.useCallback((nextValue: T) => {
    valueRef.current = nextValue
    setValue(nextValue)
  }, [])

  React.useEffect(() => {
    if (!pendingRef.current) {
      setVisualValue(storedValue)
    }
  }, [setVisualValue, storedValue])

  const flush = React.useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const pending = pendingRef.current
    if (!pending) return

    try {
      await setStoredValue(pending.value)
      if (pendingRef.current?.generation === pending.generation) {
        pendingRef.current = null
      }
    } catch (error) {
      if (pendingRef.current?.generation === pending.generation) {
        pendingRef.current = null
        setVisualValue(storedValueRef.current)
      }
      throw error
    }
  }, [setStoredValue, setVisualValue])

  const updateValue = React.useCallback(
    async (nextValue: T | ((current: T) => T)) => {
      const resolvedValue =
        typeof nextValue === "function"
          ? (nextValue as (current: T) => T)(valueRef.current)
          : nextValue
      const generation = generationRef.current + 1
      generationRef.current = generation
      pendingRef.current = { generation, value: resolvedValue }
      setVisualValue(resolvedValue)

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void flush()
      }, delayMs)
    },
    [delayMs, flush, setVisualValue]
  )

  React.useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      void flush()
    },
    [flush]
  )

  return [value, updateValue, flush]
}
