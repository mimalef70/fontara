import {
  Cloud,
  Download,
  FileDown,
  FileUp,
  Info,
  Menu,
  RotateCcw,
  ShieldCheck,
  Upload
} from "lucide-react"
import { cn } from "../../utils/cn"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "../components/ui/alert-dialog"
import { Button } from "../components/ui/button"
import { Switch } from "../components/ui/Switch"

import type { OptionsController } from "./use-options-controller"

export function AdvancedSettingsSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "t"
    | "syncSettings"
    | "handleSyncSettingsToggle"
    | "contextMenusEnabled"
    | "handleContextMenusToggle"
    | "settingsImportInputRef"
    | "handleSettingsImportFileChange"
    | "setIsImportWarningVisible"
    | "isBackupBusy"
    | "isImportWarningVisible"
    | "formatNumber"
    | "customFontList"
    | "handleChooseSettingsImportFile"
    | "handleExportSettings"
    | "isResetWarningVisible"
    | "setIsResetWarningVisible"
    | "direction"
    | "handleResetSettings"
  >
}) {
  const {
    t,
    syncSettings,
    handleSyncSettingsToggle,
    contextMenusEnabled,
    handleContextMenusToggle,
    settingsImportInputRef,
    handleSettingsImportFileChange,
    setIsImportWarningVisible,
    isBackupBusy,
    isImportWarningVisible,
    formatNumber,
    customFontList,
    handleChooseSettingsImportFile,
    handleExportSettings,
    isResetWarningVisible,
    setIsResetWarningVisible,
    direction,
    handleResetSettings
  } = model
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-2">
      <section className="fontara-panel p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.sync.title")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {syncSettings
                ? t("options.sync.enabledDescription")
                : t("options.sync.disabledDescription")}
            </p>
          </div>
          <div className="fontara-icon-tile">
            <Cloud className="size-5" />
          </div>
        </div>

        <div className="space-y-4">
          <div
            data-active={syncSettings}
            className={cn(
              "fontara-choice flex items-center justify-between gap-4 rounded-md border p-4 transition"
            )}>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#111827]">
                {t("options.sync.toggleLabel")}
              </div>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">
                {t("options.sync.toggleDescription")}
              </p>
            </div>
            <Switch
              dir="ltr"
              checked={syncSettings}
              onCheckedChange={(checked) =>
                void handleSyncSettingsToggle(checked)
              }
              aria-label={t("options.sync.toggleAria")}
              data-testid="fontara-sync-settings-toggle"
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border border-[#e1ecff] bg-[#fbfdff] px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-[#2374ff]" />
            <p className="text-xs leading-5 text-[#334155]">
              {t("options.sync.customFontsExcluded")}
            </p>
          </div>
        </div>
      </section>

      <section className="fontara-panel p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.contextMenus.title")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {contextMenusEnabled
                ? t("options.contextMenus.enabledDescription")
                : t("options.contextMenus.disabledDescription")}
            </p>
          </div>
          <div className="fontara-icon-tile">
            <Menu className="size-5" />
          </div>
        </div>

        <div
          data-active={contextMenusEnabled}
          className={cn(
            "fontara-choice flex items-center justify-between gap-4 rounded-md border p-4 transition"
          )}>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#111827]">
              {t("options.contextMenus.toggleLabel")}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {t("options.contextMenus.toggleDescription")}
            </p>
          </div>
          <Switch
            dir="ltr"
            checked={contextMenusEnabled}
            onCheckedChange={(checked) =>
              void handleContextMenusToggle(checked)
            }
            aria-label={t("options.contextMenus.toggleAria")}
            data-testid="fontara-context-menus-toggle"
          />
        </div>
      </section>

      <section className="fontara-panel p-4 sm:p-5">
        <input
          ref={settingsImportInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="fontara-settings-import-input"
          onChange={handleSettingsImportFileChange}
        />
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.backup.importTitle")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {t("options.backup.importDescription")}
            </p>
          </div>
          <div className="fontara-icon-tile">
            <FileUp className="size-5" />
          </div>
        </div>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsImportWarningVisible(true)}
            disabled={isBackupBusy}
            data-testid="fontara-settings-import-open"
            className="h-11">
            <FileUp className="size-4" />
            {t("options.backup.importButton")}
          </Button>

          {isImportWarningVisible && (
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-4">
              <h4 className="text-sm font-bold text-[#92400e]">
                {t("options.backup.importWarningTitle")}
              </h4>
              <p className="mt-2 text-xs leading-5 text-[#92400e]">
                {t("options.backup.importWarningDescription", {
                  count: formatNumber(customFontList.length)
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleChooseSettingsImportFile}
                  disabled={isBackupBusy}
                  data-testid="fontara-settings-import-choose"
                  className="h-10 bg-[#2374ff] text-white hover:bg-[#1f66df]">
                  <Upload className="size-4" />
                  {t("options.backup.chooseFileButton")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImportWarningVisible(false)}
                  disabled={isBackupBusy}
                  className="h-10">
                  {t("options.backup.cancelButton")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="fontara-panel p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.backup.exportTitle")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {t("options.backup.exportDescription")}
            </p>
          </div>
          <div className="fontara-icon-tile">
            <FileDown className="size-5" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-[#e1ecff] bg-[#fbfdff] px-4 py-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2374ff]" />
            <p className="text-xs leading-5 text-[#334155]">
              {t("options.backup.exportNote")}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void handleExportSettings()}
            disabled={isBackupBusy}
            data-testid="fontara-settings-export"
            className="h-11 bg-[#2374ff] text-white hover:bg-[#1f66df]">
            <Download className="size-4" />
            {t("options.backup.exportButton")}
          </Button>
        </div>
      </section>

      <section className="fontara-panel p-4 sm:p-5 lg:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
              <RotateCcw className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#111827]">
                {t("options.backup.resetTitle")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">
                {t("options.backup.resetDescription")}
              </p>
            </div>
          </div>

          <AlertDialog
            open={isResetWarningVisible}
            onOpenChange={setIsResetWarningVisible}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isBackupBusy}
                data-testid="fontara-settings-reset-open"
                className="h-11 shrink-0 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700">
                <RotateCcw className="size-4" />
                {t("options.backup.resetButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir={direction}>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("options.backup.resetWarningTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("options.backup.resetWarningDescription", {
                    count: formatNumber(customFontList.length)
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isBackupBusy}>
                  {t("options.backup.cancelButton")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleResetSettings()}
                  disabled={isBackupBusy}
                  data-testid="fontara-settings-reset-confirm"
                  className="bg-red-600 text-white hover:bg-red-700">
                  <RotateCcw className="size-4" />
                  {t("options.backup.resetConfirmButton")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  )
}
