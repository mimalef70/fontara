import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import { List } from "react-window"

import {
  FONTARA_TEXT_UNICODE_RANGE,
  normalizeCustomFontUnicodeRange
} from "../../config/font-unicode-range"
import { DEFAULT_FONTS } from "../../config/fonts"
import type { SupportedUILanguage } from "../../config/i18n"
import { STORAGE_KEYS } from "../../config/storage"
import type { CustomFontFamily } from "../../custom-font-types"
import { cn } from "../../utils/cn"
import { formatFontFamilyForCSS } from "../../utils/font-data"
import {
  decodeGoogleFontValue,
  type GoogleFontData,
  getGoogleFontByValue,
  loadGoogleFontList
} from "../../utils/google-fonts"
import {
  decodeSystemFontValue,
  isSystemFontAccessSupported,
  loadSystemFonts,
  normalizeSystemFontFamilyKey,
  type SystemFontData
} from "../../utils/system-fonts"
import { useIsMobile } from "../hooks/use-mobile"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import {
  EMPTY_CUSTOM_FONT_LIST,
  getGoogleFontsEnabledInitialValue,
  getSystemFontsEnabledInitialValue
} from "../storage-defaults"
import { CheckCircle, Circle, FolderFileFont } from "./icons"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "./ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "./ui/drawer"

type DisplayFont = {
  value: string
  name: string
  author?: string
  localizedName?: Partial<Record<SupportedUILanguage, string>>
  localizedAuthor?: Partial<Record<SupportedUILanguage, string>>
  fontFamily?: string
  coverageLabel?: string
  subsets?: string[]
  unicodeRange?: string | null
}

type FontPreviewStyle = CSSProperties & {
  "--fontara-preview-font": string
}

type FontListRow =
  | {
      id: string
      title: string
      type: "group"
    }
  | {
      font: DisplayFont
      id: string
      type: "font"
    }

type FontListRowProps = {
  direction: "ltr" | "rtl"
  getFontSampleText: (font: DisplayFont) => string
  getFontDisplayName: (font: DisplayFont) => string
  getFontFamily: (font: DisplayFont) => string
  hoveredFont: string | null
  onFontSelect: (fontValue: string) => void
  onHoveredFontChange: (fontValue: string | null) => void
  rows: FontListRow[]
  selectedFont: string
}

