import assert from "node:assert/strict"
import test from "node:test"

import type { CustomFontExtractedMetadata } from "../../src/ui/options/custom-font-metadata-types"
import {
  classifyCustomFontMutationError,
  getCustomFontLibraryByteLength,
  resolveSimpleCustomFontSlot
} from "../../src/ui/options/custom-font-upload"

function createMetadata(
  update: Partial<CustomFontExtractedMetadata> = {}
): CustomFontExtractedMetadata {
  return {
    familyName: "Fixture",
    familyGroupName: "Fixture",
    sourceFamilyKey: "fixture",
    subfamilyName: "Regular",
    postscriptName: "Fixture-Regular",
    weight: { min: 400, max: 400 },
    style: "normal",
    stretch: { min: 100, max: 100 },
    axes: [],
    hasCombinedItalAxis: false,
    ...update
  }
}

test("simple static slots use explicit Regular and Bold descriptors", () => {
  assert.deepEqual(resolveSimpleCustomFontSlot(createMetadata(), "regular"), {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: 400, max: 400 }
  })
  assert.deepEqual(resolveSimpleCustomFontSlot(createMetadata(), "bold"), {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: 700, max: 700 }
  })
})

test("native-valid fonts fall back to the manually selected slot when metadata is unavailable", () => {
  assert.deepEqual(resolveSimpleCustomFontSlot(null, "regular"), {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: 400, max: 400 }
  })
  assert.deepEqual(resolveSimpleCustomFontSlot(null, "bold"), {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: 700, max: 700 }
  })
})

test("static internal names and declared weights never override the user's slots", () => {
  const unusualRegular = createMetadata({
    familyName: "نام داخلی عجیب ExtraBlack",
    sourceFamilyKey: "totally-different-family",
    weight: { min: 950, max: 950 }
  })
  const unrelatedBold = createMetadata({
    familyName: "Another Internal Family Thin",
    sourceFamilyKey: "another-internal-family",
    weight: { min: 100, max: 100 }
  })

  assert.deepEqual(resolveSimpleCustomFontSlot(unusualRegular, "regular"), {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: 400, max: 400 }
  })
  assert.deepEqual(resolveSimpleCustomFontSlot(unrelatedBold, "bold"), {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: 700, max: 700 }
  })
})

test("one variable Regular file can cover Regular and Bold", () => {
  const metadata = createMetadata({
    weight: { min: 100, max: 900 },
    axes: [{ tag: "wght", min: 100, default: 400, max: 900 }]
  })

  assert.deepEqual(resolveSimpleCustomFontSlot(metadata, "regular"), {
    ok: true,
    coversBold: true,
    isVariable: true,
    weight: { min: 100, max: 900 }
  })
})

test("variable slots must contain the weight represented by their field", () => {
  const metadata = createMetadata({
    weight: { min: 500, max: 900 },
    axes: [{ tag: "wght", min: 500, default: 500, max: 900 }]
  })

  assert.deepEqual(resolveSimpleCustomFontSlot(metadata, "regular"), {
    ok: false,
    reason: "variable-weight-missing",
    requiredWeight: 400
  })
})

test("a variable file in the Bold slot is constrained to Bold", () => {
  const metadata = createMetadata({
    weight: { min: 100, max: 900 },
    axes: [{ tag: "wght", min: 100, default: 400, max: 900 }]
  })

  assert.deepEqual(resolveSimpleCustomFontSlot(metadata, "bold"), {
    ok: true,
    coversBold: false,
    isVariable: true,
    weight: { min: 700, max: 700 }
  })
})

test("simple uploader rejects italic and combined ital-axis files", () => {
  assert.deepEqual(
    resolveSimpleCustomFontSlot(createMetadata({ style: "italic" }), "regular"),
    { ok: false, reason: "unsupported-style" }
  )
  assert.deepEqual(
    resolveSimpleCustomFontSlot(
      createMetadata({ hasCombinedItalAxis: true }),
      "regular"
    ),
    { ok: false, reason: "unsupported-style" }
  )
})

test("custom-font mutation errors are reduced to stable user-facing categories", () => {
  assert.equal(
    classifyCustomFontMutationError(
      new Error("custom-font-library-size-limit")
    ),
    "library-limit"
  )
  assert.equal(
    classifyCustomFontMutationError(
      new Error("custom-font-library-family-limit")
    ),
    "family-limit"
  )
  assert.equal(
    classifyCustomFontMutationError(new Error("custom-font-family-size-limit")),
    "family-size-limit"
  )
  assert.equal(
    classifyCustomFontMutationError(
      new Error("custom-font-transaction-expired")
    ),
    "retryable"
  )
  assert.equal(
    classifyCustomFontMutationError(new Error("QUOTA_BYTES quota exceeded")),
    "storage-unavailable"
  )
  assert.equal(
    classifyCustomFontMutationError(new Error("sync-storage-unavailable")),
    "storage-unavailable"
  )
  assert.equal(
    classifyCustomFontMutationError(
      new Error("invalid-custom-font-backup-face")
    ),
    "invalid-data"
  )
  assert.equal(
    classifyCustomFontMutationError(new Error("implementation detail")),
    "unknown"
  )
})

test("custom-font library preflight counts content-addressed files once", () => {
  const existingFace = {
    byteLength: 4,
    fileHash: "a".repeat(64)
  }
  const pendingFace = {
    byteLength: 7,
    fileHash: "b".repeat(64)
  }

  assert.equal(
    getCustomFontLibraryByteLength(
      [{ faces: [existingFace] }],
      [existingFace, pendingFace]
    ),
    11
  )
})
