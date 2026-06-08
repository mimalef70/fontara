import { MESSAGE_TYPES_BG_TO_CS } from "../utils/message"
import type { RuntimeControlMessage } from "./content-messaging"
import type { ContentThemeScheduler } from "./content-theme-scheduler"

type RuntimeCommandHandlerOptions = {
  scheduler: ContentThemeScheduler
  scriptId: string
}

function isMessageForScript(
  message: RuntimeControlMessage,
  scriptId: string
): boolean {
  return !message.scriptId || message.scriptId === scriptId
}

export function handleContentRuntimeCommandMessage(
  message: RuntimeControlMessage,
  options: RuntimeCommandHandlerOptions
): void {
  if (
    message?.type === MESSAGE_TYPES_BG_TO_CS.APPLY_THEME &&
    isMessageForScript(message, options.scriptId) &&
    message.data
  ) {
    options.scheduler.applyThemeCommand(message.data)
    return
  }

  if (
    message?.type === MESSAGE_TYPES_BG_TO_CS.CLEAN_UP &&
    isMessageForScript(message, options.scriptId)
  ) {
    options.scheduler.cleanUpThemeCommand()
    return
  }

  if (
    message?.type === MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED &&
    isMessageForScript(message, options.scriptId)
  ) {
    options.scheduler.scheduleLocalThemeApply("full")
    return
  }

  if (message?.action === "toggle" || message?.action === "toggleExtension") {
    options.scheduler.scheduleLocalThemeApply("full")
  }
}
