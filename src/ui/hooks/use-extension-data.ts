import * as React from "react"

import type { FontaraExtensionData } from "../../definitions"
import { fontaraConnector } from "../connect/connector"

const ExtensionDataContext = React.createContext<
  FontaraExtensionData | null | undefined
>(undefined)

function useSubscribedExtensionData(
  enabled: boolean
): FontaraExtensionData | null {
  const [data, setData] = React.useState<FontaraExtensionData | null>(null)

  React.useEffect(() => {
    if (!enabled) return

    const handleChanges = (nextData: FontaraExtensionData) => {
      setData(nextData)
    }

    fontaraConnector.subscribeToChanges(handleChanges)

    return () => {
      fontaraConnector.unsubscribeFromChanges(handleChanges)
    }
  }, [enabled])

  return data
}

export function ExtensionDataProvider({
  children
}: {
  children: React.ReactNode
}) {
  const data = useSubscribedExtensionData(true)

  return React.createElement(
    ExtensionDataContext.Provider,
    { value: data },
    children
  )
}

export function useExtensionData(): FontaraExtensionData | null {
  const contextData = React.useContext(ExtensionDataContext)
  const fallbackData = useSubscribedExtensionData(contextData === undefined)

  return contextData === undefined ? fallbackData : contextData
}
