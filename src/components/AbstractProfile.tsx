import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { extractPortalAvatarUrl } from '../lib/portalProfile'
import { DEFAULT_PROFILE_AVATAR } from '../lib/defaultAvatars'

interface AbstractProfileProps {
  address?: string
  size?: 'sm' | 'md' | 'chat' | 'lg' | 'xl'
  className?: string
  showTooltip?: boolean
  fallback?: string
  shineColor?: string
  src?: string | null
}

const avatarCache = new Map<string, { value: string | null; ts: number }>()
const AVATAR_CACHE_TTL = 5 * 60 * 1000

export function AbstractProfile({ 
  address, 
  size = 'md', 
  className = '',
  showTooltip = true,
  fallback,
  shineColor,
  src
}: AbstractProfileProps) {
  const { address: connectedAddress } = useAccount()
  const [, setCacheVersion] = useState(0)
  const [fallbackStages, setFallbackStages] = useState<Record<string, number>>({})
  
  const sizeStyles = {
    sm: { width: '28px', height: '28px' },
    md: { width: '48px', height: '48px' },
    chat: { width: '40px', height: '40px' },
    lg: { width: '72px', height: '72px' },
    xl: { width: '128px', height: '128px' },
  }

  const resolvedAddress = (address ?? connectedAddress ?? '').toString()
  const normalizedAddress = resolvedAddress.trim().toLowerCase()
  const cachedEntry = normalizedAddress ? avatarCache.get(normalizedAddress) : null
  const remoteSrc = src ?? cachedEntry?.value ?? null
  const fallbackStage = normalizedAddress ? (fallbackStages[normalizedAddress] ?? 0) : 0
  const currentSrc =
    fallbackStage === 2
      ? null
      : fallbackStage === 1
        ? DEFAULT_PROFILE_AVATAR
        : remoteSrc ?? DEFAULT_PROFILE_AVATAR
  const fallbackText =
    fallback ??
    (resolvedAddress
      ? resolvedAddress.replace(/^0x/i, '').slice(0, 2).toUpperCase()
      : '')
  const borderColor = shineColor ?? 'rgba(255, 255, 255, 0.12)'
  const backgroundColor = shineColor ? 'transparent' : 'rgba(255, 255, 255, 0.06)'

  useEffect(() => {
    if (!normalizedAddress || src) {
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
            found = extractPortalAvatarUrl(data)
          } else {
            found = null
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
  }, [normalizedAddress, src])

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
          loading="lazy"
          decoding="async"
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
            color: shineColor ?? 'rgba(233, 247, 239, 0.9)',
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
