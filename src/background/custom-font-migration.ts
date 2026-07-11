import { STORAGE_KEYS } from "../config/storage"
import type { CustomFontFamily } from "../custom-font-types"
import {
  getLegacyCustomFontMigrationBytes,
  isLegacyCustomFontData,
  normalizeCustomFontFamilies,
  normalizeLegacyCustomFontFamily
} from "../utils/custom-font-normalization"
import {
  CUSTOM_FONT_STORAGE_SCHEMA_VERSION,
  CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  writeCustomFontFaceBytes,
  writeCustomFontRecoveryBytes
} from "../utils/custom-font-storage"
import { setLocalValues } from "../utils/storage"

export type CustomFontMigrationResult = {
  changed: boolean
  values: Record<string, unknown>
}

/**
 * Moves legacy inline data URLs to content-addressed local blobs. The settings
 * list is not replaced until every valid face has been durably written, so an
 * interrupted migration safely resumes on the next background start.
 */
export async function migrateLegacyCustomFontStorage(
  values: Record<string, unknown>
): Promise<CustomFontMigrationResult> {
  const rawList = values[STORAGE_KEYS.CUSTOM_FONT_LIST]
  if (!Array.isArray(rawList)) {
    return { changed: false, values }
  }

  const hasLegacyFonts = rawList.some(isLegacyCustomFontData)
  if (!hasLegacyFonts) {
    if (
      values[CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY] ===
      CUSTOM_FONT_STORAGE_SCHEMA_VERSION
    ) {
      return { changed: false, values }
    }
    await setLocalValues({
      [CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY]:
        CUSTOM_FONT_STORAGE_SCHEMA_VERSION
    })
    return {
      changed: true,
      values: {
        ...values,
        [CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY]:
          CUSTOM_FONT_STORAGE_SCHEMA_VERSION
      }
    }
  }

  const migratedFamilies: CustomFontFamily[] = []
  for (const candidate of rawList) {
    if (!isLegacyCustomFontData(candidate)) {
      migratedFamilies.push(...(await normalizeCustomFontFamilies([candidate])))
      continue
    }

    const family = await normalizeLegacyCustomFontFamily(candidate)
    if (!family) continue
    const face = family.faces[0]
    const bytes = getLegacyCustomFontMigrationBytes(candidate)
    if (bytes.byteLength > MAX_CUSTOM_FONT_FILE_SIZE_BYTES) {
      face.validation = "failed"
      await writeCustomFontRecoveryBytes(face, bytes)
    } else {
      await writeCustomFontFaceBytes(face, bytes)
    }
    migratedFamilies.push(family)
  }

  const nextValues = {
    ...values,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: migratedFamilies,
    [CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY]: CUSTOM_FONT_STORAGE_SCHEMA_VERSION
  }
  await setLocalValues({
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: migratedFamilies,
    [CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY]: CUSTOM_FONT_STORAGE_SCHEMA_VERSION
  })
  return { changed: true, values: nextValues }
}
