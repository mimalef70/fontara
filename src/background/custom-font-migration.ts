import { STORAGE_KEYS } from "../config/storage"
import {
  getLegacyCustomFontMigrationBytes,
  isLegacyCustomFontData,
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

  const migratedFamilies: unknown[] = []
  for (const candidate of rawList) {
    if (!isLegacyCustomFontData(candidate)) {
      // This migration owns only the legacy inline-data shape. Preserve newer,
      // malformed, or forward-version catalog entries byte-for-byte instead of
      // silently dropping fields/faces that this version cannot understand.
      // Runtime readers normalize a safe in-memory view independently.
      migratedFamilies.push(candidate)
      continue
    }

    const family = await normalizeLegacyCustomFontFamily(candidate)
    if (!family) {
      // A future migration may know how to recover this legacy entry. Keeping
      // it in the catalog is safer than making the user's only metadata vanish.
      migratedFamilies.push(candidate)
      continue
    }
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
