"use client"

import { useToast } from "../../hooks/use-toast"
import { useI18n } from "../../i18n"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./Toast"

export function Toaster() {
  const { t } = useI18n()
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose aria-label={t("common.close")} />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
