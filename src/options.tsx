import { useEffect } from "react"

import { browserAPI } from "./utils/utils"

function OptionsPage() {
  useEffect(() => {
    const url = browserAPI.runtime.getURL("tabs/font-uploader.html")
    window.location.replace(url)
  }, [])

  return null
}

export default OptionsPage
