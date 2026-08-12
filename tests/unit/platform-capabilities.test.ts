import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const { withPlatformCapabilities } = require("../../tasks/bundle-manifest") as {
  withPlatformCapabilities: (
    manifest: Record<string, unknown> & { permissions?: string[] },
    platform: string
  ) => Record<string, unknown> & { permissions: string[] }
}
const { isChromiumMV3Platform, PLATFORM, supportsFontSettings } =
  require("../../tasks/platform") as {
    isChromiumMV3Platform: (platform: string) => boolean
    PLATFORM: Record<string, string>
    supportsFontSettings: (platform: string) => boolean
  }

const chromiumPlatforms = [
  PLATFORM.CHROME_MV3,
  PLATFORM.EDGE_MV3,
  PLATFORM.BRAVE_MV3,
  PLATFORM.OPERA_MV3
]

test("only Chromium MV3 targets expose Chrome fontSettings capability", () => {
  for (const platform of chromiumPlatforms) {
    assert.equal(isChromiumMV3Platform(platform), true)
    assert.equal(supportsFontSettings(platform), true)
  }

  for (const platform of [PLATFORM.FIREFOX_MV3, PLATFORM.SAFARI_MV3]) {
    assert.equal(isChromiumMV3Platform(platform), false)
    assert.equal(supportsFontSettings(platform), false)
  }
})

test("Safari manifest drops Chrome-only permissions and version metadata", () => {
  const manifest = withPlatformCapabilities(
    {
      content_security_policy: {
        extension_pages:
          "font-src 'self' https://fonts.gstatic.com; connect-src https://fonts.googleapis.com;"
      },
      minimum_chrome_version: "106.0.0.0",
      permissions: ["fontSettings", "storage", "unlimitedStorage"]
    },
    PLATFORM.SAFARI_MV3
  )

  assert.deepEqual(manifest.permissions, ["storage", "unlimitedStorage"])
  assert.equal("minimum_chrome_version" in manifest, false)
  assert.doesNotMatch(
    (manifest.content_security_policy as { extension_pages: string })
      .extension_pages,
    /fonts\.(?:googleapis|gstatic)\.com/
  )
})

test("Chromium manifests retain Chrome-only font capability metadata", () => {
  for (const platform of chromiumPlatforms) {
    const manifest = withPlatformCapabilities(
      {
        content_security_policy: {
          extension_pages:
            "font-src 'self' https://fonts.gstatic.com; connect-src https://fonts.googleapis.com;"
        },
        minimum_chrome_version: "106.0.0.0",
        permissions: ["fontSettings", "storage", "unlimitedStorage"]
      },
      platform
    )

    assert.deepEqual(manifest.permissions, [
      "fontSettings",
      "storage",
      "unlimitedStorage"
    ])
    assert.equal(manifest.minimum_chrome_version, "106.0.0.0")
    assert.match(
      (manifest.content_security_policy as { extension_pages: string })
        .extension_pages,
      /fonts\.googleapis\.com/
    )
  }
})

test("Firefox keeps its existing manifest permission boundary", () => {
  const manifest = withPlatformCapabilities(
    {
      content_security_policy: {
        extension_pages:
          "font-src 'self' https://fonts.gstatic.com; connect-src https://fonts.googleapis.com;"
      },
      minimum_chrome_version: "106.0.0.0",
      permissions: ["fontSettings", "storage", "unlimitedStorage"]
    },
    PLATFORM.FIREFOX_MV3
  )

  assert.deepEqual(manifest.permissions, ["storage", "unlimitedStorage"])
  assert.equal("minimum_chrome_version" in manifest, false)
  assert.doesNotMatch(
    (manifest.content_security_policy as { extension_pages: string })
      .extension_pages,
    /fonts\.(?:googleapis|gstatic)\.com/
  )
})
