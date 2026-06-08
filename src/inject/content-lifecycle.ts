type RuntimeWarningHandler = (message: string, error: unknown) => void

type WatchUrlChangesOptions = {
  warn?: RuntimeWarningHandler
}

export function isTopFrame(): boolean {
  try {
    return window === window.top
  } catch {
    return false
  }
}

export function runWhenBodyIsReady(
  callback: () => void | Promise<void>
): () => void {
  if (document.body) {
    void callback()
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (!document.body) return

    observer.disconnect()
    void callback()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  return () => observer.disconnect()
}

export function watchUrlChanges(
  callback: () => void,
  options: WatchUrlChangesOptions = {}
): () => void {
  let currentUrl = window.location.href

  const handlePossibleUrlChange = (): void => {
    const nextUrl = window.location.href
    if (nextUrl === currentUrl) return

    currentUrl = nextUrl
    callback()
  }

  const scheduleUrlCheck = (): void => {
    queueMicrotask(handlePossibleUrlChange)
  }

  const cleanupCallbacks: Array<() => void> = []
  const historyObject = window.history

  const wrapHistoryMethod = (methodName: "pushState" | "replaceState") => {
    const originalMethod = historyObject[methodName]
    const wrappedMethod: typeof history.pushState = function (
      this: History,
      ...args: Parameters<typeof history.pushState>
    ) {
      const result = originalMethod.apply(this, args)
      scheduleUrlCheck()
      return result
    }

    try {
      historyObject[methodName] = wrappedMethod
      cleanupCallbacks.push(() => {
        if (historyObject[methodName] === wrappedMethod) {
          historyObject[methodName] = originalMethod
        }
      })
    } catch (error) {
      options.warn?.(`Failed to watch history.${methodName}.`, error)
    }
  }

  wrapHistoryMethod("pushState")
  wrapHistoryMethod("replaceState")

  addEventListener("popstate", scheduleUrlCheck)
  addEventListener("hashchange", scheduleUrlCheck)
  cleanupCallbacks.push(() => {
    removeEventListener("popstate", scheduleUrlCheck)
    removeEventListener("hashchange", scheduleUrlCheck)
  })

  if (typeof window.setInterval === "function") {
    const intervalId = window.setInterval(handlePossibleUrlChange, 1000)
    cleanupCallbacks.push(() => window.clearInterval(intervalId))
  }

  return () => {
    for (const cleanup of cleanupCallbacks.reverse()) {
      cleanup()
    }
  }
}