const FONT_LIST_DEFAULT_HEIGHT = 420
const FONT_LIST_HEIGHT = "clamp(220px, calc(85vh - 15.5rem), 420px)"
const FONT_ROW_HEIGHT = 64
const GROUP_ROW_HEIGHT = 34
const RTL_TEXT_PATTERN =
  /[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/

function getFontPreviewStyle(fontFamily: string): FontPreviewStyle {
  return {
    "--fontara-preview-font": formatFontFamilyForCSS(fontFamily)
  }
}

function matchesFontSearch(
  font: DisplayFont,
  searchTerm: string,
  getFontDisplayName: (font: DisplayFont) => string,
  getAuthorLabel: (font: DisplayFont) => string,
  getFontFamily: (font: DisplayFont) => string
): boolean {
  if (!searchTerm) return true

  return (
    getFontDisplayName(font).toLowerCase().includes(searchTerm) ||
    getAuthorLabel(font).toLowerCase().includes(searchTerm) ||
    getFontFamily(font).toLowerCase().includes(searchTerm)
  )
}

function isRtlText(value: string): boolean {
  return RTL_TEXT_PATTERN.test(value)
}

function shouldUseLatinFontPreview(font: DisplayFont): boolean {
  if (!decodeGoogleFontValue(font.value) || !Array.isArray(font.subsets)) {
    return false
  }

  const subsets = new Set(font.subsets)
  const hasLatinSubset = subsets.has("latin") || subsets.has("latin-ext")
  const hasRtlSubset = subsets.has("arabic") || subsets.has("hebrew")

  return hasLatinSubset && !hasRtlSubset
}

function getFontListRowHeight(
  index: number,
  rowProps: FontListRowProps
): number {
  return rowProps.rows[index]?.type === "group"
    ? GROUP_ROW_HEIGHT
    : FONT_ROW_HEIGHT
}

function FontListRow({
  direction,
  getFontSampleText,
  getFontDisplayName,
  getFontFamily,
  hoveredFont,
  index,
  onFontSelect,
  onHoveredFontChange,
  rows,
  selectedFont,
  style
}: {
  ariaAttributes: {
    "aria-posinset": number
    "aria-setsize": number
    role: "listitem"
  }
  index: number
  style: CSSProperties
} & FontListRowProps) {
  const row = rows[index]
  if (!row) return null

  if (row.type === "group") {
    return (
      <div
        role="presentation"
        aria-hidden="true"
        dir={direction}
        style={style}
        className="flex items-end px-1 pb-2 pt-3">
        <h3 className="text-start text-xs font-semibold text-[#667085]">
          {row.title}
        </h3>
      </div>
    )
  }

  const font = row.font
  const fontName = getFontDisplayName(font)
  const fontSampleText = getFontSampleText(font)
  const optionPosition = rows
    .slice(0, index + 1)
    .filter((item) => item.type === "font").length
  const optionCount = rows.filter((item) => item.type === "font").length
  const isFontNameRtl = isRtlText(fontName)
  const isFontRowActive =
    hoveredFont === font.value || selectedFont === font.value
  const statusIcon =
    hoveredFont === font.value && selectedFont !== font.value ? (
      <Circle />
    ) : (
      selectedFont === font.value && <CheckCircle />
    )
  const fontNameSlot = (
    <span className="flex min-w-0 flex-col text-start">
      <span
        dir="auto"
        className={cn("fontara-font-preview truncate text-sm font-medium", {
          "text-[#073b7a]": selectedFont === font.value
        })}>
        {fontName}
      </span>
      {font.coverageLabel && (
        <span className="truncate text-[10px] text-[#667085]">
          {font.coverageLabel}
        </span>
      )}
    </span>
  )
  const sampleSlot = isFontRowActive ? (
    <span
      dir="auto"
      className={cn(
        "fontara-font-preview min-w-0 truncate text-center text-xs",
        {
          "text-[#073b7a]": selectedFont === font.value,
          "text-[#667085]": selectedFont !== font.value
        }
      )}>
      {fontSampleText}
    </span>
  ) : (
    <span aria-hidden="true" />
  )
  const statusSlot = (
    <div
      className={cn("flex !size-5 items-center justify-center", {
        "text-[#667085]": hoveredFont === font.value,
        "text-[#073b7a]": selectedFont === font.value
      })}>
      {isFontRowActive ? statusIcon : null}
    </div>
  )

  return (
    <button
      dir={direction}
      type="button"
      role="option"
      aria-posinset={optionPosition}
      aria-selected={selectedFont === font.value}
      aria-setsize={optionCount}
      onClick={() => onFontSelect(font.value)}
      onFocus={() => onHoveredFontChange(font.value)}
      onBlur={() => onHoveredFontChange(null)}
      onMouseEnter={() => onHoveredFontChange(font.value)}
      onMouseLeave={() => onHoveredFontChange(null)}
      data-testid={`fontara-font-option-${font.value}`}
      style={{ ...style, ...getFontPreviewStyle(getFontFamily(font)) }}
      className="group w-full cursor-pointer bg-transparent p-1 text-start">
      <span
        className={cn(
          "flex h-full w-full items-center rounded-lg p-3 transition-colors",
          {
            "bg-blue-50": selectedFont === font.value,
            "group-hover:bg-slate-50": selectedFont !== font.value
          }
        )}>
        <div
          dir="ltr"
          className={cn(
            "grid w-full items-center gap-3",
            isFontNameRtl
              ? "grid-cols-[1.25rem_minmax(0,1fr)_minmax(4.5rem,7rem)]"
              : "grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)_1.25rem]"
          )}>
          {isFontNameRtl ? (
            <>
              {statusSlot}
              {sampleSlot}
              {fontNameSlot}
            </>
          ) : (
            <>
              {fontNameSlot}
              {sampleSlot}
              {statusSlot}
            </>
          )}
        </div>
      </span>
    </button>
  )
}

const FontSelector = () => {
  const { direction, language, t } = useI18n()
  const isMobile = useIsMobile()
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [googleFonts, setGoogleFonts] = useState<GoogleFontData[]>([])
  const [googleFontsReady, setGoogleFontsReady] = useState(false)
  const [systemFonts, setSystemFonts] = useState<SystemFontData[]>([])
  const [systemFontsLoading, setSystemFontsLoading] = useState(false)
  const [systemFontsFailed, setSystemFontsFailed] = useState(false)
  const systemFontLoadGeneration = useRef(0)
  const [selectedFont, setSelectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_FONTS[0].value
  )
  const [customFontList] = useStorageValue<CustomFontFamily[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )
  const [systemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )
  const [googleFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
    getGoogleFontsEnabledInitialValue
  )

  useEffect(() => {
    let cancelled = false

    if (!googleFontsEnabled) {
      setGoogleFonts([])
      setGoogleFontsReady(false)
      return () => {
        cancelled = true
      }
    }
    if (!isOpen) {
      return () => {
        cancelled = true
      }
    }

    void loadGoogleFontList()
      .then((fonts) => {
        if (!cancelled) {
          setGoogleFonts(fonts)
          setGoogleFontsReady(true)
        }
      })
      .catch((error) => {
        if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
          console.warn("Failed to load the Google Fonts catalog.", error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [googleFontsEnabled, isOpen])

  const refreshSystemFonts = useCallback(
    async (forceRefresh: boolean) => {
      if (!systemFontsEnabled) return

      const generation = systemFontLoadGeneration.current + 1
      systemFontLoadGeneration.current = generation
      setSystemFontsLoading(true)
      setSystemFontsFailed(false)
      try {
        const state = await loadSystemFonts({ forceRefresh })
        if (generation !== systemFontLoadGeneration.current) return
        setSystemFonts(state.fonts)
        setSystemFontsFailed(state.status === "error")
      } catch (error) {
        if (generation !== systemFontLoadGeneration.current) return
        if (__DEBUG__) {
          console.warn("Failed to load system fonts.", error)
        }
        setSystemFontsFailed(true)
      } finally {
        if (generation === systemFontLoadGeneration.current) {
          setSystemFontsLoading(false)
        }
      }
    },
    [systemFontsEnabled]
  )

  useEffect(() => {
    if (!systemFontsEnabled) {
      systemFontLoadGeneration.current += 1
      setSystemFonts([])
      setSystemFontsFailed(false)
      setSystemFontsLoading(false)
      return
    }

    void refreshSystemFonts(isOpen)
  }, [isOpen, refreshSystemFonts, systemFontsEnabled])

  const getFontDisplayName = useCallback(
    (font: DisplayFont) => font.localizedName?.[language] || font.name,
    [language]
  )
  const getAuthorLabel = useCallback(
    (font: DisplayFont) => {
      if (decodeGoogleFontValue(font.value))
        return t("fontSelector.googleGroup")
      if (decodeSystemFontValue(font.value))
        return t("fontSelector.systemGroup")
      if (!font.author) return t("fontSelector.customGroup")

      return font.localizedAuthor?.[language] || font.author
    },
    [language, t]
  )
  const getFontFamily = useCallback(
    (font: DisplayFont) => font.fontFamily || font.value,
    []
  )

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const customFonts = useMemo<DisplayFont[]>(
    () =>
      customFontList.map((font) => ({
        value: font.value,
        name: font.displayName,
        fontFamily: font.value,
        coverageLabel:
          normalizeCustomFontUnicodeRange(font.unicodeRange) === null
            ? t("fontSelector.coverage.all")
            : normalizeCustomFontUnicodeRange(font.unicodeRange) ===
                FONTARA_TEXT_UNICODE_RANGE
              ? t("fontSelector.coverage.arabicPersian")
              : t("fontSelector.coverage.custom"),
        unicodeRange: font.unicodeRange
      })),
    [customFontList, t]
  )
  const allFonts = useMemo(
    () => [...DEFAULT_FONTS, ...customFonts, ...googleFonts, ...systemFonts],
    [customFonts, googleFonts, systemFonts]
  )
  const filteredFonts = useMemo(
    () =>
      normalizedSearchTerm
        ? allFonts.filter((font) =>
            matchesFontSearch(
              font,
              normalizedSearchTerm,
              getFontDisplayName,
              getAuthorLabel,
              getFontFamily
            )
          )
        : allFonts,
    [
      allFonts,
      getAuthorLabel,
      getFontDisplayName,
      getFontFamily,
      normalizedSearchTerm
    ]
  )

  const fontListRows = useMemo(
    () =>
      Object.entries(
        filteredFonts.reduce<Record<string, DisplayFont[]>>((acc, font) => {
          const author = getAuthorLabel(font)

          if (!acc[author]) {
            acc[author] = []
          }
          acc[author].push(font)
          return acc
        }, {})
      ).flatMap<FontListRow>(([author, fonts]) => {
        const groupTitle = `${t("fontSelector.groupTitlePrefix")} ${author}`

        return [
          {
            id: `group-${author}`,
            title: groupTitle,
            type: "group"
          },
          ...fonts.map((font) => ({
            font,
            id: `font-${font.value}`,
            type: "font" as const
          }))
        ]
      }),
    [filteredFonts, getAuthorLabel, t]
  )

  const handleFontSelect = useCallback(
    async (fontValue: string) => {
      try {
        await setSelectedFont(fontValue)
        setIsOpen(false)
      } catch (error) {
        if (__DEBUG__) {
          console.warn("Failed to save selected font.", error)
        }
      }
    },
    [setSelectedFont]
  )

  const selectedFontItem = allFonts.find((font) => font.value === selectedFont)
  const decodedSystemFontFamily = decodeSystemFontValue(selectedFont)
  const selectedSystemFontFamily = systemFontsEnabled
    ? decodedSystemFontFamily
    : null
  const selectedGoogleFont = googleFontsEnabled
    ? getGoogleFontByValue(selectedFont)
    : null
  const decodedGoogleFontFamily = decodeGoogleFontValue(selectedFont)
  const selectedGoogleFontFamily = googleFontsEnabled
    ? decodedGoogleFontFamily
    : null
  const fallbackFontName = getFontDisplayName(DEFAULT_FONTS[0])
  const selectedSystemFontMissing =
    Boolean(decodedSystemFontFamily) &&
    systemFontsEnabled &&
    isSystemFontAccessSupported() &&
    !systemFontsLoading &&
    !systemFontsFailed &&
    systemFonts.length > 0 &&
    !systemFonts.some(
      (font) =>
        normalizeSystemFontFamilyKey(font.fontFamily) ===
        normalizeSystemFontFamilyKey(decodedSystemFontFamily ?? "")
    )
  const selectedGoogleFontMissing =
    Boolean(decodedGoogleFontFamily) &&
    googleFontsEnabled &&
    googleFontsReady &&
    !selectedGoogleFont
  const currentFontName = selectedFontItem
    ? getFontDisplayName(selectedFontItem)
    : decodedSystemFontFamily && !systemFontsEnabled
      ? t("fontSelector.sourcePaused", {
          fallback: fallbackFontName,
          font: decodedSystemFontFamily
        })
      : decodedGoogleFontFamily && !googleFontsEnabled
        ? t("fontSelector.sourcePaused", {
            fallback: fallbackFontName,
            font: decodedGoogleFontFamily
          })
        : selectedSystemFontMissing
          ? t("fontSelector.sourceUnavailable", {
              fallback: fallbackFontName,
              font: decodedSystemFontFamily ?? ""
            })
          : selectedGoogleFontMissing
            ? t("fontSelector.sourceUnavailable", {
                fallback: fallbackFontName,
                font: decodedGoogleFontFamily ?? ""
              })
            : selectedSystemFontFamily
              ? selectedSystemFontFamily
              : selectedGoogleFont
                ? selectedGoogleFont.family
                : selectedGoogleFontFamily
                  ? selectedGoogleFontFamily
                  : t("fontSelector.placeholder")
  const fontSampleText = t("fontSelector.previewText")
  const latinFontSampleText = t("fontSelector.previewTextLatin")
  const getFontSampleText = useCallback(
    (font: DisplayFont) =>
      shouldUseLatinFontPreview(font) ? latinFontSampleText : fontSampleText,
    [fontSampleText, latinFontSampleText]
  )
  const systemFontsStatusMessage =
    systemFontsEnabled && systemFontsLoading
      ? t("fontSelector.systemLoading")
      : systemFontsEnabled && systemFontsFailed && !systemFontsLoading
        ? t("fontSelector.systemUnavailable")
        : null
  const fontListRowProps = useMemo<FontListRowProps>(
    () => ({
      direction,
      getFontSampleText,
      getFontDisplayName,
      getFontFamily,
      hoveredFont,
      onFontSelect: handleFontSelect,
      onHoveredFontChange: setHoveredFont,
      rows: fontListRows,
      selectedFont
    }),
    [
      direction,
      fontListRows,
      getFontSampleText,
      getFontDisplayName,
      getFontFamily,
      handleFontSelect,
      hoveredFont,
      selectedFont
    ]
  )

  const pickerBody = (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-2 sm:px-6">
      <div className="sticky top-0 z-10 bg-white pb-3">
        <input
          type="search"
          dir={direction}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label={t("fontSelector.searchLabel")}
          placeholder={t("fontSelector.searchPlaceholder")}
          data-testid="fontara-font-selector-search"
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
        />
      </div>
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{ height: FONT_LIST_HEIGHT }}>
        {fontListRows.length > 0 ? (
          <List
            role="listbox"
            aria-label={t("fontSelector.title")}
            className="w-full"
            defaultHeight={FONT_LIST_DEFAULT_HEIGHT}
            overscanCount={6}
            rowComponent={FontListRow}
            rowCount={fontListRows.length}
            rowHeight={getFontListRowHeight}
            rowProps={fontListRowProps}
            style={{ height: "100%", width: "100%" }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-500">
            {t("fontSelector.noResults")}
          </div>
        )}
        {fontListRows.length > 0 && systemFontsStatusMessage && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-white via-white/95 to-transparent px-3 pb-2 pt-8 text-center text-xs text-slate-500">
            <span>{systemFontsStatusMessage}</span>
            {systemFontsFailed && !systemFontsLoading && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshSystemFonts(true)}
                className="h-7 rounded-md px-2 text-[11px]">
                {t("fontSelector.systemRetry")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div dir={direction}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        aria-controls="fontara-font-selector-dialog"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t("fontSelector.triggerLabel", {
          font: currentFontName
        })}
        data-testid="fontara-font-selector-trigger"
        className="flex h-12 w-full items-center justify-between rounded-xl border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:shadow-md">
        <span className="font-estedad text-sm">{currentFontName}</span>
        <span aria-hidden="true" className="opacity-70">
          <FolderFileFont className="!size-6" />
        </span>
      </Button>
      {isMobile ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
          <DrawerContent
            id="fontara-font-selector-dialog"
            dir={direction}
            className="max-h-[85vh] overflow-hidden">
            <DrawerHeader>
              <DrawerTitle className="text-center">
                {t("fontSelector.title")}
              </DrawerTitle>
              <DrawerDescription className="text-center">
                {t("fontSelector.description")}
              </DrawerDescription>
            </DrawerHeader>
            {pickerBody}
            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  variant={null}
                  className="border border-slate-300 bg-white text-slate-950 shadow-sm hover:bg-slate-50 hover:text-slate-950">
                  {t("common.close")}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            id="fontara-font-selector-dialog"
            dir={direction}
            closeLabel={t("common.close")}
            className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl">
            <DialogHeader className="border-b border-slate-100 px-6 pb-4 pt-6 text-start sm:text-start">
              <DialogTitle>{t("fontSelector.title")}</DialogTitle>
              <DialogDescription>
                {t("fontSelector.description")}
              </DialogDescription>
            </DialogHeader>
            {pickerBody}
            <DialogFooter className="border-t border-slate-100 px-6 py-4">
              <DialogClose asChild>
                <Button
                  variant={null}
                  className="border border-slate-300 bg-white text-slate-950 shadow-sm hover:bg-slate-50 hover:text-slate-950">
                  {t("common.close")}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default FontSelector
