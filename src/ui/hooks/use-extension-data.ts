import * as React from "react"

import type { FontaraExtensionData } from "../../definitions"
import { fontaraConnector } from "../connect/connector"

export function useExtensionData(): FontaraExtensionData | null {
  const [data, setData] = React.useState<FontaraExtensionData | null>(null)

  React.useEffect(() => {
    const handleChanges = (nextData: FontaraExtensionData) => {
      setData(nextData)
    }

    fontaraConnector.subscribeToChanges(handleChanges)

    return () => {
      fontaraConnector.unsubscribeFromChanges(handleChanges)
    }
  }, [])

  return data
}
