import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAbstractClient, useLoginWithAbstract, useCreateSession } from '@abstract-foundation/agw-react'
import { useAccount, usePublicClient } from 'wagmi'
import { fromHex, isAddress, toHex, parseEther, type Address } from 'viem'
import { abstract } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { LimitType, type SessionConfig } from '@abstract-foundation/agw-client/sessions'
import { supabase } from './lib/supabase'
import './App.css'

type MessageStatus = 'pending' | 'sent' | 'failed'

type Message = {
  id: string
  from: string
  to: string
  text: string
  payload: string
  createdAt: string
  txHash?: string
  status: MessageStatus
}

type SupabaseMessage = {
  id: string
  from_address: string
  to_address: string
  text: string
  tx_hash: string
  created_at: string
  chain_id: number
}

const dict = {
  en: {
    brandTitle: 'Abstract Secret Chatting',
    connected: 'Connected',
    notConnected: 'Not connected',
    signOut: 'Sign out',
    signIn: 'Sign in with AGW',
    walletPrefix: 'AGW: ',
    walletConnect: 'Connect your wallet',
    conversationsTitle: 'Conversations by address',
    edit: 'Edit',
    save: 'Save',
    open: 'Open',
    hint: 'Conversations are address-based. Create a chat by entering the recipient address.',
    emptyPeers: 'No active addresses yet',
    chatTitle: 'Chat',
    chatWithPrefix: 'Chat with ',
    pickAddress: 'Pick an address to start',
    online: 'Online',
    offline: 'Offline',
    chatEmpty: 'Messages appear here after signing a transaction.',
    you: 'You',
    awaitSig: 'Awaiting signature',
    txPrefix: 'Tx ',
    sigFailed: 'Signature failed',
    composerPlaceholder: 'Your message...',
    send: 'Send',
    signing: 'Signing…',
    seen: 'Seen',
    typing: 'Typing…',
    settings: 'Settings',
    settingsTitle: 'Settings',
    language: 'Language',
    docs: 'Docs',
    openDocs: 'Open docs',
    session: 'Create session',
    sessionEnabled: 'Enabled',
    revokeSession: 'Revoke session',
  },
  zh: {
    brandTitle: '抽象密聊',
    connected: '已连接',
    notConnected: '未连接',
    signOut: '退出',
    signIn: '使用 AGW 登录',
    walletPrefix: 'AGW: ',
    walletConnect: '连接你的钱包',
    conversationsTitle: '按地址的会话',
    edit: '编辑',
    save: '保存',
    open: '打开',
    hint: '会话基于地址。输入收件人地址以创建聊天。',
    emptyPeers: '暂无会话',
    chatTitle: '聊天',
    chatWithPrefix: '聊天对象：',
    pickAddress: '选择地址开始',
    online: '在线',
    offline: '离线',
    chatEmpty: '签名交易后消息会显示在此。',
    you: '你',
    awaitSig: '等待签名',
    txPrefix: '交易 ',
    sigFailed: '签名失败',
    composerPlaceholder: '你的消息…',
    send: '发送',
    signing: '签名中…',
    seen: '已读',
    typing: '对方正在输入…',
    settings: '设置',
    settingsTitle: '设置',
    language: '语言',
    docs: '文档',
    openDocs: '打开文档',
    session: '创建会话',
    sessionEnabled: '已启用',
    revokeSession: '撤销会话',
  },
  ko: {
    brandTitle: '추상 비밀 채팅',
    connected: '연결됨',
    notConnected: '연결 안 됨',
    signOut: '로그아웃',
    signIn: 'AGW로 로그인',
    walletPrefix: 'AGW: ',
    walletConnect: '지갑을 연결하세요',
    conversationsTitle: '주소별 대화',
    edit: '편집',
    save: '저장',
    open: '열기',
    hint: '주소 기반 대화입니다. 상대 주소를 입력해 채팅을 시작하세요.',
    emptyPeers: '활성 대화 없음',
    chatTitle: '채팅',
    chatWithPrefix: '대화 상대: ',
    pickAddress: '주소를 선택하세요',
    online: '온라인',
    offline: '오프라인',
    chatEmpty: '거래 서명 후 메시지가 표시됩니다.',
    you: '나',
    awaitSig: '서명 대기',
    txPrefix: '트랜잭션 ',
    sigFailed: '서명 실패',
    composerPlaceholder: '메시지…',
    send: '보내기',
    signing: '서명 중…',
    seen: '읽음',
    typing: '입력 중…',
    settings: '설정',
    settingsTitle: '설정',
    language: '언어',
    docs: '문서',
    openDocs: '문서 열기',
    session: '세션 생성',
    sessionEnabled: '활성화됨',
    revokeSession: '세션 취소',
  },
  ja: {
    brandTitle: '抽象シークレットチャット',
    connected: '接続済み',
    notConnected: '未接続',
    signOut: 'サインアウト',
    signIn: 'AGWでサインイン',
    walletPrefix: 'AGW: ',
    walletConnect: 'ウォレットを接続',
    conversationsTitle: 'アドレス別の会話',
    edit: '編集',
    save: '保存',
    open: '開く',
    hint: '会話はアドレスに基づきます。相手のアドレスを入力してください。',
    emptyPeers: 'アクティブな会話はありません',
    chatTitle: 'チャット',
    chatWithPrefix: '相手: ',
    pickAddress: 'アドレスを選択してください',
    online: 'オンライン',
    offline: 'オフライン',
    chatEmpty: 'トランザクション署名後に表示されます。',
    you: 'あなた',
    awaitSig: '署名待ち',
    txPrefix: 'Tx ',
    sigFailed: '署名失敗',
    composerPlaceholder: 'メッセージ…',
    send: '送信',
    signing: '署名中…',
    seen: '既読',
    typing: '入力中…',
    settings: '設定',
    settingsTitle: '設定',
    language: '言語',
    docs: 'ドキュメント',
    openDocs: 'ドキュメントを開く',
    session: 'セッション作成',
    sessionEnabled: '有効',
    revokeSession: 'セッションを取り消す',
  },
}

