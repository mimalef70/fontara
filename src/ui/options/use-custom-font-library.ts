import React, { useState } from "react"
import {
  CUSTOM_FONT_UNICODE_RANGE_PRESETS,
  DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET,
  getCustomFontUnicodeRangePreset,
  normalizeCustomFontUnicodeRange
} from "../../config/font-unicode-range"
import type {
  CustomFontFaceMeta,
  CustomFontFamily
} from "../../custom-font-types"
import {
  bytesToBase64,
  createCustomFontFaceId,
  createCustomFontFileHash,
  normalizeCustomFontFormat
} from "../../utils/custom-font-format"
import {
  isCustomFontDisplayNameValid,
  normalizeCustomFontFamilyKey,
  normalizeCustomFontFileName,
  normalizeCustomFontText
} from "../../utils/custom-font-name"
import {
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES,
  readCustomFontFaceBytes
} from "../../utils/custom-font-storage"
import {
  getFontFileExtension,
  isFontFileSignatureSupported,
  isSupportedFontExtension
} from "../../utils/font-data"
import { fontaraConnector } from "../connect/connector"
import {
  extractCustomFontMetadata,
  validateCustomFontWithNativeFontFace
} from "./custom-font-metadata-client"
import {
  CUSTOM_FONT_UPLOAD_ERROR_KEYS,
  type CustomFontHealthState,
  type CustomFontSelectionFeedback,
  getCustomFontHealthSignature,
  type PreparedCustomFontFile,
  type SimpleCustomFontUnicodeRangePreset,
  UserFacingCustomFontError,
  unicodeRangeLabelKeys
} from "./custom-font-presentation"
import {
  classifyCustomFontMutationError,
  getCustomFontLibraryByteLength,
  resolveSimpleCustomFontSlot,
  type SimpleCustomFontSlot
} from "./custom-font-upload"
import { formatBytes } from "./format-bytes"

import type { OptionsState } from "./use-options-state"

