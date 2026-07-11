import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  deriveCustomFontFamilyIdentity,
  extractCustomFontMetadataFromBytes
} from "../../src/ui/options/custom-font-metadata"

function readFixture(relativePath: string): Uint8Array {
  return fs.readFileSync(path.resolve(relativePath))
}

test("font metadata extraction reads a real static WOFF2 weight", () => {
  const metadata = extractCustomFontMetadataFromBytes(
    readFixture("assets/fonts/shabnam/Shabnam-Bold.woff2")
  )

  assert.equal(metadata.familyName, "Shabnam")
  assert.equal(metadata.sourceFamilyKey, "shabnam")
  assert.equal(metadata.subfamilyName, "Bold")
  assert.deepEqual(metadata.weight, { min: 700, max: 700 })
  assert.equal(metadata.style, "normal")
  assert.deepEqual(metadata.axes, [])
})

test("font metadata extraction reads real WOFF2 variable axes", () => {
  const metadata = extractCustomFontMetadataFromBytes(
    readFixture("assets/fonts/vazir/variable/Vazirmatn[wght].woff2")
  )

  assert.equal(metadata.familyName, "Vazirmatn")
  assert.deepEqual(metadata.weight, { min: 100, max: 900 })
  assert.deepEqual(
    metadata.axes.find((axis) => axis.tag === "wght"),
    { tag: "wght", min: 100, default: 400, max: 900 }
  )
  assert.equal(metadata.hasCombinedItalAxis, false)
})

test("font metadata extraction rejects corrupt files", () => {
  assert.throws(
    () =>
      extractCustomFontMetadataFromBytes(
        new TextEncoder().encode("wOF2not-a-real-font")
      ),
    /Unknown font format|Offset is outside|format/i
  )
})

test("legacy weight-specific family names resolve to one source family", () => {
  for (const [suffix, weight] of [
    ["Thin", 100],
    ["Light", 300],
    ["Medium", 500],
    ["ExtraBold", 800],
    ["Black", 900],
    ["ExtraBlack", 950]
  ] as const) {
    assert.deepEqual(
      deriveCustomFontFamilyIdentity({
        familyName: `Fixture Sans ${suffix}`,
        postscriptName: `FixtureSans-${suffix}`,
        style: "normal",
        weight
      }),
      {
        familyGroupName: "Fixture Sans",
        sourceFamilyKey: "fixture sans"
      }
    )
  }
})

test("family identity normalization keeps real font editions separate", () => {
  const base = deriveCustomFontFamilyIdentity({
    familyName: "Fixture Sans Black",
    postscriptName: "FixtureSans-Black",
    style: "normal",
    weight: 900
  })
  const rounded = deriveCustomFontFamilyIdentity({
    familyName: "Fixture Sans Rounded Black",
    postscriptName: "FixtureSansRounded-Black",
    style: "normal",
    weight: 900
  })

  assert.equal(base.sourceFamilyKey, "fixture sans")
  assert.equal(rounded.sourceFamilyKey, "fixture sans rounded")
})

test("family identity normalization rejects misleading suffixes", () => {
  assert.deepEqual(
    deriveCustomFontFamilyIdentity({
      familyName: "Fixture Black",
      postscriptName: "Fixture-Black",
      style: "normal",
      weight: 400
    }),
    {
      familyGroupName: "Fixture Black",
      sourceFamilyKey: "fixture black"
    }
  )
})

test("preferred OpenType family names safely group unusual legacy names", () => {
  const preferredFamilyName = "  خانواده‌ٔ عجیب ✦ ۲۰۲۶  "
  const first = deriveCustomFontFamilyIdentity({
    familyName: "Legacy Name Bold",
    postscriptName: "LegacyName-Bold",
    preferredFamilyName,
    style: "normal",
    weight: 700
  })
  const second = deriveCustomFontFamilyIdentity({
    familyName: "Completely Different Regular",
    postscriptName: "Different-Regular",
    preferredFamilyName,
    style: "normal",
    weight: 400
  })

  assert.deepEqual(first, second)
  assert.equal(first.familyGroupName, "خانواده‌ٔ عجیب ✦ ۲۰۲۶")
})

test("family keys normalize compatibility characters and whitespace", () => {
  const identity = deriveCustomFontFamilyIdentity({
    familyName: "Fallback",
    postscriptName: "Fallback",
    preferredFamilyName: "  Ｆｏｎｔ   Family  ",
    style: "normal",
    weight: 400
  })

  assert.deepEqual(identity, {
    familyGroupName: "Font Family",
    sourceFamilyKey: "font family"
  })
})

test("standard family identity keeps genuinely different editions separate", () => {
  const base = deriveCustomFontFamilyIdentity({
    familyName: "Legacy",
    postscriptName: "Legacy-Regular",
    preferredFamilyName: "My Font",
    style: "normal",
    weight: 400
  })
  const rounded = deriveCustomFontFamilyIdentity({
    familyName: "Legacy",
    postscriptName: "Legacy-Regular",
    preferredFamilyName: "My Font Rounded",
    style: "normal",
    weight: 400
  })

  assert.notEqual(base.sourceFamilyKey, rounded.sourceFamilyKey)
})