const profileNameCache = new Map<string, { value: string | null; ts: number }>()
const PROFILE_CACHE_TTL = 5 * 60 * 1000

const shorten = (value?: string) => {
  if (!value) return '—'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const ENCRYPTED_PREFIX = 'enc:v1:'
const GIF_PREFIX = 'gif:'
const GIF_FILES = ['ppp1.mp4', 'ppp2.mp4', 'ppp3.mp4'] as const

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...Array.from(bytes)))
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

const isEncryptedPayload = (payload: string) => payload.startsWith(ENCRYPTED_PREFIX)

const getConversationSalt = async (address: string, peer: string) => {
  const [a, b] = [address.toLowerCase(), peer.toLowerCase()].sort()
  const data = encoder.encode(`${a}:${b}`)
  const digest = (await crypto.subtle.digest('SHA-256', data)) as ArrayBuffer
  return new Uint8Array(digest)
}

const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const saltBuffer = salt.buffer.slice(0) as ArrayBuffer
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const encryptPayload = async (
  text: string,
  passphrase: string,
  address: string,
  peer: string,
) => {
  if (!crypto?.subtle) {
    throw new Error('Encryption is not supported in this browser')
  }
  const salt = await getConversationSalt(address, peer)
  const key = await deriveKey(passphrase, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text),
  )
  return `${ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`
}

const decryptPayloadWithKey = async (
  payload: string,
  key: CryptoKey
) => {
  if (!isEncryptedPayload(payload)) return payload
  if (!crypto?.subtle) return null
  const raw = payload.slice(ENCRYPTED_PREFIX.length)
  const [ivBase64, dataBase64] = raw.split(':')
  if (!ivBase64 || !dataBase64) return null
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivBase64) },
      key,
      fromBase64(dataBase64),
    )
    return decoder.decode(decrypted)
  } catch {
    return null
  }
}

const getInitialText = (payload: string) =>
  isEncryptedPayload(payload) ? 'Encrypted message' : payload

const getGifSrc = (text: string) => {
  if (!text.startsWith(GIF_PREFIX)) return null
  const name = text.slice(GIF_PREFIX.length)
  return GIF_FILES.includes(name as (typeof GIF_FILES)[number]) ? `/${name}` : null
}

const toMessage = (row: SupabaseMessage): Message => ({
  id: row.tx_hash,
  from: row.from_address,
  to: row.to_address,
  text: getInitialText(row.text),
  payload: row.text,
  createdAt: row.created_at,
  status: 'sent',
  txHash: row.tx_hash,
})

