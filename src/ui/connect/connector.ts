import type {
  FontaraExtensionData,
  FontaraImportedSettingsResult,
  FontaraMessageResponse,
  FontaraSettings,
  FontaraUIMessage
} from "../../definitions"
import {
  isFontaraBackgroundMessage,
  MESSAGE_TYPES_UI_TO_BG
} from "../../utils/message"

type ChangeSubscriber = (data: FontaraExtensionData) => void

class FontaraConnector {
  private changeSubscribers = new Set<ChangeSubscriber>()
  private latestData: FontaraExtensionData | null = null

  private sendRequest<T>(message: FontaraUIMessage): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage<FontaraUIMessage, FontaraMessageResponse<T>>(
        message,
        (response) => {
          const error = chrome.runtime.lastError
          if (error) {
            reject(new Error(error.message))
            return
          }

          if (response?.error) {
            reject(new Error(response.error))
            return
          }

          resolve(response?.data as T)
        }
      )
    })
  }

  private onChangesReceived = (message: unknown): void => {
    if (!isFontaraBackgroundMessage(message)) return

    this.publishChanges(message.data)
  }

  private publishChanges(data: FontaraExtensionData): void {
    if (this.changeSubscribers.size === 0) {
      this.latestData = null
      return
    }

    this.latestData = data

    for (const subscriber of this.changeSubscribers) {
      subscriber(data)
    }
  }

  private notifyWithLatestData(callback: ChangeSubscriber): void {
    const data = this.latestData
    if (!data) return

    queueMicrotask(() => {
      if (this.changeSubscribers.has(callback)) {
        callback(data)
      }
    })
  }

  private clearLatestDataIfIdle(): void {
    if (this.changeSubscribers.size === 0) {
      this.latestData = null
    }
  }

  getData(): Promise<FontaraExtensionData> {
    return this.sendRequest<FontaraExtensionData>({
      type: MESSAGE_TYPES_UI_TO_BG.GET_DATA
    }).then((data) => {
      if (this.changeSubscribers.size > 0) {
        this.latestData = data
      }
      return data
    })
  }

  changeSettings(settings: FontaraSettings): Promise<void> {
    return this.sendRequest<void>({
      data: settings,
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    })
  }

  importSettings(
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult> {
    return this.sendRequest<FontaraImportedSettingsResult>({
      data: settings,
      type: MESSAGE_TYPES_UI_TO_BG.IMPORT_SETTINGS
    })
  }

  resetSettings(): Promise<void> {
    return this.sendRequest<void>({
      type: MESSAGE_TYPES_UI_TO_BG.RESET_SETTINGS
    })
  }

  runCommand(command: string, details: { url?: string | null } = {}) {
    return this.sendRequest<void>({
      data: {
        command,
        url: details.url
      },
      type: MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND
    })
  }

  subscribeToChanges(callback: ChangeSubscriber): void {
    this.changeSubscribers.add(callback)
    this.notifyWithLatestData(callback)

    if (this.changeSubscribers.size === 1) {
      chrome.runtime.onMessage.addListener(this.onChangesReceived)
      void this.sendRequest<FontaraExtensionData>({
        type: MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES
      })
        .then((data) => this.publishChanges(data))
        .catch((error) => {
          if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
            console.warn(
              "Failed to subscribe to FontAra runtime changes.",
              error
            )
          }
        })
    }
  }

  unsubscribeFromChanges(callback: ChangeSubscriber): void {
    this.changeSubscribers.delete(callback)

    if (this.changeSubscribers.size === 0) {
      chrome.runtime.onMessage.removeListener(this.onChangesReceived)
      this.clearLatestDataIfIdle()
      void this.sendRequest<boolean>({
        type: MESSAGE_TYPES_UI_TO_BG.UNSUBSCRIBE_FROM_CHANGES
      }).catch(() => {})
    }
  }
}

export const fontaraConnector = new FontaraConnector()
