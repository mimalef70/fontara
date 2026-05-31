import assert from "node:assert/strict"
import test from "node:test"

import { POPULAR_WEBSITES } from "../../src/config/sites"
import type { WebsiteItem } from "../../src/definitions"
import { createRegexFromUrl, getMatchingWebsite } from "../../src/utils/url"

test("popular website regexes match their declared base URLs", () => {
  for (const website of POPULAR_WEBSITES) {
    assert.equal(getMatchingWebsite(`${website.url}/`, [website]), website)
  }
})

test("custom URL regex matches the same host over http and https", () => {
  const regex = createRegexFromUrl("https://example.com/path")
  const customWebsite: WebsiteItem = {
    url: "https://example.com/path",
    regex,
    isActive: true
  }

  assert.equal(
    getMatchingWebsite("https://example.com/anything", [customWebsite]),
    customWebsite
  )
  assert.equal(
    getMatchingWebsite("http://example.com/anything", [customWebsite]),
    customWebsite
  )
  assert.equal(getMatchingWebsite("https://sub.example.com/", [customWebsite]), null)
})