const mergeMessages = (current: Message[], incoming: Message[]) => {
  if (!incoming.length) return current
  const merged = [...current, ...incoming]
  const seen = new Set<string>()
  const unique: Message[] = []
  for (const message of merged) {
    const key = message.txHash ?? message.id
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(message)
  }
  return unique.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

import { AbstractProfile } from './components/AbstractProfile'

function App() {
  const { login, logout } = useLoginWithAbstract()
  const { address, status } = useAccount()
  const { data: abstractClient } = useAbstractClient()
  const { createSessionAsync, isPending: isCreatingSession } = useCreateSession()
  const publicClient = usePublicClient({ chainId: abstract.id })

  const [peerInput, setPeerInput] = useState('')
  const [activePeer, setActivePeer] = useState('')
  const [messageText, setMessageText] = useState('')
  // Internal state for shared key, not exposed in UI anymore
  const [chatKeySaved, setChatKeySaved] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncBlock, setLastSyncBlock] = useState<string | null>(null)
  const lastScannedBlock = useRef<bigint | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [peerNicknames, setPeerNicknames] = useState<Record<string, string>>({})
  const [profileNames, setProfileNames] = useState<Record<string, string | null>>({})
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null)
  const conversationKeyRef = useRef<CryptoKey | null>(null)
  const activePeerRef = useRef<string>('')
  const [lastReadByPeer, setLastReadByPeer] = useState<Record<string, string>>({})
  const [readReceiptsByPeer, setReadReceiptsByPeer] = useState<Record<string, string>>({})
  const [typingPeers, setTypingPeers] = useState<Record<string, boolean>>({})
  const [onlinePeers, setOnlinePeers] = useState<Record<string, number>>({})
  const [onlineTick, setOnlineTick] = useState<number>(() => Date.now())
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef<number>(0)
  const signalsChannelRef = useRef<
    ReturnType<NonNullable<typeof supabase>['channel']> | null
  >(null)

  useEffect(() => {
    conversationKeyRef.current = conversationKey
  }, [conversationKey])

  useEffect(() => {
    activePeerRef.current = activePeer ? activePeer.toLowerCase() : ''
  }, [activePeer])

  const [hiddenPeers, setHiddenPeers] = useState<string[]>([])
  
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef<boolean>(true)
  const handleChatScroll = () => {
    const el = chatBodyRef.current
    if (!el) return
    const threshold = 80
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < threshold
  }

  const connected = status === 'connected' && address
  const peerInputValid = peerInput ? isAddress(peerInput) : false
  const activePeerValid = activePeer ? isAddress(activePeer) : false
  const [lang, setLang] = useState<string>(() => {
    const saved = localStorage.getItem('lang')
    return saved || 'en'
  })
  const t = dict[lang as keyof typeof dict] || dict.en
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [sessionEnabled, setSessionEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('sessionEnabled')
    return saved === 'true'
  })

  const handleCreateSession = async () => {
    if (!abstractClient || !address) return

    try {
      const sessionPrivateKey = generatePrivateKey()
      const sessionSigner = privateKeyToAccount(sessionPrivateKey)
      
      const session: SessionConfig = {
        signer: sessionSigner.address,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7), // 7 days
        feeLimit: {
          limitType: LimitType.Lifetime,
          limit: parseEther('10'), // 10 ETH lifetime gas limit (enough for many txs)
          period: BigInt(0),
        },
        // We use transfer policies to allow sending ETH (even 0 value) to any address
        // The app sends messages as self-transfers with data.
        // So we only need to whitelist the user's own address as the target.
        // This allows a global session for all chats!
        callPolicies: [],
        transferPolicies: [
          {
            target: address as Address,
            maxValuePerUse: parseEther('0'), // 0 ETH value transfer
            valueLimit: {
              limitType: LimitType.Unlimited,
              limit: BigInt(0),
              period: BigInt(0),
            }
          }
        ]
      }

      await createSessionAsync({
        session
      })

      localStorage.setItem(`session:${address.toLowerCase()}`, JSON.stringify({
        privateKey: sessionPrivateKey,
        session
      }))
      
      setSessionEnabled(true)
      alert('Session created! You can now chat without signing transactions.')
    } catch (err: unknown) {
      console.error(err)
      const msg = getErrorMessage(err)
      if (msg.includes('Status: Unset') || msg.includes('Policy violation')) {
        alert(
          'Session creation failed: Session keys on Abstract Mainnet are currently restricted to whitelisted apps. ' +
          'This feature will be available once the app is whitelisted. ' +
          'Please continue signing transactions manually for now.'
        )
      } else {
        alert(`Failed to create session: ${msg}`)
      }
      setSessionEnabled(false)
    }
  }

  const handleRevokeSession = () => {
    localStorage.removeItem(`session:${address?.toLowerCase()}`)
    setSessionEnabled(false)
    alert('Session revoked.')
  }

  const peers = useMemo(() => {
    const set = new Set<string>()
    messages.forEach((message) => {
      if (!address) return
      const peer =
        message.from.toLowerCase() === address.toLowerCase()
          ? message.to
          : message.from
      if (peer) set.add(peer.toLowerCase())
    })
    const inputLower = peerInputValid ? peerInput.toLowerCase() : ''
    if (inputLower) set.add(inputLower)
    return Array.from(set).filter((p) => {
      if (!hiddenPeers.includes(p.toLowerCase())) return true
      return inputLower !== '' && p.toLowerCase() === inputLower
    })
  }, [messages, address, peerInput, peerInputValid, hiddenPeers])

  useEffect(() => {
    const targets = new Set<string>()
    peers.forEach((peer) => targets.add(peer.toLowerCase()))
    if (activePeerValid) targets.add(activePeer.toLowerCase())
    if (targets.size === 0) return
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      const updates: Record<string, string | null> = {}
      for (const peerLower of targets) {
        const cached = profileNameCache.get(peerLower)
        if (cached) {
          const isFresh = Date.now() - cached.ts < PROFILE_CACHE_TTL
          if (cached.value || isFresh) {
            if (cached.value) {
              updates[peerLower] = cached.value
            }
            continue
          }
        }
        try {
          const response = await fetch(
            `https://backend.portal.abs.xyz/api/user/address/${peerLower}`,
            { signal: controller.signal }
          )
          if (!response.ok) {
            profileNameCache.set(peerLower, { value: null, ts: Date.now() })
            updates[peerLower] = null
            continue
          }
          const data = await response.json()
          const name =
            typeof data?.user?.name === 'string' && data.user.name.trim()
              ? data.user.name.trim()
              : null
          profileNameCache.set(peerLower, { value: name, ts: Date.now() })
          updates[peerLower] = name
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
          profileNameCache.set(peerLower, { value: null, ts: Date.now() })
          updates[peerLower] = null
        }
      }
      if (cancelled) return
      if (Object.keys(updates).length > 0) {
        setProfileNames((prev) => ({ ...prev, ...updates }))
      }
    }
    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [peers, activePeer, activePeerValid])

  const unreadPeers = useMemo(() => {
    if (!address) return {}
    const own = address.toLowerCase()
    const active = activePeer.toLowerCase()
    const next: Record<string, boolean> = {}
    for (const message of messages) {
      const from = message.from.toLowerCase()
      const to = message.to.toLowerCase()
      if (to !== own || from === own) continue
      if (from === active) continue
      const lastRead = lastReadByPeer[from] ?? '1970-01-01'
      if (message.createdAt > lastRead) {
        next[from] = true
      }
    }
    return next
  }, [address, activePeer, lastReadByPeer, messages])

  const visibleMessages = useMemo(() => {
    if (!address || !activePeerValid) return []
    const own = address.toLowerCase()
    const peer = activePeer.toLowerCase()
    return messages
      .filter((message) => {
        const from = message.from.toLowerCase()
        const to = message.to.toLowerCase()
        return (
          (from === own && to === peer) || (from === peer && to === own)
        )
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [messages, address, activePeer, activePeerValid])

  useEffect(() => {
    shouldAutoScrollRef.current = true
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
    }
  }, [activePeer])

  useEffect(() => {
    if (shouldAutoScrollRef.current && chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
    }
  }, [visibleMessages])

  useEffect(() => {
    if (!address) {
      setMessages([])
      lastScannedBlock.current = null
      setPeerNicknames({})
      setProfileNames({})
      return
    }
    const key = `abstract-messenger:${address.toLowerCase()}`
    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        setMessages([])
        lastScannedBlock.current = null
        setPeerNicknames({})
        setProfileNames({})
        setReadReceiptsByPeer({})
        return
      }
      const parsed = JSON.parse(raw) as {
        messages?: Message[]
        lastScannedBlock?: string
        nicknames?: Record<string, string>
        profileNames?: Record<string, string | null>
        hiddenPeers?: string[]
        lastReadByPeer?: Record<string, string>
        readReceiptsByPeer?: Record<string, string>
      }
      const normalized =
        parsed.messages?.map((message) =>
          message.payload ? message : { ...message, payload: message.text },
        ) ?? []
      setMessages(normalized)
      setLastSyncBlock(parsed.lastScannedBlock ?? null)
      setPeerNicknames(parsed.nicknames ?? {})
      setProfileNames(parsed.profileNames ?? {})
      setHiddenPeers(parsed.hiddenPeers ?? [])
      setLastReadByPeer(parsed.lastReadByPeer ?? {})
      setReadReceiptsByPeer(parsed.readReceiptsByPeer ?? {})
      lastScannedBlock.current = parsed.lastScannedBlock
        ? BigInt(parsed.lastScannedBlock)
        : null
    } catch {
      setMessages([])
      setLastSyncBlock(null)
      lastScannedBlock.current = null
      setPeerNicknames({})
      setProfileNames({})
      setHiddenPeers([])
      setLastReadByPeer({})
      setReadReceiptsByPeer({})
    }
  }, [address])

  useEffect(() => {
    if (!address || !activePeerValid) {
      setChatKeySaved('')
      return
    }
    // Auto-generate key using ECDH-like derivation (simplified for demo)
    // In a real app, use proper ECDH with secp256k1
    const generateSharedKey = async () => {
      const [a, b] = [address.toLowerCase(), activePeer.toLowerCase()].sort()
      const seed = `${a}:${b}:shared-secret-v1`
      const hash = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(seed),
      )
      const key = toBase64(new Uint8Array(hash))
      setChatKeySaved(key)
    }
    generateSharedKey()
  }, [address, activePeer, activePeerValid])

  // Derive and cache CryptoKey when chat key changes
  useEffect(() => {
    if (!chatKeySaved || !address || !activePeerValid) {
      setConversationKey(null)
      return
    }
    const derive = async () => {
      try {
        const salt = await getConversationSalt(address, activePeer)
        const key = await deriveKey(chatKeySaved, salt)
        setConversationKey(key)
      } catch {
        setConversationKey(null)
      }
    }
    derive()
  }, [chatKeySaved, address, activePeer, activePeerValid])

  // Auto-save key is handled in generation effect
  useEffect(() => {
    if (!address || !activePeerValid) return
  }, [address, activePeer, activePeerValid, chatKeySaved])

  useEffect(() => {
    if (!address) return
    const key = chatKeySaved.trim()
    if (!key) {
      setMessages((prev) =>
        prev.map((message) =>
          isEncryptedPayload(message.payload) && message.text !== 'Encrypted message'
            ? { ...message, text: 'Encrypted message' }
            : message,
        ),
      )
      return
    }
    
    // If we have a cached key, use it for much faster decryption
    if (conversationKey) {
      let cancelled = false
      const own = address.toLowerCase()
      const activePeerLower = activePeer.toLowerCase()

      const decryptFast = async () => {
        // Only attempt to decrypt messages that are encrypted, haven't been decrypted yet,
        // AND belong to the current active conversation
        const needed = messages
          .map((m, index) => ({ m, index }))
          .filter(({ m }) => {
            if (!isEncryptedPayload(m.payload)) return false
            if (m.text !== 'Encrypted message') return false
            const from = m.from.toLowerCase()
            const to = m.to.toLowerCase()
            return (
              (from === own && to === activePeerLower) ||
              (from === activePeerLower && to === own)
            )
          })

        if (needed.length === 0) return

        const updates = [...messages]
        let changed = false

        await Promise.all(
          needed.map(async ({ m, index }) => {
            const decrypted = await decryptPayloadWithKey(m.payload, conversationKey)
            if (decrypted && decrypted !== m.text) {
              updates[index] = { ...m, text: decrypted }
              changed = true
            }
          })
        )

        if (!cancelled && changed) {
          setMessages(updates)
        }
      }
      
      decryptFast()
      return () => { cancelled = true }
    }

    // Fallback for when conversationKey is not ready (though it should be fast)
    // Or just skip legacy decryption logic as it's too slow
  }, [address, chatKeySaved, conversationKey, messages, activePeer])

  useEffect(() => {
    if (!address) return
    const key = `abstract-messenger:${address.toLowerCase()}`
    const payload = {
      messages,
      lastScannedBlock: lastSyncBlock ?? lastScannedBlock.current?.toString(),
      nicknames: peerNicknames,
      profileNames,
      hiddenPeers,
      lastReadByPeer,
      readReceiptsByPeer,
    }
    localStorage.setItem(key, JSON.stringify(payload))
  }, [address, lastSyncBlock, messages, peerNicknames, profileNames, hiddenPeers, lastReadByPeer, readReceiptsByPeer])

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem('sessionEnabled', String(sessionEnabled))
  }, [sessionEnabled])


  const lastMessageTimestampRef = useRef<string>('1970-01-01')

  useEffect(() => {
    if (messages.length > 0) {
      lastMessageTimestampRef.current = messages[messages.length - 1].createdAt
    } else {
      lastMessageTimestampRef.current = '1970-01-01'
    }
  }, [messages])

  useEffect(() => {
    const supabaseClient = supabase
    if (!supabaseClient) return
    if (!address) return
    let cancelled = false
    const addressLower = address.toLowerCase()

    const processIncomingMessages = async (
      rows: SupabaseMessage[],
      options?: { allowUnhide?: boolean },
    ) => {
      if (!rows.length) return
      const allowUnhide = options?.allowUnhide ?? true
      
      const mapped = await Promise.all(rows.map(async (row) => {
        const m = toMessage(row)
        // Optimistic decryption if key is available and matches current peer
        const currentKey = conversationKeyRef.current
        const activePeer = activePeerRef.current
        
        if (
          currentKey && 
          activePeer && 
          isEncryptedPayload(m.payload) &&
          (m.from.toLowerCase() === activePeer || m.to.toLowerCase() === activePeer)
        ) {
           const decrypted = await decryptPayloadWithKey(m.payload, currentKey)
           if (decrypted) m.text = decrypted
        }
        return m
      }))
      
      if (cancelled) return
      setMessages((prev) => mergeMessages(prev, mapped))

      const activeLower = activePeerRef.current
      if (activeLower) {
        let newest = ''
        for (const row of rows) {
          if (
            row.from_address.toLowerCase() === activeLower &&
            row.to_address.toLowerCase() === addressLower
          ) {
            if (!newest || row.created_at > newest) {
              newest = row.created_at
            }
          }
        }
        if (newest) {
          setLastReadByPeer((prev) => {
            const current = prev[activeLower] ?? '1970-01-01'
            if (newest <= current) return prev
            return { ...prev, [activeLower]: newest }
          })
        }
      }
      
      const incoming = rows.filter(
        (m) => m.from_address.toLowerCase() !== addressLower,
      )
      if (allowUnhide && incoming.length > 0) {
        const senders = new Set(
          incoming.map((m) => m.from_address.toLowerCase()),
        )
        setHiddenPeers((prev) =>
          prev.filter((p) => !senders.has(p.toLowerCase())),
        )
      }
    }

    const loadHistory = async () => {
      try {
        const { data } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('chain_id', abstract.id)
          .or(`from_address.eq.${addressLower},to_address.eq.${addressLower}`)
          .order('created_at', { ascending: true })
          .limit(5000)

        if (!cancelled && data) {
          await processIncomingMessages(data, { allowUnhide: false })
        }
      } catch {
        return
      }
    }

    loadHistory()

    // Subscribe to messages globally for this chain
    // This ensures we catch ALL relevant events without complex filters on the channel
    const channel = supabaseClient
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chain_id=eq.${abstract.id}`,
        },
        async (payload) => {
          const row = payload.new as SupabaseMessage
          // Filter on client side to ensure we only update state for relevant messages
          if (
            row.from_address.toLowerCase() === addressLower ||
            row.to_address.toLowerCase() === addressLower
          ) {
          await processIncomingMessages([row])
          }
        },
      )
      .subscribe()

    // Polling for new messages (fallback for Realtime)
    const pollMessages = async () => {
      try {
        const lastCreated = lastMessageTimestampRef.current

        const { data } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('chain_id', abstract.id)
          .or(`from_address.eq.${addressLower},to_address.eq.${addressLower}`)
          .gt('created_at', lastCreated)
          .order('created_at', { ascending: true })
          .limit(100)

        if (!cancelled && data) {
          await processIncomingMessages(data)
        }
      } catch {
        // Ignore errors during polling
      }
    }

    const interval = setInterval(pollMessages, 3000)

    return () => {
      cancelled = true
      supabaseClient.removeChannel(channel)
      clearInterval(interval)
    }
  }, [address])

  useEffect(() => {
    if (!address || !publicClient) return
    let cancelled = false

    const pollIncoming = async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        const start =
          lastScannedBlock.current ??
          (latest > 600n ? latest - 600n : 0n)
        if (start >= latest) {
          lastScannedBlock.current = latest
          return
        }
        const discovered: Message[] = []
        const upserts: Array<{
          tx_hash: string
          from_address: string
          to_address: string
          text: string
          created_at: string
          chain_id: number
        }> = []
        for (let blockNumber = start + 1n; blockNumber <= latest; blockNumber++) {
          const block = await publicClient.getBlock({
            blockNumber,
            includeTransactions: true,
          })
          if (!block.transactions.length) continue
          const timestamp = new Date(
            Number(block.timestamp) * 1000,
          ).toISOString()
          const incoming = block.transactions.filter(
            (tx) =>
              (tx.to?.toLowerCase() === address.toLowerCase() ||
                (tx.from.toLowerCase() === tx.to?.toLowerCase() &&
                  peers.some(
                    (p) => p.toLowerCase() === tx.from.toLowerCase(),
                  ))) &&
              tx.input &&
              tx.input !== '0x',
          )
          if (!incoming.length) continue
          for (const tx of incoming) {
            let payload = ''
            try {
              payload = fromHex(tx.input as `0x${string}`, 'string')
            } catch {
              continue
            }
            const text = getInitialText(payload)
            const toAddress = tx.to ?? address
            discovered.push({
              id: tx.hash,
              from: tx.from,
              to: toAddress,
              text,
              payload,
              createdAt: timestamp,
              status: 'sent',
              txHash: tx.hash,
            })
            upserts.push({
              tx_hash: tx.hash,
              from_address: tx.from.toLowerCase(),
              to_address: toAddress.toLowerCase(),
              text: payload,
              created_at: timestamp,
              chain_id: abstract.id,
            })
          }
        }
        if (discovered.length) {
          const activeLower = activePeerRef.current
          if (activeLower) {
            let newest = ''
            for (const message of discovered) {
              if (
                message.from.toLowerCase() === activeLower &&
                message.to.toLowerCase() === address.toLowerCase()
              ) {
                if (!newest || message.createdAt > newest) {
                  newest = message.createdAt
                }
              }
            }
            if (newest) {
              setLastReadByPeer((prev) => {
                const current = prev[activeLower] ?? '1970-01-01'
                if (newest <= current) return prev
                return { ...prev, [activeLower]: newest }
              })
            }
          }
          setMessages((prev) => mergeMessages(prev, discovered))
          const incoming = discovered.filter(
            (m) => m.from.toLowerCase() !== address.toLowerCase(),
          )
          if (incoming.length > 0) {
            const senders = new Set(incoming.map((m) => m.from.toLowerCase()))
            setHiddenPeers((prev) => prev.filter((p) => !senders.has(p)))
          }
        }
        if (supabase && upserts.length) {
          await supabase.from('messages').upsert(upserts, {
            onConflict: 'tx_hash',
          })
        }
        if (!cancelled) {
          lastScannedBlock.current = latest
          setLastSyncBlock(latest.toString())
        }
      } catch {
        return
      }
    }

    const interval = setInterval(pollIncoming, 7000)
    pollIncoming()
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [address, publicClient, peers])

  useEffect(() => {
    const supabaseClient = supabase
    if (!supabaseClient || !address) return
    const addressLower = address.toLowerCase()
    const channel = supabaseClient.channel('chat:signals')
    signalsChannelRef.current = channel

    channel
      .on('broadcast', { event: 'presence' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          active?: boolean
        }
        if (!data?.from || !data?.to) return
        if (data.to.toLowerCase() !== addressLower) return
        const peerLower = data.from.toLowerCase()
        setOnlinePeers((prev) => {
          if (data.active === false) {
            if (!prev[peerLower]) return prev
            const next = { ...prev }
            delete next[peerLower]
            return next
          }
          return { ...prev, [peerLower]: Date.now() }
        })
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          typing?: boolean
        }
        if (!data?.from || !data?.to) return
        if (data.to.toLowerCase() !== addressLower) return
        const peerLower = data.from.toLowerCase()
        if (data.typing) {
          setTypingPeers((prev) => ({ ...prev, [peerLower]: true }))
          if (typingTimeoutsRef.current[peerLower]) {
            clearTimeout(typingTimeoutsRef.current[peerLower])
          }
          typingTimeoutsRef.current[peerLower] = setTimeout(() => {
            setTypingPeers((prev) => ({ ...prev, [peerLower]: false }))
          }, 5500)
        } else {
          if (typingTimeoutsRef.current[peerLower]) {
            clearTimeout(typingTimeoutsRef.current[peerLower])
          }
          setTypingPeers((prev) => ({ ...prev, [peerLower]: false }))
        }
      })
      .on('broadcast', { event: 'read' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          readAt?: string
        }
        if (!data?.from || !data?.to || !data?.readAt) return
        const readAt = data.readAt
        if (data.to.toLowerCase() !== addressLower) return
        const peerLower = data.from.toLowerCase()
        setReadReceiptsByPeer((prev) => {
          const current = prev[peerLower] ?? '1970-01-01'
          if (readAt <= current) return prev
          return { ...prev, [peerLower]: readAt }
        })
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
      signalsChannelRef.current = null
    }
  }, [address])

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineTick(Date.now())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const emitPresence = useCallback((active: boolean) => {
    if (!signalsChannelRef.current || !address || !activePeerValid) return
    signalsChannelRef.current.send({
      type: 'broadcast',
      event: 'presence',
      payload: {
        from: address.toLowerCase(),
        to: activePeer.toLowerCase(),
        active,
      },
    })
  }, [address, activePeerValid, activePeer])

  const emitTyping = (typing: boolean) => {
    if (!signalsChannelRef.current || !address || !activePeerValid) return
    const now = Date.now()
    if (typing && now - lastTypingSentRef.current < 800) return
    if (typing) lastTypingSentRef.current = now
    signalsChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        from: address.toLowerCase(),
        to: activePeer.toLowerCase(),
        typing,
      },
    })
  }

  useEffect(() => {
    if (!address || !activePeerValid) return
    emitPresence(true)
    const interval = setInterval(() => {
      emitPresence(true)
    }, 4000)
    return () => {
      clearInterval(interval)
      emitPresence(false)
    }
  }, [emitPresence, address, activePeerValid])

  useEffect(() => {
    if (!address || !activePeerValid) return
    const peerLower = activePeer.toLowerCase()
    const incoming = visibleMessages.filter(
      (message) => message.from.toLowerCase() === peerLower,
    )
    if (incoming.length === 0) return
    const latest = incoming[incoming.length - 1].createdAt
    setLastReadByPeer((prev) => {
      const current = prev[peerLower] ?? '1970-01-01'
      if (latest <= current) return prev
      return { ...prev, [peerLower]: latest }
    })
    signalsChannelRef.current?.send({
      type: 'broadcast',
      event: 'read',
      payload: {
        from: address.toLowerCase(),
        to: peerLower,
        readAt: latest,
      },
    })
  }, [address, activePeerValid, activePeer, visibleMessages])

  const handleRemovePeer = (peer: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this contact from the list? History will be preserved.',
    )
    if (!confirmed) return
    if (activePeer.toLowerCase() === peer.toLowerCase()) {
      setActivePeer('')
      setPeerInput('')
    }
    setHiddenPeers((prev) => [...prev, peer.toLowerCase()])
  }

  const handleNicknameChange = (peer: string, nickname: string) => {
    setPeerNicknames((prev) => ({
      ...prev,
      [peer.toLowerCase()]: nickname,
    }))
  }

  const handleSetPeer = () => {
    if (!peerInputValid) {
      setError('Enter a valid recipient address')
      return
    }
    const peer = peerInput.toLowerCase()
    setActivePeer(peer)
    setHiddenPeers((prev) => prev.filter((p) => p !== peer))
    setLastReadByPeer((prev) => ({ ...prev, [peer]: new Date().toISOString() }))
    setError(null)
  }

  const handleSelectPeer = (peer: string) => {
    const peerLower = peer.toLowerCase()
    setActivePeer(peerLower)
    setPeerInput(peerLower)
    setHiddenPeers((prev) => prev.filter((p) => p !== peerLower))
    setLastReadByPeer((prev) => ({
      ...prev,
      [peerLower]: new Date().toISOString(),
    }))
    setError(null)
  }

  const sendMessage = async (overrideText?: string) => {
    if (!connected || !address) {
      setError('Connect Abstract Global Wallet to send')
      return
    }
    if (!activePeerValid) {
      setError('Select a valid recipient address')
      return
    }
    const text = (overrideText ?? messageText).trim()
    if (!text) {
      if (!overrideText) {
        setError('Enter a message')
      }
      return
    }
    if (!chatKeySaved.trim()) {
      setError('Set a chat key to encrypt messages')
      return
    }
    if (!abstractClient) {
      setError('AGW client is not ready yet')
      return
    }
    // Check if there is already a pending message
    if (sending) return
    emitTyping(false)

    const key = chatKeySaved.trim()
    const addressLower = address.toLowerCase()
    const peerLower = activePeer.toLowerCase()
    let payload: string
    try {
      if (conversationKey) {
        // Use cached key for faster encryption (skips PBKDF2)
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          conversationKey,
          encoder.encode(text),
        )
        payload = `${ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`
      } else {
        payload = await encryptPayload(text, key, address, activePeer)
      }
    } catch (err) {
      setError(getErrorMessage(err))
      return
    }
    const pending: Message = {
      id: crypto.randomUUID(),
      from: address,
      to: activePeer,
      text,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    setMessages((prev) => [...prev, pending])
    if (!overrideText) {
      setMessageText('')
    }
    setSending(true)
    setError(null)

    try {
      let hash
      
      // Try to use session client if enabled and matches peer
      const sessionData = localStorage.getItem(`session:${addressLower}`)
      if (sessionEnabled && sessionData) {
        try {
          const { privateKey, session } = JSON.parse(sessionData)
          const sessionSigner = privateKeyToAccount(privateKey)
          const sessionClient = abstractClient.toSessionClient(sessionSigner, session)
          hash = await sessionClient.sendTransaction({
            account: sessionClient.account,
            to: address as Address,
            chain: abstract,
            data: toHex(payload),
            value: 0n,
          })
        } catch (e) {
          console.warn('Session failed, falling back to wallet', e)
        }
      }

      if (!hash) {
        hash = await abstractClient.sendTransaction({
          to: address as `0x${string}`,
          data: toHex(payload),
          value: 0n,
        })
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === pending.id
            ? { ...message, status: 'sent', txHash: hash }
            : message,
        ),
      )
      if (supabase) {
        await supabase.from('messages').upsert(
          [
            {
              tx_hash: hash,
              from_address: addressLower,
              to_address: peerLower,
              text: payload,
              created_at: new Date().toISOString(),
              chain_id: abstract.id,
            },
          ],
          { onConflict: 'tx_hash' },
        )
      }
    } catch (err) {
      const message = getErrorMessage(err)
      // Check if error is user rejection (4001 or "User rejected")
      const isRejection =
        message.toLowerCase().includes('rejected') ||
        message.toLowerCase().includes('denied') ||
        (typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: number }).code === 4001)

      setMessages((prev) =>
        prev.map((message) =>
          message.id === pending.id
            ? { ...message, status: 'failed' }
            : message,
        ),
      )
      if (message.toLowerCase().includes('insufficient funds')) {
        const msg = 'Insufficient funds on Abstract mainnet. Top up your AGW smart wallet balance.'
        setError(msg)
        alert(msg)
      } else if (message.toLowerCase().includes('rpc')) {
        setError('RPC request failed. Try again in a moment.')
      } else if (!isRejection) {
        // Only show error if it wasn't a user rejection
        setError(`Failed to send: ${message}`)
      }
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => sendMessage()

  const handleSendGif = (file: (typeof GIF_FILES)[number]) => {
    sendMessage(`${GIF_PREFIX}${file}`)
    setEmojiOpen(false)
  }

  const handleRemoveMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  const handleTypingChange = (value: string) => {
    setMessageText(value)
    emitTyping(true)
    if (typingSendTimeoutRef.current) {
      clearTimeout(typingSendTimeoutRef.current)
    }
    typingSendTimeoutRef.current = setTimeout(() => {
      emitTyping(false)
    }, 5500)
  }

  const activePeerLower = activePeerValid ? activePeer.toLowerCase() : ''
  const lastOnlineAt = activePeerLower ? onlinePeers[activePeerLower] : undefined
  const isPeerOnline =
    activePeerValid && lastOnlineAt ? onlineTick - lastOnlineAt < 12000 : false

  return (
    <div className="app">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="app__header">
        <div className="brand">
          <img
            src="/logo.svg"
            alt="Logo"
            className="brand__logo"
            title="Reload"
            onClick={() => window.location.reload()}
          />
          <div>
            <div className="brand__title">{t.brandTitle}</div>
            <div className="brand__subtitle">
              Anonymous chats on AbstractChain by{' '}
              <a
                href="https://x.com/arsii_eth"
                target="_blank"
                rel="noopener noreferrer"
                className="brand__link"
              >
                @arsii_eth
              </a>
            </div>
          </div>
        </div>
        <div className="wallet">
          <div className="wallet__top">
            <div className={`pill ${connected ? 'pill--on' : 'pill--off'}`}>
              {connected ? t.connected : t.notConnected}
            </div>
            <button
              className="settings-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label={t.settings}
              title={t.settings}
            >
              <span className="settings-btn__icon">⚙️</span>
            </button>
            {connected ? (
              <button className="btn btn--ghost" onClick={logout}>
                {t.signOut}
              </button>
            ) : (
              <button className="btn" onClick={login}>
                {t.signIn}
              </button>
            )}
          </div>
          <div className="wallet__address">
            {connected ? `${t.walletPrefix}${shorten(address)}` : t.walletConnect}
          </div>
        </div>
      </header>

      <main className="app__main">
        <section className="panel panel--left">
          <div className="panel__title">{t.conversationsTitle}</div>
          <div className="address">
            <input
              className="input input--address"
              placeholder="0x..."
              value={peerInput}
              onChange={(event) => setPeerInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSetPeer()
              }}
            />
            <button
              className="btn btn--open"
              onClick={handleSetPeer}
              disabled={!peerInputValid}
            >
              {t.open}
            </button>
            <button
              className="btn btn--icon"
              onClick={() => setIsEditing(!isEditing)}
              disabled={peers.length === 0}
              aria-label={isEditing ? t.save : t.edit}
              title={isEditing ? t.save : t.edit}
            >
              {isEditing ? (
                <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M7 17l3.5-.5L18 9l-3-3-7.5 7.5L7 17z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.5 6.5l3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="panel__hint">
            {t.hint}
          </div>
          <div className="peer-list">
            {peers.length === 0 ? (
              <div className="peer-list__empty">
                {t.emptyPeers}
              </div>
            ) : (
              peers.map((peer) => {
                const peerLower = peer.toLowerCase()
                return (
                  <button
                    key={peer}
                    className={`peer ${
                      activePeer.toLowerCase() === peerLower ? 'peer--active' : ''
                    } ${isEditing ? 'peer--shake' : ''}`}
                    onClick={() => !isEditing && handleSelectPeer(peer)}
                  >
                    {isEditing && (
                      <div
                        className="peer__remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemovePeer(peer)
                        }}
                      >
                        ✕
                      </div>
                    )}
                    {!isEditing && unreadPeers[peerLower] && (
                      <div className="peer__unread">!</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', overflow: 'hidden' }}>
                      <AbstractProfile address={peer} size="md" />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <span className="peer__address" style={{ width: '100%' }}>
                          {(profileNames[peerLower] ?? peerNicknames[peerLower]) || shorten(peer)}
                        </span>
                        {isEditing && !profileNames[peerLower] ? (
                          <input
                            className="peer__input"
                            placeholder="Nickname"
                            value={peerNicknames[peerLower] || ''}
                            onChange={(e) => handleNicknameChange(peer, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="peer__full" style={{ width: '100%' }}>{peer}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="panel panel--chat">
          <div className="chat__header">
            <div className="chat__left">
              {activePeerValid && (
                <div className="chat__avatar">
                  <AbstractProfile address={activePeer} size="md" />
                </div>
              )}
              <div className="chat__title">
                {activePeerValid
                  ? `${t.chatWithPrefix}${
                      (profileNames[activePeerLower] ??
                        peerNicknames[activePeerLower]) ||
                      shorten(activePeer)
                    }`
                  : t.chatTitle}
              </div>
              <div
                className={`chat__typing ${
                  activePeerValid && typingPeers[activePeerLower]
                    ? 'chat__typing--on'
                    : 'chat__typing--off'
                }`}
              >
                {t.typing}
              </div>
            </div>
            <div className="chat__right">
              <div className="chat__status">
                {isPeerOnline ? (
                  <span className="pulse">{t.online}</span>
                ) : (
                  <span className="pulse pulse--off">{t.offline}</span>
                )}
              </div>
            </div>
          </div>

          <div className="chat__body" ref={chatBodyRef} onScroll={handleChatScroll}>
            {visibleMessages.length === 0 ? (
              <div className="chat__empty">
                {t.chatEmpty}
              </div>
            ) : (
              visibleMessages.map((message) => {
                const outgoing =
                  address &&
                  message.from.toLowerCase() === address.toLowerCase()
                const peerLower = activePeer.toLowerCase()
                const readAt = readReceiptsByPeer[peerLower]
                const isRead =
                  outgoing && readAt ? message.createdAt <= readAt : false
                const gifSrc = getGifSrc(message.text)
                return (
                  <div
                    key={message.id}
                    className={`message ${
                      outgoing ? 'message--out' : 'message--in'
                    }`}
                  >
                    {message.status === 'failed' && (
                      <button
                        className="message__remove"
                        onClick={() => handleRemoveMessage(message.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                    <div className="message__meta">
                      <span className="message__sender">
                        {outgoing
                          ? t.you
                          : (profileNames[message.from.toLowerCase()] ??
                              peerNicknames[message.from.toLowerCase()]) ||
                            shorten(message.from)}
                      </span>
                      <span className="message__time">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <div className="message__text">
                      {gifSrc ? (
                        <video className="message__gif" src={gifSrc} autoPlay loop muted playsInline />
                      ) : (
                        message.text
                      )}
                    </div>
                    <div className="message__tx">
                      {message.status === 'pending' && t.awaitSig}
                      {message.status === 'sent' &&
                        (isRead
                          ? t.seen
                          : `${t.txPrefix}${shorten(message.txHash)}`)}
                      {message.status === 'failed' && t.sigFailed}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="chat__composer">
            <textarea
              className="textarea textarea--composer"
              placeholder={t.composerPlaceholder}
              value={messageText}
              onChange={(event) => handleTypingChange(event.target.value)}
              onBlur={() => emitTyping(false)}
            />
            <button
              className="emoji-btn"
              onClick={() => setEmojiOpen(true)}
              aria-label="Emoji"
              disabled={!activePeerValid}
            >
              <svg className="emoji-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="10" r="1" fill="currentColor" />
                <circle cx="15" cy="10" r="1" fill="currentColor" />
                <path d="M8.5 13.5c1.2 1.4 5.8 1.4 7 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="btn btn--composer"
              onClick={handleSend}
              disabled={
                sending || !connected || !activePeerValid || !messageText.trim()
              }
            >
              {sending ? t.signing : t.send}
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </section>
      </main>
      {settingsOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setSettingsOpen(false)} />
          <div className="modal__content">
            <div className="modal__header">
              <div className="modal__title">{t.settingsTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="settings__row">
              <div>{t.language}</div>
              <div className="settings__actions">
                <select
                  className="settings__select settings__control"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ko">한국어</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
            </div>
            <div className="settings__row">
              <div>{t.session}</div>
              <div className="settings__actions">
                {sessionEnabled ? (
                  <button
                    className="btn settings__control"
                    style={{ background: 'rgba(220, 40, 60, 0.8)' }}
                    onClick={handleRevokeSession}
                  >
                    {t.revokeSession}
                  </button>
                ) : (
                  <button
                    className="btn settings__control"
                    onClick={handleCreateSession}
                    disabled={sessionEnabled || isCreatingSession}
                  >
                    {isCreatingSession ? t.signing : t.session}
                  </button>
                )}
              </div>
            </div>
            <div className="settings__row">
              <div>{t.docs}</div>
              <div className="settings__actions">
                <a
                  className="btn btn--ghost settings__control"
                  href="/docs.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.openDocs}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {emojiOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setEmojiOpen(false)} />
          <div className="modal__content modal__content--emoji">
            <div className="modal__header">
              <div className="modal__title">GIFs</div>
              <button
                className="btn btn--ghost modal__close modal__close--ghost"
                onClick={() => setEmojiOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="emoji-modal__grid">
              <button className="emoji-modal__item" onClick={() => handleSendGif('ppp1.mp4')}>
                <video className="emoji-modal__video" src="/ppp1.mp4" autoPlay loop muted playsInline />
              </button>
              <button className="emoji-modal__item" onClick={() => handleSendGif('ppp2.mp4')}>
                <video className="emoji-modal__video" src="/ppp2.mp4" autoPlay loop muted playsInline />
              </button>
              <button className="emoji-modal__item" onClick={() => handleSendGif('ppp3.mp4')}>
                <video className="emoji-modal__video" src="/ppp3.mp4" autoPlay loop muted playsInline />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
