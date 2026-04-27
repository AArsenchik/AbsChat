const imageUrlRegex =
  /https?:\/\/[^"'\s]+?\.(?:png|jpe?g|webp|gif|avif)(?:\?[^"'\s]*)?/i

const toPositiveInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10)
    return parsed > 0 ? parsed : null
  }
  return null
}

export const buildPortalAvatarAssetUrl = (asset: unknown) => {
  if (!asset || typeof asset !== 'object') return null
  const season = toPositiveInteger((asset as { season?: unknown }).season)
  const tier = toPositiveInteger((asset as { tier?: unknown }).tier)
  const key = toPositiveInteger((asset as { key?: unknown }).key)
  if (!season || !tier || !key) return null
  return `https://abstract-assets.abs.xyz/avatars/${season}-${tier}-${key}.png`
}

export const findImageUrl = (data: unknown): string | null => {
  if (!data) return null
  if (typeof data === 'string') {
    return imageUrlRegex.test(data) ? data : null
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findImageUrl(item)
      if (found) return found
    }
    return null
  }
  if (typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      const found = findImageUrl(value)
      if (found) return found
    }
  }
  return null
}

export const extractPortalAvatarUrl = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null
  const user = (data as { user?: unknown }).user
  if (!user || typeof user !== 'object') return null

  const override = (user as { overrideProfilePictureUrl?: unknown }).overrideProfilePictureUrl
  if (typeof override === 'string' && imageUrlRegex.test(override.trim())) {
    return override.trim()
  }

  return (
    buildPortalAvatarAssetUrl((user as { avatar?: unknown }).avatar) ??
    findImageUrl(data)
  )
}
