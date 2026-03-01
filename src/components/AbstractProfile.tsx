import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

interface AbstractProfileProps {
  address?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showTooltip?: boolean
  fallback?: string
  shineColor?: string
}

const avatarCache = new Map<string, { value: string | null; ts: number }>()
const AVATAR_CACHE_TTL = 5 * 60 * 1000

const imageUrlRegex = /https?:\/\/[^"'\s]+?\.(?:png|jpe?g|webp|gif)(?:\?[^"'\s]*)?/i

function findImageUrl(data: unknown): string | null {
  if (!data) return null
  if (typeof data === 'string') {
    return imageUrlRegex.test(data) ? data : null
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findImageUrl(item)
      if (found) return found
    }
  }
  if (typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      const found = findImageUrl(value)
      if (found) return found
    }
  }
  return null
}

function extractPortalAvatar(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const user = (data as { user?: unknown }).user
  if (!user || typeof user !== 'object') return null
  const override = (user as { overrideProfilePictureUrl?: unknown }).overrideProfilePictureUrl
  return typeof override === 'string' && imageUrlRegex.test(override) ? override : null
}

export function AbstractProfile({ 
  address, 
  size = 'md', 
  className = '',
  showTooltip = true,
  fallback,
  shineColor
}: AbstractProfileProps) {
  const { address: connectedAddress } = useAccount()
  const [, setCacheVersion] = useState(0)
  const [fallbackStages, setFallbackStages] = useState<Record<string, number>>({})
  
  const sizeStyles = {
    sm: { width: '24px', height: '24px' },
    md: { width: '40px', height: '40px' },
    lg: { width: '64px', height: '64px' },
  }

  const resolvedAddress = (address ?? connectedAddress ?? '').toString()
  const normalizedAddress = resolvedAddress.trim().toLowerCase()
  const cachedEntry = normalizedAddress ? avatarCache.get(normalizedAddress) : null
  const remoteSrc = cachedEntry?.value ?? null
  const fallbackStage = normalizedAddress ? (fallbackStages[normalizedAddress] ?? 0) : 0
  const currentSrc =
    fallbackStage === 2
      ? null
      : fallbackStage === 1
        ? '/bpengu.png'
        : remoteSrc ?? '/bpengu.png'
  const fallbackText =
    fallback ??
    (resolvedAddress
      ? resolvedAddress.replace(/^0x/i, '').slice(0, 2).toUpperCase()
      : '')
  const borderColor = shineColor ?? 'rgba(30, 240, 140, 0.3)'
  const backgroundColor = shineColor ? 'transparent' : 'rgba(30, 240, 140, 0.1)'

  useEffect(() => {
    if (!normalizedAddress) {
      return
    }
    const cached = avatarCache.get(normalizedAddress)
    if (cached) {
      const isFresh = Date.now() - cached.ts < AVATAR_CACHE_TTL
      if (cached.value || isFresh) return
    }
    let isActive = true
    const controller = new AbortController()
    const endpoints = [
      `/api/portal?address=${encodeURIComponent(normalizedAddress)}`,
    ]
    const load = async () => {
      for (const url of endpoints) {
        try {
          const response = await fetch(url, { signal: controller.signal })
          if (!response.ok) continue
          const contentType = response.headers.get('content-type') ?? ''
          let found: string | null = null
          if (contentType.includes('application/json')) {
            const data = await response.json()
            found = extractPortalAvatar(data) ?? findImageUrl(data)
          } else {
            const text = await response.text()
            const match = text.match(imageUrlRegex)
            found = match ? match[0] : null
          }
          if (found) {
            avatarCache.set(normalizedAddress, { value: found, ts: Date.now() })
            if (isActive) setCacheVersion((prev) => prev + 1)
            return
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
        }
      }
      avatarCache.set(normalizedAddress, { value: null, ts: Date.now() })
    }
    load()
    return () => {
      isActive = false
      controller.abort()
    }
  }, [normalizedAddress])

  return (
    <div 
      className={`abstract-profile ${className}`} 
      style={{ 
        ...sizeStyles[size], 
        borderRadius: '50%', 
        overflow: 'hidden', 
        flexShrink: 0,
        backgroundColor,
        border: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      title={showTooltip ? resolvedAddress : undefined}
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={`Avatar for ${resolvedAddress || 'unknown'}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => {
            if (!normalizedAddress) return
            setFallbackStages((prev) => {
              const stage = prev[normalizedAddress] ?? 0
              if (stage >= 2) return prev
              if (stage === 0 && !remoteSrc) {
                return { ...prev, [normalizedAddress]: 2 }
              }
              return { ...prev, [normalizedAddress]: stage + 1 }
            })
          }}
        />
      ) : (
        <span
          style={{
            fontSize: size === 'lg' ? '18px' : size === 'sm' ? '10px' : '14px',
            fontWeight: 600,
            color: shineColor ?? '#1EF08C',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          {fallbackText || '—'}
        </span>
      )}
    </div>
  )
}
