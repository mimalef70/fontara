import React, { useState } from "react"
import { version } from "../../../package.json"
import { STORAGE_KEYS } from "../../config/storage"
import type { CustomFontFamily } from "../../custom-font-types"
import { base64ToBytes } from "../../utils/custom-font-format"
import { createCustomFontFaceBackupMap } from "../../utils/custom-font-storage"
import {
  createSettingsBackup,
  createSettingsBackupFileName,
  FONTARA_SETTINGS_STORAGE_KEYS,
  getSettingsBackupDefaults,
  MAX_SETTINGS_BACKUP_FILE_SIZE_BYTES,
  parseSettingsBackupText,
  prepareSettingsBackupImport
} from "../../utils/settings-backup"
import { getLocalValues } from "../../utils/storage"
import { normalizeStorageValues } from "../../utils/storage-normalization"
import { fontaraConnector } from "../connect/connector"
import {
  downloadTextFile,
  getSettingsImportErrorDescriptionKey,
  readTextFile,
  removeContextMenusPermission,
  requestContextMenusPermission
} from "./backup-helpers"
import { validateCustomFontWithNativeFontFace } from "./custom-font-metadata-client"

import type { OptionsState } from "./use-options-state"

export function useSettingsBackup({
  toast,
  t,
  formatNumber,
  setSyncSettings,
  setContextMenusEnabled
}: Pick<
  OptionsState,
  "toast" | "t" | "formatNumber" | "setSyncSettings" | "setContextMenusEnabled"
>) {
  const settingsImportInputRef = React.useRef<HTMLInputElement>(null)

  const [isBackupBusy, setIsBackupBusy] = useState(false)

  const [isImportWarningVisible, setIsImportWarningVisible] = useState(false)

  const [isResetWarningVisible, setIsResetWarningVisible] = useState(false)

  const handleExportSettings = async () => {
    setIsBackupBusy(true)

    try {
      const settings = await normalizeStorageValues(
        await getLocalValues(getSettingsBackupDefaults())
      )
      const customFontFaces = await createCustomFontFaceBackupMap(
        settings[STORAGE_KEYS.CUSTOM_FONT_LIST] as CustomFontFamily[]
      )
      const backup = createSettingsBackup(settings, {
        extensionVersion: version,
        customFontFaces
      })
      downloadTextFile(
        createSettingsBackupFileName(),
        JSON.stringify(backup, null, 2)
      )
      toast({
        title: t("options.toast.settingsExported"),
        description: t("options.toast.settingsExportedDescription", {
          count: formatNumber(FONTARA_SETTINGS_STORAGE_KEYS.length)
        })
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to export FontAra settings.", error)
      }
      toast({ title: t("options.toast.settingsExportError") })
    } finally {
      setIsBackupBusy(false)
    }
  }

  const handleChooseSettingsImportFile = () => {
    settingsImportInputRef.current?.click()
  }

  const handleSettingsImportFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (file.size > MAX_SETTINGS_BACKUP_FILE_SIZE_BYTES) {
      input.value = ""
      toast({
        title: t("options.toast.settingsImportError"),
        description: t("options.toast.settingsImportFileTooLarge")
      })
      return
    }

    setIsBackupBusy(true)
    try {
      const parsedBackup = parseSettingsBackupText(await readTextFile(file))
      const preparedImport = await prepareSettingsBackupImport(parsedBackup)
      const replacesCustomFonts =
        Object.getOwnPropertyDescriptor(
          parsedBackup.settings,
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ) !== undefined
      const transactionIds: string[] = []
      try {
        if (!replacesCustomFonts) {
          const importedSettings = await fontaraConnector.importSettings(
            preparedImport.settings
          )
          setIsImportWarningVisible(false)
          toast({
            title: t("options.toast.settingsImported"),
            description: t("options.toast.settingsImportedDescription", {
              count: formatNumber(importedSettings.importedKeyCount)
            })
          })
          return
        }

        for (const preparedFamily of preparedImport.customFontFamilies) {
          const transaction = await fontaraConnector.beginCustomFontTransaction(
            preparedFamily.family,
            "replace-library"
          )
          transactionIds.push(transaction.transactionId)
          for (const face of preparedFamily.family.faces) {
            const bytes = base64ToBytes(preparedFamily.faceData[face.id])
            if (!bytes) throw new Error("invalid-custom-font-backup-face")
            if (face.validation !== "failed") {
              try {
                await validateCustomFontWithNativeFontFace(
                  bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength
                  ) as ArrayBuffer,
                  face.format
                )
              } catch {
                throw new Error("invalid-custom-font-backup-face")
              }
            }
            await fontaraConnector.putCustomFontFace(
              transaction.transactionId,
              face.id,
              preparedFamily.faceData[face.id]
            )
          }
        }

        const importedSettings = await fontaraConnector.importCustomFontBatch(
          transactionIds,
          preparedImport.settings
        )
        setIsImportWarningVisible(false)
        toast({
          title: t("options.toast.settingsImported"),
          description: t("options.toast.settingsImportedDescription", {
            count: formatNumber(importedSettings.importedKeyCount)
          })
        })
      } catch (error) {
        await Promise.all(
          transactionIds.map((transactionId) =>
            fontaraConnector
              .abortCustomFontTransaction(transactionId)
              .catch(() => {})
          )
        )
        throw error
      }
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to import FontAra settings.", error)
      }
      toast({
        title: t("options.toast.settingsImportError"),
        description: t(getSettingsImportErrorDescriptionKey(error))
      })
    } finally {
      setIsBackupBusy(false)
      input.value = ""
    }
  }

  const handleResetSettings = async () => {
    setIsBackupBusy(true)

    try {
      await fontaraConnector.resetSettings()
      setIsImportWarningVisible(false)
      setIsResetWarningVisible(false)
      toast({ title: t("options.toast.settingsReset") })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to reset FontAra settings.", error)
      }
      toast({ title: t("options.toast.settingsResetError") })
    } finally {
      setIsBackupBusy(false)
    }
  }

  const handleSyncSettingsToggle = async (checked: boolean) => {
    try {
      await setSyncSettings(checked)
      toast({
        title: checked
          ? t("options.toast.syncEnabled")
          : t("options.toast.syncDisabled")
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update FontAra sync settings.", error)
      }
      toast({ title: t("options.toast.syncError") })
    }
  }

  const handleContextMenusToggle = async (checked: boolean) => {
    try {
      if (checked && !(await requestContextMenusPermission())) {
        toast({ title: t("options.toast.contextMenusPermissionDenied") })
        return
      }

      await setContextMenusEnabled(checked)
      if (!checked) {
        await removeContextMenusPermission()
      }
      toast({
        title: checked
          ? t("options.toast.contextMenusEnabled")
          : t("options.toast.contextMenusDisabled")
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update FontAra context menu setting.", error)
      }
      toast({ title: t("options.toast.contextMenusError") })
    }
  }
  return {
    settingsImportInputRef,
    isBackupBusy,
    isImportWarningVisible,
    setIsImportWarningVisible,
    isResetWarningVisible,
    setIsResetWarningVisible,
    handleExportSettings,
    handleChooseSettingsImportFile,
    handleSettingsImportFileChange,
    handleResetSettings,
    handleSyncSettingsToggle,
    handleContextMenusToggle
  }
}
