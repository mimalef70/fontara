import { Sparkles } from "lucide-react"
import FontSelector from "../components/FontSelector"
import { Card, CardContent } from "../components/ui/card"
import { CustomFontUploadSection } from "./custom-font-upload-section"
import { FontSourcesSection } from "./font-sources-section"
import { SavedFontsSection } from "./saved-fonts-section"
import type { OptionsController } from "./use-options-controller"

export function FontsSettingsSection({ model }: { model: OptionsController }) {
  const { t, activeFontLabel } = model
  return (
    <div className="space-y-5">
      <Card className="fontara-settings-card border-0">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="fontara-icon-tile">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">
                {t("options.fonts.globalTitle")}
              </h3>
              <p className="mt-1.5 text-xs leading-6 text-slate-500">
                {t("options.fonts.globalDescription")}
              </p>
              <p className="mt-2 text-sm font-bold text-blue-700">
                {activeFontLabel}
              </p>
            </div>
          </div>
          <FontSelector />
        </CardContent>
      </Card>

      <FontSourcesSection model={model} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <CustomFontUploadSection model={model} />

        <SavedFontsSection model={model} />
      </div>
    </div>
  )
}
