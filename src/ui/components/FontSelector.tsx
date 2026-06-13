import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react"
import { List } from "react-window"

import { DEFAULT_FONTS } from "../../config/fonts"
import type { SupportedUILanguage } from "../../config/i18n"
import { STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { cn } from "../../utils/cn"
import { formatFontFamilyForCSS } from "../../utils/font-data"
import {
  decodeGoogleFontValue,
  getGoogleFontByValue,
  getGoogleFontList
} from "../../utils/google-fonts"
import {
  decodeSystemFontValue,
  getSystemFontList,
  type SystemFontData
} from "../../utils/system-fonts"
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
  ariaAttributes,
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
        {...ariaAttributes}
        dir={direction}
        style={style}
        className="flex items-end px-1 pb-2 pt-3">
        <h3 className="text-start text-xs font-semibold text-gray-400">
          {row.title}
        </h3>
      </div>
    )
  }

  const font = row.font
  const fontName = getFontDisplayName(font)
  const fontSampleText = getFontSampleText(font)
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
    <span
      dir="auto"
      className={cn(
        "fontara-font-preview min-w-0 truncate text-start text-sm font-medium",
        {
          "text-[#0D92F4]": selectedFont === font.value
        }
      )}>
      {fontName}
    </span>
  )
  const sampleSlot = isFontRowActive ? (
    <span
      dir="auto"
      className={cn(
        "fontara-font-preview min-w-0 truncate text-center text-xs",
        {
          "text-[#0D92F4] opacity-70": selectedFont === font.value,
          "text-gray-400": selectedFont !== font.value
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
        "text-gray-400": hoveredFont === font.value,
        "text-[#0D92F4]": selectedFont === font.value
      })}>
      {isFontRowActive ? statusIcon : null}
    </div>
  )

  return (
    <div {...ariaAttributes} style={style} className="py-1">
      <button
        dir={direction}
        type="button"
        onClick={() => onFontSelect(font.value)}
        onMouseEnter={() => onHoveredFontChange(font.value)}
        onMouseLeave={() => onHoveredFontChange(null)}
        data-testid={`fontara-font-option-${font.value}`}
        style={getFontPreviewStyle(getFontFamily(font))}
        className={cn(
          "relative flex h-14 w-full cursor-pointer items-center rounded-md border-0 bg-transparent p-3 text-start",
          {
            "bg-blue-50": selectedFont === font.value,
            "hover:bg-gray-50": selectedFont !== font.value
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
      </button>
    </div>
  )
}

const FontSelector = () => {
  const { direction, language, t } = useI18n()
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [systemFonts, setSystemFonts] = useState<SystemFontData[]>([])
  const [systemFontsLoading, setSystemFontsLoading] = useState(false)
  const [systemFontsFailed, setSystemFontsFailed] = useState(false)
  const [selectedFont, setSelectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_FONTS[0].value
  )
  const [customFontList] = useStorageValue<FontData[]>(
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

    if (!systemFontsEnabled) {
      setSystemFonts([])
      setSystemFontsFailed(false)
      setSystemFontsLoading(false)
      return () => {
        cancelled = true
      }
    }

    setSystemFontsLoading(true)
    setSystemFontsFailed(false)

    getSystemFontList()
      .then((fonts) => {
        if (cancelled) return
        setSystemFonts(fonts)
        setSystemFontsFailed(fonts.length === 0)
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to load system fonts.", error)
        }
        if (!cancelled) {
          setSystemFonts([])
          setSystemFontsFailed(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSystemFontsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [systemFontsEnabled])

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
  const googleFonts = useMemo(
    () => (googleFontsEnabled ? getGoogleFontList() : []),
    [googleFontsEnabled]
  )
  const allFonts = useMemo(
    () => [...DEFAULT_FONTS, ...customFontList, ...googleFonts, ...systemFonts],
    [customFontList, googleFonts, systemFonts]
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
  const selectedSystemFontFamily = systemFontsEnabled
    ? decodeSystemFontValue(selectedFont)
    : null
  const selectedGoogleFont = googleFontsEnabled
    ? getGoogleFontByValue(selectedFont)
    : null
  const currentFontName = selectedFontItem
    ? getFontDisplayName(selectedFontItem)
    : selectedSystemFontFamily
      ? selectedSystemFontFamily
      : selectedGoogleFont
        ? selectedGoogleFont.family
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

  return (
    <div dir={direction}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        data-testid="fontara-font-selector-trigger"
        className="w-full !h-[3rem] !shadow-[0_3px_8px_rgba(0,0,0,0.08)] !transition-all !duration-300  flex justify-between items-center hover:!bg-white">
        <span className="font-estedad text-sm">{currentFontName}</span>
        <span className="opacity-70">
          <FolderFileFont className="!size-6" />
        </span>
      </Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
        <DrawerContent dir={direction} className="max-h-[85vh] overflow-hidden">
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {t("fontSelector.title")}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {t("fontSelector.description")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 py-2">
            <div className="sticky top-0 z-10 bg-white pb-3">
              <input
                type="search"
                dir={direction}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("fontSelector.searchPlaceholder")}
                data-testid="fontara-font-selector-search"
                className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15"
              />
            </div>
            <div
              className="relative w-full shrink-0 overflow-hidden"
              style={{ height: FONT_LIST_HEIGHT }}>
              {fontListRows.length > 0 ? (
                <List
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
                <div className="flex h-full items-center justify-center px-3 text-center text-xs text-gray-400">
                  {t("fontSelector.noResults")}
                </div>
              )}
              {fontListRows.length > 0 && systemFontsStatusMessage && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent px-3 pb-2 pt-8 text-center text-xs text-gray-400">
                  {systemFontsStatusMessage}
                </div>
              )}
            </div>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{t("common.close")}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default FontSelector