export function useCustomFontLibrary({
  t,
  customFontList,
  formatNumber,
  toast
}: Pick<OptionsState, "t" | "customFontList" | "formatNumber" | "toast">) {
  const regularFontInputRef = React.useRef<HTMLInputElement>(null)

  const boldFontInputRef = React.useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(false)

  const [preparedRegularFont, setPreparedRegularFont] =
    useState<PreparedCustomFontFile | null>(null)

  const [preparedBoldFont, setPreparedBoldFont] =
    useState<PreparedCustomFontFile | null>(null)

  const [fontUnicodeRangePreset, setFontUnicodeRangePreset] =
    useState<SimpleCustomFontUnicodeRangePreset>(
      DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET
    )

  const [isFontCoverageSelectOpen, setIsFontCoverageSelectOpen] =
    useState(false)

  const [customFontHealth, setCustomFontHealth] = useState<
    Record<string, CustomFontHealthState>
  >({})

  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(
    null
  )

  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "error" | "ready"
  >("idle")

  const [customFontSelectionFeedback, setCustomFontSelectionFeedback] =
    useState<CustomFontSelectionFeedback | null>(null)

  const preparedFontFiles = [preparedRegularFont, preparedBoldFont].filter(
    (font): font is PreparedCustomFontFile => Boolean(font)
  )

  const regularCoversBold = preparedRegularFont?.coversBold ?? false

  const [fontName, setFontName] = useState("")

  const normalizedFontName = normalizeCustomFontText(fontName)

  const hasValidFontName = isCustomFontDisplayNameValid(normalizedFontName)

  const getCustomFontUploadErrorMessage = (error: unknown): string => {
    if (error instanceof UserFacingCustomFontError) return error.message
    return t(
      CUSTOM_FONT_UPLOAD_ERROR_KEYS[classifyCustomFontMutationError(error)]
    )
  }

  const clearPreparedFontSlot = (slot: SimpleCustomFontSlot) => {
    if (slot === "regular") {
      setPreparedRegularFont(null)
      if (regularFontInputRef.current) regularFontInputRef.current.value = ""
      return
    }

    setPreparedBoldFont(null)
    if (boldFontInputRef.current) boldFontInputRef.current.value = ""
  }

  const handleClearPreparedFontSlot = (slot: SimpleCustomFontSlot) => {
    clearPreparedFontSlot(slot)
    setCustomFontSelectionFeedback((feedback) =>
      feedback?.slot === slot ? null : feedback
    )
  }

  const resetSelectedFiles = (options: { keepFeedback?: boolean } = {}) => {
    clearPreparedFontSlot("regular")
    clearPreparedFontSlot("bold")
    if (!options.keepFeedback) setCustomFontSelectionFeedback(null)
  }

  const resetCustomFontForm = () => {
    resetSelectedFiles()
    setFontName("")
    setFontUnicodeRangePreset(DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET)
  }

  React.useEffect(() => {
    let cancelled = false
    let registeredFaces: FontFace[] = []
    const previewUnicodeRange = getCustomFontUnicodeRangePreset(
      fontUnicodeRangePreset
    )?.unicodeRange
    const files = [preparedRegularFont, preparedBoldFont].filter(
      (font): font is PreparedCustomFontFile => Boolean(font)
    )

    setPreviewFontFamily(null)
    setPreviewStatus(files.length > 0 ? "loading" : "idle")
    if (files.length === 0) return

    if (
      typeof FontFace !== "function" ||
      typeof document.fonts?.add !== "function"
    ) {
      setPreviewStatus("error")
      return
    }

    const family = `FontaraUploadPreview-${crypto.randomUUID()}`
    const pendingFaces = files.map(
      (file) =>
        new FontFace(family, file.bytes.slice(0), {
          display: "block",
          style: "normal",
          unicodeRange: previewUnicodeRange ?? undefined,
          weight:
            file.face.weight.min === file.face.weight.max
              ? String(file.face.weight.min)
              : `${file.face.weight.min} ${file.face.weight.max}`
        })
    )

    void Promise.all(pendingFaces.map((face) => face.load()))
      .then((loadedFaces) => {
        if (cancelled) return
        registeredFaces = loadedFaces
        for (const face of loadedFaces) document.fonts.add(face)
        setPreviewFontFamily(family)
        setPreviewStatus("ready")
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to render the custom font preview.", error)
        }
        if (!cancelled) setPreviewStatus("error")
      })

    return () => {
      cancelled = true
      for (const face of registeredFaces) document.fonts.delete(face)
    }
  }, [fontUnicodeRangePreset, preparedBoldFont, preparedRegularFont])

  const handleFontSlotChange = async (
    slot: SimpleCustomFontSlot,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget
    const file = event.target.files?.[0]
    if (!file) return
    setCustomFontSelectionFeedback(null)
    setIsLoading(true)

    try {
      if (slot === "bold" && regularCoversBold) {
        throw new UserFacingCustomFontError(
          t("options.toast.boldCoveredByVariable")
        )
      }
      if (/\.(?:ttc|otc)$/i.test(file.name)) {
        throw new UserFacingCustomFontError(
          t("options.toast.fontCollectionUnsupported")
        )
      }
      const extension = getFontFileExtension(file.name)
      const format = normalizeCustomFontFormat(extension)
      if (!format || !isSupportedFontExtension(extension)) {
        throw new UserFacingCustomFontError(t("options.toast.invalidExtension"))
      }
      if (file.size > MAX_CUSTOM_FONT_FILE_SIZE_BYTES) {
        throw new UserFacingCustomFontError(t("options.toast.fileTooLarge"))
      }

      const bytes = await file.arrayBuffer()
      const byteView = new Uint8Array(bytes)
      if (!isFontFileSignatureSupported(extension, byteView)) {
        throw new UserFacingCustomFontError(t("options.toast.invalidSignature"))
      }
      const fileHash = await createCustomFontFileHash(byteView)
      const storedHashes = new Set(
        customFontList.flatMap((family) =>
          family.faces.map((face) => face.fileHash)
        )
      )
      const otherFont =
        slot === "regular" ? preparedBoldFont : preparedRegularFont
      if (storedHashes.has(fileHash) || otherFont?.face.fileHash === fileHash) {
        throw new UserFacingCustomFontError(t("options.toast.duplicateFile"))
      }

      await validateCustomFontWithNativeFontFace(bytes.slice(0), format)
      const metadata = await extractCustomFontMetadata(
        file.name,
        bytes.slice(0)
      ).catch((error) => {
        if (__DEBUG__) {
          console.warn(
            "Custom font metadata was unavailable; using the selected slot.",
            error
          )
        }
        return null
      })
      const resolution = resolveSimpleCustomFontSlot(metadata, slot)
      if (!resolution.ok) {
        if (resolution.reason === "unsupported-style") {
          throw new UserFacingCustomFontError(
            t("options.toast.simpleFontStyleUnsupported")
          )
        }
        throw new UserFacingCustomFontError(
          t("options.toast.variableWeightMissing", {
            weight: formatNumber(resolution.requiredWeight ?? 400)
          })
        )
      }

      const prepared: PreparedCustomFontFile = {
        bytes,
        coversBold: resolution.coversBold,
        isVariable: resolution.isVariable,
        slot,
        face: {
          id: createCustomFontFaceId(fileHash),
          fileHash,
          fileName: normalizeCustomFontFileName(file.name, `font.${format}`),
          format,
          byteLength: bytes.byteLength,
          weight: resolution.weight,
          style: "normal",
          stretch: { min: 100, max: 100 },
          axes: metadata?.axes ?? [],
          validation: "verified"
        }
      }

      if (slot === "regular") {
        setPreparedRegularFont(prepared)
        if (resolution.coversBold && preparedBoldFont) {
          clearPreparedFontSlot("bold")
          toast({ title: t("options.toast.variableReplacedBold") })
        }
      } else {
        setPreparedBoldFont(prepared)
      }
    } catch (error) {
      if (__DEBUG__ && !(error instanceof UserFacingCustomFontError)) {
        console.warn("Failed to process a custom font file.", error)
      }
      const feedback = {
        slot,
        title:
          error instanceof UserFacingCustomFontError
            ? error.message
            : t("options.toast.fontProcessingError")
      }
      input.value = ""
      setCustomFontSelectionFeedback(feedback)
      toast({
        title: feedback.title
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveFont = async () => {
    if (!preparedRegularFont || !hasValidFontName) {
      toast({ title: t("options.toast.emptyFields") })
      return
    }

    setIsLoading(true)

    try {
      const isDuplicateName = customFontList.some(
        (font) =>
          font.displayName.toLocaleLowerCase() ===
          normalizedFontName.toLocaleLowerCase()
      )

      if (isDuplicateName) {
        throw new UserFacingCustomFontError(
          t("options.toast.duplicateFontName")
        )
      }

      const prospectiveLibraryBytes = getCustomFontLibraryByteLength(
        customFontList,
        preparedFontFiles.map((file) => file.face)
      )
      if (prospectiveLibraryBytes > MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) {
        throw new UserFacingCustomFontError(
          t("options.toast.customFontLibraryFull")
        )
      }

      let value = `f${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}-Fontara`
      while (customFontList.some((font) => font.value === value)) {
        value = `f${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}-Fontara`
      }
      const family = {
        value,
        displayName: normalizedFontName,
        sourceFamilyKey: normalizeCustomFontFamilyKey(normalizedFontName),
        unicodeRange:
          getCustomFontUnicodeRangePreset(fontUnicodeRangePreset)
            ?.unicodeRange ?? null,
        faces: preparedFontFiles.map((file) => file.face)
      }

      let transactionId: string | null = null
      try {
        const transaction =
          await fontaraConnector.beginCustomFontTransaction(family)
        transactionId = transaction.transactionId
        for (const file of preparedFontFiles) {
          await fontaraConnector.putCustomFontFace(
            transactionId,
            file.face.id,
            bytesToBase64(new Uint8Array(file.bytes))
          )
        }
        await fontaraConnector.commitCustomFontTransaction(transactionId)
      } catch (error) {
        if (transactionId) {
          await fontaraConnector
            .abortCustomFontTransaction(transactionId)
            .catch(() => {})
        }
        throw error
      }

      toast({
        title: t("options.toast.fontAdded"),
        description: t("options.toast.fontAddedSelectFromPopup")
      })

      resetCustomFontForm()
    } catch (error) {
      toast({
        title: getCustomFontUploadErrorMessage(error)
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFont = async (fontValue: string) => {
    try {
      await fontaraConnector.deleteCustomFont(fontValue)
      toast({ title: t("options.toast.fontDeleted") })
    } catch (_error) {
      toast({
        title: t("options.toast.fontDeleteError")
      })
    }
  }

  const handleCheckCustomFont = async (font: CustomFontFamily) => {
    const signature = getCustomFontHealthSignature(font)
    setCustomFontHealth((current) => ({
      ...current,
      [font.value]: { signature, status: "checking" }
    }))

    try {
      if (font.faces.length === 0) {
        throw new Error("custom-font-family-has-no-faces")
      }

      for (const face of font.faces) {
        if (face.validation === "failed") {
          throw new Error("custom-font-face-validation-failed")
        }
        const bytes = await readCustomFontFaceBytes(face.fileHash)
        if (!bytes || bytes.byteLength !== face.byteLength) {
          throw new Error("missing-custom-font-face-blob")
        }
        const bytesCopy = bytes.slice().buffer as ArrayBuffer
        await validateCustomFontWithNativeFontFace(bytesCopy, face.format)
      }

      setCustomFontHealth((current) => ({
        ...current,
        [font.value]: { signature, status: "ready" }
      }))
      toast({ title: t("options.customFonts.healthReady") })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to verify a saved custom font family.", error)
      }
      setCustomFontHealth((current) => ({
        ...current,
        [font.value]: { signature, status: "error" }
      }))
      toast({
        title: t("options.customFonts.healthError"),
        description: t("options.customFonts.healthErrorDescription")
      })
    }
  }

  const fontStorageBytes = new Map(
    customFontList.flatMap((family) =>
      family.faces.map((face) => [face.fileHash, face.byteLength] as const)
    )
  )

  const customFontStorageBytes = Array.from(fontStorageBytes.values()).reduce(
    (total, bytes) => total + bytes,
    0
  )

  const customFontStoragePercent = Math.min(
    100,
    (customFontStorageBytes / MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) * 100
  )

  const customFontStorageLimit = formatBytes(
    MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES,
    formatNumber,
    t("unit.kb"),
    t("unit.mb")
  )

  const getCustomFontUnicodeRangeLabel = React.useCallback(
    (unicodeRange: string | null | undefined): string => {
      const normalizedRange = normalizeCustomFontUnicodeRange(unicodeRange)
      const matchingPreset = CUSTOM_FONT_UNICODE_RANGE_PRESETS.find(
        (preset) => preset.unicodeRange === normalizedRange
      )

      if (matchingPreset) {
        return t(unicodeRangeLabelKeys[matchingPreset.id])
      }

      return t("options.savedFonts.unicodeRangeCustom")
    },
    [t]
  )

  const getCustomFontFaceSummary = React.useCallback(
    (faces: CustomFontFaceMeta[]): string => {
      const staticNormalWeights = Array.from(
        new Set(
          faces
            .filter(
              (face) =>
                face.style === "normal" && face.weight.min === face.weight.max
            )
            .map((face) => face.weight.min)
        )
      ).sort((a, b) => a - b)
      if (staticNormalWeights.length > 2) {
        return `${formatNumber(staticNormalWeights[0])}–${formatNumber(
          staticNormalWeights[staticNormalWeights.length - 1]
        )}`
      }

      const roles = new Set<string>()
      for (const face of faces) {
        if (face.style === "italic") {
          roles.add(t("options.customFonts.face.italic"))
        } else if (face.style === "oblique") {
          roles.add(t("options.customFonts.face.oblique"))
        } else if (face.weight.min !== face.weight.max) {
          roles.add(t("options.customFonts.face.variable"))
        } else if (face.weight.min >= 600) {
          roles.add(t("options.customFonts.face.bold"))
        } else {
          roles.add(t("options.customFonts.face.regular"))
        }
      }
      return Array.from(roles).join(" / ")
    },
    [formatNumber, t]
  )
  return {
    regularFontInputRef,
    boldFontInputRef,
    isLoading,
    preparedRegularFont,
    preparedBoldFont,
    fontUnicodeRangePreset,
    setFontUnicodeRangePreset,
    isFontCoverageSelectOpen,
    setIsFontCoverageSelectOpen,
    customFontHealth,
    previewFontFamily,
    previewStatus,
    customFontSelectionFeedback,
    regularCoversBold,
    fontName,
    setFontName,
    hasValidFontName,
    handleClearPreparedFontSlot,
    handleFontSlotChange,
    handleSaveFont,
    handleDeleteFont,
    handleCheckCustomFont,
    customFontStorageBytes,
    customFontStoragePercent,
    customFontStorageLimit,
    getCustomFontUnicodeRangeLabel,
    getCustomFontFaceSummary
  }
}
