import type { SiteProfile } from "../definitions"
import { getMatchingSiteListPattern, normalizeSitePattern } from "./site-list"
import { normalizeTextStrokeValue } from "./text-stroke"

export const EMPTY_SITE_PROFILES: SiteProfile[] = []

export type SiteProfileMatchOptions = {
  includeDisabled?: boolean
}

function normalizeFontOverride(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeTextStrokeOverride(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined

  return normalizeTextStrokeValue(value)
}

export function hasSiteProfileOverrides(profile: SiteProfile): boolean {
  return profile.font !== undefined || profile.textStroke !== undefined
}

export function isSiteProfileEnabled(profile: SiteProfile): boolean {
  return profile.enabled !== false
}

export function normalizeSiteProfile(value: unknown): SiteProfile | null {
  if (typeof value !== "object" || value === null) return null

  const profile = value as Partial<SiteProfile>
  const pattern = normalizeSitePattern(profile.pattern)
  if (!pattern) return null

  const normalizedProfile: SiteProfile = {
    pattern
  }
  if (profile.enabled === false) {
    normalizedProfile.enabled = false
  }
  const font = normalizeFontOverride(profile.font)
  const textStroke = normalizeTextStrokeOverride(profile.textStroke)

  if (font !== undefined) {
    normalizedProfile.font = font
  }
  if (textStroke !== undefined) {
    normalizedProfile.textStroke = textStroke
  }

  return hasSiteProfileOverrides(normalizedProfile) ? normalizedProfile : null
}

export function normalizeSiteProfiles(value: unknown): SiteProfile[] {
  if (!Array.isArray(value)) return EMPTY_SITE_PROFILES

  const normalizedProfiles: SiteProfile[] = []
  const profileIndexes = new Map<string, number>()

  for (const item of value) {
    const normalizedProfile = normalizeSiteProfile(item)
    if (!normalizedProfile) continue

    const existingIndex = profileIndexes.get(normalizedProfile.pattern)
    if (existingIndex === undefined) {
      profileIndexes.set(normalizedProfile.pattern, normalizedProfiles.length)
      normalizedProfiles.push(normalizedProfile)
      continue
    }

    const mergedProfile = {
      ...normalizedProfiles[existingIndex],
      ...normalizedProfile
    }
    if (normalizedProfile.enabled !== false) {
      delete mergedProfile.enabled
    }

    normalizedProfiles[existingIndex] = mergedProfile
  }

  return normalizedProfiles
}

export function getSiteProfileForUrl(
  currentUrl: string,
  siteProfiles: SiteProfile[] | undefined,
  options: SiteProfileMatchOptions = {}
): SiteProfile | null {
  const normalizedProfiles = normalizeSiteProfiles(siteProfiles)
  const candidateProfiles = options.includeDisabled
    ? normalizedProfiles
    : normalizedProfiles.filter(isSiteProfileEnabled)
  const matchingPattern = getMatchingSiteListPattern(
    currentUrl,
    candidateProfiles.map((profile) => profile.pattern)
  )

  return (
    candidateProfiles.find((profile) => profile.pattern === matchingPattern) ??
    null
  )
}

export function upsertSiteProfile(
  siteProfiles: SiteProfile[],
  nextProfile: SiteProfile
): SiteProfile[] {
  const normalizedProfiles = normalizeSiteProfiles(siteProfiles)
  const normalizedNextProfile = normalizeSiteProfile(nextProfile)
  if (!normalizedNextProfile) return normalizedProfiles

  const existingIndex = normalizedProfiles.findIndex(
    (profile) => profile.pattern === normalizedNextProfile.pattern
  )
  if (existingIndex < 0) {
    return [...normalizedProfiles, normalizedNextProfile]
  }

  return normalizedProfiles.map((profile, index) =>
    index === existingIndex ? normalizedNextProfile : profile
  )
}

export function removeSiteProfile(
  siteProfiles: SiteProfile[],
  pattern: string
): SiteProfile[] {
  const normalizedPattern = normalizeSitePattern(pattern)
  if (!normalizedPattern) return normalizeSiteProfiles(siteProfiles)

  return normalizeSiteProfiles(siteProfiles).filter(
    (profile) => profile.pattern !== normalizedPattern
  )
}

export function removeSiteProfileFontOverrides(
  siteProfiles: SiteProfile[],
  shouldRemoveFont: (fontValue: string) => boolean
): SiteProfile[] {
  return normalizeSiteProfiles(siteProfiles)
    .map((profile) => {
      if (!profile.font || !shouldRemoveFont(profile.font)) return profile

      const { font: _removedFont, ...profileWithoutFont } = profile
      return profileWithoutFont
    })
    .filter(hasSiteProfileOverrides)
}
