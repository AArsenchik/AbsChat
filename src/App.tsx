import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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

type SupabaseProfile = {
  address: string
  display_name: string | null
  avatar_url: string | null
  e2ee_public_key?: string | null
  e2ee_backup?: string | null
  e2ee_backup_iv?: string | null
  e2ee_backup_salt?: string | null
}

const dict = {
  en: {
    brandTitle: 'AbsChat',
    connected: 'Connected',
    notConnected: 'Not connected',
    signOut: 'Sign out',
    signIn: 'Sign in with AGW',
    walletPrefix: 'AGW: ',
    walletConnect: 'Connect your wallet',
    conversationsTitle: 'Chats',
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
    chatEmptySecret: 'Secret chat is empty. Use one shared password.',
    you: 'You',
    awaitSig: 'Awaiting signature',
    txPrefix: 'Tx ',
    sigFailed: 'Signature failed',
    composerPlaceholder: 'Your message...',
    secretPassphrasePlaceholder: 'Shared password',
    secretPassphraseSave: 'Save',
    send: 'Send',
    signing: 'Signing…',
    seen: 'Seen',
    typing: 'Typing…',
    settings: 'Settings',
    settingsTitle: 'Settings',
    profile: 'Profile',
    profileTitle: 'Profile',
    profileNamePlaceholder: 'Username',
    profileCancel: 'Cancel',
    walletStatusLabel: 'Wallet',
    language: 'Language',
    docs: 'Docs',
    openDocs: 'Open docs',
    session: 'Create session',
    sessionEnabled: 'Enabled',
    revokeSession: 'Revoke session',
  },
  zh: {
    brandTitle: 'AbsChat',
    connected: '已连接',
    notConnected: '未连接',
    signOut: '退出',
    signIn: '使用 AGW 登录',
    walletPrefix: 'AGW: ',
    walletConnect: '连接你的钱包',
    conversationsTitle: 'Chats',
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
    chatEmptySecret: '密聊为空。需要同一密码。',
    you: '你',
    awaitSig: '等待签名',
    txPrefix: '交易 ',
    sigFailed: '签名失败',
    composerPlaceholder: '你的消息…',
    secretPassphrasePlaceholder: '共享密码',
    secretPassphraseSave: '保存',
    send: '发送',
    signing: '签名中…',
    seen: '已读',
    typing: '对方正在输入…',
    settings: '设置',
    settingsTitle: '设置',
    profile: '个人资料',
    profileTitle: '个人资料',
    profileNamePlaceholder: '用户名',
    profileCancel: '取消',
    walletStatusLabel: '钱包',
    language: '语言',
    docs: '文档',
    openDocs: '打开文档',
    session: '创建会话',
    sessionEnabled: '已启用',
    revokeSession: '撤销会话',
  },
  ko: {
    brandTitle: 'AbsChat',
    connected: '연결됨',
    notConnected: '연결 안 됨',
    signOut: '로그아웃',
    signIn: 'AGW로 로그인',
    walletPrefix: 'AGW: ',
    walletConnect: '지갑을 연결하세요',
    conversationsTitle: 'Chats',
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
    chatEmptySecret: '비밀 채팅이 비어 있습니다. 공통 비밀번호가 필요합니다.',
    you: '나',
    awaitSig: '서명 대기',
    txPrefix: '트랜잭션 ',
    sigFailed: '서명 실패',
    composerPlaceholder: '메시지…',
    secretPassphrasePlaceholder: '공유 비밀번호',
    secretPassphraseSave: '저장',
    send: '보내기',
    signing: '서명 중…',
    seen: '읽음',
    typing: '입력 중…',
    settings: '설정',
    settingsTitle: '설정',
    profile: '프로필',
    profileTitle: '프로필',
    profileNamePlaceholder: '사용자 이름',
    profileCancel: '취소',
    walletStatusLabel: '지갑',
    language: '언어',
    docs: '문서',
    openDocs: '문서 열기',
    session: '세션 생성',
    sessionEnabled: '활성화됨',
    revokeSession: '세션 취소',
  },
  ja: {
    brandTitle: 'AbsChat',
    connected: '接続済み',
    notConnected: '未接続',
    signOut: 'サインアウト',
    signIn: 'AGWでサインイン',
    walletPrefix: 'AGW: ',
    walletConnect: 'ウォレットを接続',
    conversationsTitle: 'Chats',
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
    chatEmptySecret: 'シークレットチャットは空です。共通パスワードが必要です。',
    you: 'あなた',
    awaitSig: '署名待ち',
    txPrefix: 'Tx ',
    sigFailed: '署名失敗',
    composerPlaceholder: 'メッセージ…',
    secretPassphrasePlaceholder: '共有パスワード',
    secretPassphraseSave: '保存',
    send: '送信',
    signing: '署名中…',
    seen: '既読',
    typing: '入力中…',
    settings: '設定',
    settingsTitle: '設定',
    profile: 'プロフィール',
    profileTitle: 'プロフィール',
    profileNamePlaceholder: 'ユーザー名',
    profileCancel: 'キャンセル',
    walletStatusLabel: 'ウォレット',
    language: '言語',
    docs: 'ドキュメント',
    openDocs: 'ドキュメントを開く',
    session: 'セッション作成',
    sessionEnabled: '有効',
    revokeSession: 'セッションを取り消す',
  },
}

type MessageListProps = {
  visibleMessages: Message[]
  address: Address | undefined
  activePeer: string
  activeSecret: boolean
  t: (typeof dict)[keyof typeof dict]
  readReceiptsByPeer: Record<string, string>
  profileNames: Record<string, string | null>
  handleRemoveMessage: (id: string) => void
}

const MessageList = memo(function MessageList({
  visibleMessages,
  address,
  activePeer,
  activeSecret,
  t,
  readReceiptsByPeer,
  profileNames,
  handleRemoveMessage,
}: MessageListProps) {
  if (visibleMessages.length === 0) {
    return (
      <div className="chat__empty">
        {activeSecret ? t.chatEmptySecret : t.chatEmpty}
      </div>
    )
  }

  return (
    <>
      {visibleMessages.map((message) => {
        const outgoing =
          address && message.from.toLowerCase() === address.toLowerCase()
        const peerLower = activePeer.toLowerCase()
        const readAt = readReceiptsByPeer[peerLower]
        const isRead = outgoing && readAt ? message.createdAt <= readAt : false
        const gifSrc = getGifSrc(message.text)
        return (
          <div
            key={message.id}
            className={`message ${outgoing ? 'message--out' : 'message--in'}`}
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
                  : profileNames[message.from.toLowerCase()] ||
                    shorten(message.from)}
              </span>
              <span className="message__time">
                {formatTime(message.createdAt)}
              </span>
            </div>
            <div className="message__text">
              {gifSrc ? (
                <video
                  className="message__gif"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src={gifSrc} type="video/mp4" />
                </video>
              ) : (
                message.text
              )}
            </div>
            <div className="message__tx">
              {message.status === 'pending' && t.awaitSig}
              {message.status === 'sent' &&
                (isRead ? t.seen : `${t.txPrefix}${shorten(message.txHash)}`)}
              {message.status === 'failed' && t.sigFailed}
            </div>
          </div>
        )
      })}
    </>
  )
})

const profileNameCache = new Map<string, { value: string | null; ts: number }>()
const PROFILE_CACHE_TTL = 5 * 60 * 1000
const SUPABASE_PROFILE_CACHE_TTL = 5 * 60 * 1000
const MESSAGE_FIELDS = 'id, tx_hash, from_address, to_address, text, created_at, chain_id'
const HISTORY_PAGE_SIZE = 200
const ACTIVE_CHAT_PAGE_SIZE = 120
const ACTIVE_CHAT_POLL_MS = 10000
const GLOBAL_POLL_MS = 45000

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
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error'
}

const isAbortError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('abort') || message.includes('aborted')
}

const isTransientError = (error: unknown) => {
  if (isAbortError(error)) return true
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('connection')
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const ENCRYPTED_PREFIX = 'enc:v1:'
const ENCRYPTED_V2_PREFIX = 'enc:v2:'
const SECRET_ENCRYPTED_PREFIX = 'sec:v1:'
const GIF_PREFIX = 'gif:'
const GIF_FILES = ['ppp1.mp4', 'ppp2.mp4', 'ppp3.mp4'] as const
const MAX_AVATAR_BYTES = 512 * 1024
const AVATAR_MAX_SIDE = 256
const AVATAR_QUALITY = 0.85

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...Array.from(bytes)))
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
const isEncryptedPayload = (payload: string) =>
  payload.startsWith(ENCRYPTED_PREFIX) ||
  payload.startsWith(ENCRYPTED_V2_PREFIX) ||
  payload.startsWith(SECRET_ENCRYPTED_PREFIX)

const parseEncryptedV1Payload = (payload: string) => {
  if (!payload.startsWith(ENCRYPTED_PREFIX)) return null
  const raw = payload.slice(ENCRYPTED_PREFIX.length)
  const [ivBase64, dataBase64] = raw.split(':')
  if (!ivBase64 || !dataBase64) return null
  return { ivBase64, dataBase64 }
}

const parseSecretPayload = (payload: string) => {
  if (!payload.startsWith(SECRET_ENCRYPTED_PREFIX)) return null
  const raw = payload.slice(SECRET_ENCRYPTED_PREFIX.length)
  const [ivBase64, dataBase64] = raw.split(':')
  if (!ivBase64 || !dataBase64) return null
  return { ivBase64, dataBase64 }
}

const getDataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.ceil((base64.length * 3) / 4)
}

type LoadedImage = {
  source: CanvasImageSource
  width: number
  height: number
  cleanup?: () => void
}

const loadImageFromFile = (file: File) =>
  new Promise<LoadedImage>(
    (resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({
          source: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          cleanup: undefined,
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Image load failed'))
      }
      img.src = url
    },
  )

const loadImageSource = async (file: File) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      return loadImageFromFile(file)
    }
  }
  return loadImageFromFile(file)
}

const compressAvatar = async (file: File) => {
  const { source, width, height, cleanup } = await loadImageSource(file)
  const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    cleanup?.()
    throw new Error('Canvas is not supported')
  }
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
  cleanup?.()
  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY)
}

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

const encryptSecretPayload = async (
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
  return `${SECRET_ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(
    new Uint8Array(encrypted),
  )}`
}

const decryptPayloadWithKey = async (
  payload: string,
  key: CryptoKey
) => {
  if (!isEncryptedPayload(payload)) return payload
  if (!crypto?.subtle) return null
  const parsed = parseEncryptedV1Payload(payload)
  if (!parsed) return null
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(parsed.ivBase64) },
      key,
      fromBase64(parsed.dataBase64),
    )
    return decoder.decode(decrypted)
  } catch {
    return null
  }
}

const decryptSecretPayloadWithKey = async (
  payload: string,
  key: CryptoKey
) => {
  if (!payload.startsWith(SECRET_ENCRYPTED_PREFIX)) return null
  if (!crypto?.subtle) return null
  const parsed = parseSecretPayload(payload)
  if (!parsed) return null
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(parsed.ivBase64) },
      key,
      fromBase64(parsed.dataBase64),
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
  const [profileNames, setProfileNames] = useState<Record<string, string | null>>({})
  const [customNames, setCustomNames] = useState<Record<string, string | null>>({})
  const [customAvatars, setCustomAvatars] = useState<Record<string, string | null>>({})
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null)
  const conversationKeyRef = useRef<CryptoKey | null>(null)
  const [activeSecret, setActiveSecret] = useState(false)
  const [secretPeers, setSecretPeers] = useState<Record<string, string>>({})
  const [secretPassphrases, setSecretPassphrases] = useState<Record<string, string>>({})
  const [secretPassphraseDraft, setSecretPassphraseDraft] = useState('')
  const activePeerRef = useRef<string>('')
  const activeSecretRef = useRef<boolean>(false)
  const [lastReadByPeer, setLastReadByPeer] = useState<Record<string, string>>({})
  const [readReceiptsByPeer, setReadReceiptsByPeer] = useState<Record<string, string>>({})
  const [typingPeers, setTypingPeers] = useState<Record<string, boolean>>({})
  const [onlinePeers, setOnlinePeers] = useState<Record<string, number>>({})
  const [onlineTick, setOnlineTick] = useState<number>(() => Date.now())
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef<number>(0)
  const pollMessagesInFlightRef = useRef(false)
  const pollActiveMessagesInFlightRef = useRef(false)
  const pollIncomingInFlightRef = useRef(false)
  const profileCacheRef = useRef<
    Record<string, { displayName: string | null; avatarUrl: string | null; ts: number }>
  >({})
  const signalsChannelRef = useRef<
    ReturnType<NonNullable<typeof supabase>['channel']> | null
  >(null)
  const deviceIdRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  )
  const hiddenPeersRef = useRef<string[]>([])
  const peerVisibilityUpdatedAtRef = useRef<Record<string, string>>({})
  const customNamesRef = useRef<Record<string, string | null>>({})
  const customAvatarsRef = useRef<Record<string, string | null>>({})
  const oldestMessageByPeerRef = useRef<Record<string, string>>({})
  const newestMessageByPeerRef = useRef<Record<string, string>>({})
  const olderMessagesLoadingRef = useRef<Record<string, boolean>>({})
  const olderMessagesExhaustedRef = useRef<Record<string, boolean>>({})
  const secretChatsChannelRef = useRef<
    ReturnType<NonNullable<typeof supabase>['channel']> | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [hiddenPeers, setHiddenPeers] = useState<string[]>([])
  const [peerVisibilityUpdatedAt, setPeerVisibilityUpdatedAt] = useState<Record<string, string>>({})

  const syncLog = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      const stamp = new Date().toISOString()
      const addr = address ? address.toLowerCase() : ''
      const deviceId = deviceIdRef.current
      console.log('[sync]', stamp, event, { address: addr, deviceId, ...data })
    },
    [address],
  )

  const loadSecretChats = useCallback(
    async (addressLower: string) => {
      if (!supabase) return
      try {
        const { data, error } = await supabase
          .from('secret_chats')
          .select('address_a, address_b, created_at, chain_id')
          .eq('chain_id', abstract.id)
          .or(`address_a.eq.${addressLower},address_b.eq.${addressLower}`)
        if (error || !data) return
        const next: Record<string, string> = {}
        data.forEach((row) => {
          const item = row as {
            address_a: string
            address_b: string
            created_at: string
          }
          const peerLower =
            item.address_a.toLowerCase() === addressLower
              ? item.address_b.toLowerCase()
              : item.address_a.toLowerCase()
          next[peerLower] = item.created_at
        })
        setSecretPeers(next)
      } catch {
        return
      }
    },
    [],
  )

  const handleCreateSecretChat = useCallback(
    async (peerLower: string) => {
      if (!supabase || !address) return
      const addressLower = address.toLowerCase()
      const [addressA, addressB] = [addressLower, peerLower].sort()
      const createdAt = new Date().toISOString()
      try {
        await supabase
          .from('secret_chats')
          .upsert(
            [
              {
                address_a: addressA,
                address_b: addressB,
                chain_id: abstract.id,
                created_at: createdAt,
                created_by: addressLower,
              },
            ],
            { onConflict: 'address_a,address_b,chain_id' },
          )
        setSecretPeers((prev) => ({ ...prev, [peerLower]: createdAt }))
        syncLog('secret_chat_create', { peer: peerLower })
      } catch (err) {
        syncLog('secret_chat_create_error', { error: getErrorMessage(err) })
      }
    },
    [address, syncLog],
  )

  const handleRemoveSecretChat = useCallback(
    async (peerLower: string) => {
      if (!supabase || !address) return
      const addressLower = address.toLowerCase()
      const [addressA, addressB] = [addressLower, peerLower].sort()
      try {
        await supabase
          .from('secret_chats')
          .delete()
          .eq('address_a', addressA)
          .eq('address_b', addressB)
          .eq('chain_id', abstract.id)
        setSecretPeers((prev) => {
          const next = { ...prev }
          delete next[peerLower]
          return next
        })
        if (activeSecret && activePeer.toLowerCase() === peerLower) {
          setActiveSecret(false)
        }
        syncLog('secret_chat_remove', { peer: peerLower })
      } catch (err) {
        syncLog('secret_chat_remove_error', { error: getErrorMessage(err) })
      }
    },
    [address, activePeer, activeSecret, syncLog],
  )

  useEffect(() => {
    conversationKeyRef.current = conversationKey
  }, [conversationKey])

  useEffect(() => {
    activePeerRef.current = activePeer ? activePeer.toLowerCase() : ''
  }, [activePeer])

  useEffect(() => {
    activeSecretRef.current = activeSecret
  }, [activeSecret])

  useEffect(() => {
    if (!supabase || !address) {
      setSecretPeers({})
      return
    }
    const supabaseClient = supabase
    const addressLower = address.toLowerCase()
    loadSecretChats(addressLower)
    const channel = supabaseClient.channel(`chat:secrets:${addressLower}`)
    const handleRow = (row: {
      address_a: string
      address_b: string
      created_at: string
    }) => {
      const peerLower =
        row.address_a.toLowerCase() === addressLower
          ? row.address_b.toLowerCase()
          : row.address_a.toLowerCase()
      setSecretPeers((prev) => ({ ...prev, [peerLower]: row.created_at }))
    }
    const handleRemove = (row: { address_a: string; address_b: string }) => {
      const peerLower =
        row.address_a.toLowerCase() === addressLower
          ? row.address_b.toLowerCase()
          : row.address_a.toLowerCase()
      setSecretPeers((prev) => {
        const next = { ...prev }
        delete next[peerLower]
        return next
      })
    }
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'secret_chats',
          filter: `chain_id=eq.${abstract.id},address_a=eq.${addressLower}`,
        },
        (payload) =>
          handleRow(
            payload.new as {
              address_a: string
              address_b: string
              created_at: string
            },
          ),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'secret_chats',
          filter: `chain_id=eq.${abstract.id},address_b=eq.${addressLower}`,
        },
        (payload) =>
          handleRow(
            payload.new as {
              address_a: string
              address_b: string
              created_at: string
            },
          ),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'secret_chats',
          filter: `chain_id=eq.${abstract.id},address_a=eq.${addressLower}`,
        },
        (payload) =>
          handleRemove(
            payload.old as {
              address_a: string
              address_b: string
            },
          ),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'secret_chats',
          filter: `chain_id=eq.${abstract.id},address_b=eq.${addressLower}`,
        },
        (payload) =>
          handleRemove(
            payload.old as {
              address_a: string
              address_b: string
            },
          ),
      )
      .subscribe()
    secretChatsChannelRef.current = channel
    return () => {
      if (secretChatsChannelRef.current) {
        supabaseClient.removeChannel(secretChatsChannelRef.current)
        secretChatsChannelRef.current = null
      }
    }
  }, [address, loadSecretChats])

  useEffect(() => {
    hiddenPeersRef.current = hiddenPeers
  }, [hiddenPeers])

  useEffect(() => {
    peerVisibilityUpdatedAtRef.current = peerVisibilityUpdatedAt
  }, [peerVisibilityUpdatedAt])

  useEffect(() => {
    customNamesRef.current = customNames
  }, [customNames])

  useEffect(() => {
    customAvatarsRef.current = customAvatars
  }, [customAvatars])

  useEffect(() => {
    const root = document.documentElement
    const updateHeight = () => {
      const viewport = window.visualViewport
      const height = viewport?.height ?? window.innerHeight
      const offsetTop = viewport?.offsetTop ?? 0
      const keyboard = Math.max(0, window.innerHeight - height - offsetTop)
      root.style.setProperty('--app-height', `${height + offsetTop}px`)
      root.style.setProperty('--app-offset-top', `${offsetTop}px`)
      root.style.setProperty('--keyboard-height', `${keyboard}px`)
    }
    const updateHeightDelayed = () => {
      updateHeight()
      setTimeout(updateHeight, 60)
      setTimeout(updateHeight, 250)
    }
    updateHeightDelayed()
    window.visualViewport?.addEventListener('resize', updateHeight)
    window.visualViewport?.addEventListener('scroll', updateHeight)
    window.addEventListener('resize', updateHeight)
    window.addEventListener('focusin', updateHeightDelayed)
    window.addEventListener('focusout', updateHeightDelayed)
    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight)
      window.visualViewport?.removeEventListener('scroll', updateHeight)
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('focusin', updateHeightDelayed)
      window.removeEventListener('focusout', updateHeightDelayed)
    }
  }, [])

  const chatBodyRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef<boolean>(true)

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

  const peerCards = useMemo(() => {
    const base = new Set(peers.map((p) => p.toLowerCase()))
    const cards: { peer: string; secret: boolean }[] = []
    base.forEach((peerLower) => {
      cards.push({ peer: peerLower, secret: false })
      if (secretPeers[peerLower]) {
        cards.push({ peer: peerLower, secret: true })
      }
    })
    Object.keys(secretPeers).forEach((peerLower) => {
      if (!base.has(peerLower)) {
        cards.push({ peer: peerLower, secret: true })
      }
    })
    return cards
  }, [peers, secretPeers])

  useEffect(() => {
    const targets = new Set<string>()
    peers.forEach((peer) => targets.add(peer.toLowerCase()))
    if (activePeerValid) targets.add(activePeer.toLowerCase())
    if (targets.size === 0) return
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      const updates: Record<string, string | null> = {}
      if (document.visibilityState === 'hidden') return
      const peersToLoad = Array.from(targets).slice(0, 24)
      for (const peerLower of peersToLoad) {
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
            `/api/portal?address=${encodeURIComponent(peerLower)}`,
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
          await wait(40)
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

  const loadProfiles = useCallback(
    async (addresses: string[]) => {
      const supabaseClient = supabase
      if (!supabaseClient || addresses.length === 0) return
      const now = Date.now()
      const cachedNameUpdates: Record<string, string | null> = {}
      const cachedAvatarUpdates: Record<string, string | null> = {}
      const toFetch: string[] = []
      addresses.forEach((address) => {
        const key = address.toLowerCase()
        const cached = profileCacheRef.current[key]
        if (cached) {
          const isFresh = now - cached.ts < SUPABASE_PROFILE_CACHE_TTL
          if (isFresh) {
            cachedNameUpdates[key] = cached.displayName ?? null
            cachedAvatarUpdates[key] = cached.avatarUrl ?? null
            return
          }
        }
        toFetch.push(key)
      })
      if (Object.keys(cachedNameUpdates).length > 0) {
        setCustomNames((prev) => ({ ...prev, ...cachedNameUpdates }))
      }
      if (Object.keys(cachedAvatarUpdates).length > 0) {
        setCustomAvatars((prev) => ({ ...prev, ...cachedAvatarUpdates }))
      }
      if (toFetch.length === 0) return
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('address, display_name, avatar_url')
        .in('address', toFetch)
      if (error) {
        console.error('Profile load error:', error)
        return
      }
      if (!data) return
      const nameUpdates: Record<string, string | null> = {}
      const avatarUpdates: Record<string, string | null> = {}
      const received = new Set<string>()
      data.forEach((row) => {
        const item = row as SupabaseProfile
        if (!item?.address) return
        const key = item.address.toLowerCase()
        received.add(key)
        nameUpdates[key] = item.display_name ?? null
        avatarUpdates[key] = item.avatar_url ?? null
        profileCacheRef.current[key] = {
          displayName: item.display_name ?? null,
          avatarUrl: item.avatar_url ?? null,
          ts: now,
        }
      })
      toFetch.forEach((key) => {
        if (received.has(key)) return
        profileCacheRef.current[key] = {
          displayName: null,
          avatarUrl: null,
          ts: now,
        }
      })
      if (Object.keys(nameUpdates).length > 0) {
        setCustomNames((prev) => ({ ...prev, ...nameUpdates }))
      }
      if (Object.keys(avatarUpdates).length > 0) {
        setCustomAvatars((prev) => ({ ...prev, ...avatarUpdates }))
      }
    },
    [setCustomNames, setCustomAvatars],
  )

  const saveProfile = useCallback(
    async (payload: {
      address: string
      display_name: string | null
      avatar_url: string | null
      updated_at: string
    }) => {
      const supabaseClient = supabase
      if (!supabaseClient) {
        throw new Error('Supabase is not configured')
      }
      const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Profile save timed out'))
          }, ms)
        })
        try {
          return await Promise.race([promise, timeout])
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
        }
      }
      const attempt = async () => {
        const request = supabaseClient
          .from('profiles')
          .upsert([payload], { onConflict: 'address' })
          .select('address, display_name, avatar_url')
        const response = await withTimeout(Promise.resolve(request), 12000)
        const { data, error } = response as {
          data: SupabaseProfile[] | null
          error: unknown
        }
        if (error) {
          throw error
        }
        const row = Array.isArray(data) ? (data[0] as SupabaseProfile) : null
        return row ?? null
      }
      try {
        return await attempt()
      } catch (err) {
        if (isTransientError(err)) {
          await wait(300)
          return await attempt()
        }
        throw err
      }
    },
    [],
  )

  useEffect(() => {
    const targets = new Set<string>()
    if (address) targets.add(address.toLowerCase())
    peers.forEach((peer) => targets.add(peer.toLowerCase()))
    if (activePeerValid) targets.add(activePeer.toLowerCase())
    const list = Array.from(targets)
    void loadProfiles(list)
  }, [peers, activePeer, activePeerValid, address, loadProfiles])

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
        const pairMatch =
          (from === own && to === peer) || (from === peer && to === own)
        if (!pairMatch) return false
        if (activeSecret) {
          return message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
        }
        return !message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [messages, address, activePeer, activePeerValid, activeSecret])

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
      oldestMessageByPeerRef.current = {}
      newestMessageByPeerRef.current = {}
      olderMessagesLoadingRef.current = {}
      olderMessagesExhaustedRef.current = {}
      setProfileNames({})
      setCustomNames({})
      setCustomAvatars({})
      return
    }
    const key = `abstract-messenger:${address.toLowerCase()}`
    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        setMessages([])
        lastScannedBlock.current = null
        oldestMessageByPeerRef.current = {}
        newestMessageByPeerRef.current = {}
        olderMessagesLoadingRef.current = {}
        olderMessagesExhaustedRef.current = {}
        setProfileNames({})
        setCustomNames({})
        setCustomAvatars({})
        setHiddenPeers([])
        setPeerVisibilityUpdatedAt({})
        setLastReadByPeer({})
        setReadReceiptsByPeer({})
        return
      }
      const parsed = JSON.parse(raw) as {
        messages?: Message[]
        lastScannedBlock?: string
        profileNames?: Record<string, string | null>
        customNames?: Record<string, string | null>
        customAvatars?: Record<string, string | null>
        hiddenPeers?: string[]
        peerVisibilityUpdatedAt?: Record<string, string>
        lastReadByPeer?: Record<string, string>
        readReceiptsByPeer?: Record<string, string>
      }
      const normalized =
        parsed.messages?.map((message) =>
          message.payload ? message : { ...message, payload: message.text },
        ) ?? []
      setMessages(normalized)
      setLastSyncBlock(parsed.lastScannedBlock ?? null)
      setProfileNames(parsed.profileNames ?? {})
      setCustomNames(parsed.customNames ?? {})
      setCustomAvatars(parsed.customAvatars ?? {})
      setHiddenPeers(parsed.hiddenPeers ?? [])
      setPeerVisibilityUpdatedAt(parsed.peerVisibilityUpdatedAt ?? {})
      setLastReadByPeer(parsed.lastReadByPeer ?? {})
      setReadReceiptsByPeer(parsed.readReceiptsByPeer ?? {})
      lastScannedBlock.current = parsed.lastScannedBlock
        ? BigInt(parsed.lastScannedBlock)
        : null
    } catch {
      setMessages([])
      setLastSyncBlock(null)
      lastScannedBlock.current = null
      setProfileNames({})
      setCustomNames({})
      setCustomAvatars({})
      setHiddenPeers([])
      setPeerVisibilityUpdatedAt({})
      setLastReadByPeer({})
      setReadReceiptsByPeer({})
    }
  }, [address])

  useEffect(() => {
    if (!address || !activePeerValid) {
      setChatKeySaved('')
      return
    }
    if (!activeSecret) {
      const generateSharedKey = async () => {
        const [a, b] = [address.toLowerCase(), activePeer.toLowerCase()].sort()
        const seed = `${a}:${b}:shared-secret-v1`
        const hash = await crypto.subtle.digest('SHA-256', encoder.encode(seed))
        const key = toBase64(new Uint8Array(hash))
        setChatKeySaved(key)
      }
      generateSharedKey()
      return
    }
    const peerLower = activePeer.toLowerCase()
    setChatKeySaved(secretPassphrases[peerLower] ?? '')
  }, [address, activePeer, activePeerValid, activeSecret, secretPassphrases])

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
    if (!address || !activePeerValid || !conversationKey) return
    let cancelled = false
    const own = address.toLowerCase()
    const activePeerLower = activePeer.toLowerCase()

    const decryptFast = async () => {
      const needed = messages
        .map((m, index) => ({ m, index }))
        .filter(({ m }) => {
          const wantsSecret = activeSecret
          const isSecretPayload = m.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
          if (wantsSecret && !isSecretPayload) return false
          if (!wantsSecret && isSecretPayload) return false
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
          const decrypted = activeSecret
            ? await decryptSecretPayloadWithKey(m.payload, conversationKey)
            : await decryptPayloadWithKey(m.payload, conversationKey)
          if (decrypted && decrypted !== m.text) {
            updates[index] = { ...m, text: decrypted }
            changed = true
          }
        }),
      )

      if (!cancelled && changed) {
        setMessages(updates)
      }
    }

    decryptFast()
    return () => {
      cancelled = true
    }
  }, [address, activePeer, activePeerValid, activeSecret, messages, conversationKey])

  useEffect(() => {
    if (!address) return
    const key = `abstract-messenger:${address.toLowerCase()}`
    const payload = {
      messages,
      lastScannedBlock: lastSyncBlock ?? lastScannedBlock.current?.toString(),
      profileNames,
      customNames,
      customAvatars,
      hiddenPeers,
      peerVisibilityUpdatedAt,
      lastReadByPeer,
      readReceiptsByPeer,
    }
    localStorage.setItem(key, JSON.stringify(payload))
  }, [
    address,
    lastSyncBlock,
    messages,
    profileNames,
    customNames,
    customAvatars,
    hiddenPeers,
    peerVisibilityUpdatedAt,
    lastReadByPeer,
    readReceiptsByPeer,
  ])

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

  const applyPeerVisibility = useCallback(
    (
      peer: string,
      hidden: boolean,
      updatedAt: string,
      options?: { force?: boolean },
    ) => {
      const peerLower = peer.toLowerCase()
      const current = peerVisibilityUpdatedAtRef.current[peerLower] ?? '1970-01-01'
      if (!options?.force && updatedAt <= current) return
      peerVisibilityUpdatedAtRef.current = {
        ...peerVisibilityUpdatedAtRef.current,
        [peerLower]: updatedAt,
      }
      setPeerVisibilityUpdatedAt((prev) => {
        const existing = prev[peerLower] ?? '1970-01-01'
        if (!options?.force && updatedAt <= existing) return prev
        return { ...prev, [peerLower]: updatedAt }
      })
      setHiddenPeers((prev) => {
        if (hidden) {
          if (prev.includes(peerLower)) return prev
          return [...prev, peerLower]
        }
        if (!prev.includes(peerLower)) return prev
        return prev.filter((p) => p !== peerLower)
      })
      if (hidden && activePeerRef.current === peerLower) {
        setActivePeer('')
        setPeerInput('')
      }
    },
    [],
  )

  const ingestMessages = useCallback(
    async (rows: SupabaseMessage[], source?: string) => {
      if (!rows.length || !address) return
      const addressLower = address.toLowerCase()
      for (const row of rows) {
        const from = row.from_address.toLowerCase()
        const to = row.to_address.toLowerCase()
        const peerLower = from === addressLower ? to : from
        const createdAt = row.created_at
        const currentOldest = oldestMessageByPeerRef.current[peerLower]
        const currentNewest = newestMessageByPeerRef.current[peerLower]
        if (!currentOldest || createdAt < currentOldest) {
          oldestMessageByPeerRef.current = {
            ...oldestMessageByPeerRef.current,
            [peerLower]: createdAt,
          }
        }
        if (!currentNewest || createdAt > currentNewest) {
          newestMessageByPeerRef.current = {
            ...newestMessageByPeerRef.current,
            [peerLower]: createdAt,
          }
        }
      }

      let oldest = rows[0]?.created_at
      let newest = rows[0]?.created_at
      for (const row of rows) {
        if (!oldest || row.created_at < oldest) oldest = row.created_at
        if (!newest || row.created_at > newest) newest = row.created_at
      }
      syncLog('messages_ingest', {
        source,
        count: rows.length,
        oldest,
        newest,
      })

      const mapped = await Promise.all(
        rows.map(async (row) => {
          const m = toMessage(row)
          if (m.payload.startsWith(SECRET_ENCRYPTED_PREFIX)) {
            const peerLower =
              m.from.toLowerCase() === addressLower
                ? m.to.toLowerCase()
                : m.from.toLowerCase()
            setSecretPeers((prev) =>
              prev[peerLower] ? prev : { ...prev, [peerLower]: m.createdAt },
            )
            if (supabase) {
              const [addressA, addressB] = [addressLower, peerLower].sort()
              void supabase
                .from('secret_chats')
                .upsert(
                  [
                    {
                      address_a: addressA,
                      address_b: addressB,
                      chain_id: abstract.id,
                      created_at: m.createdAt,
                      created_by: addressLower,
                    },
                  ],
                  { onConflict: 'address_a,address_b,chain_id' },
                )
            }
          }
          const currentKey = conversationKeyRef.current
          const activePeer = activePeerRef.current
          if (
            activePeer &&
            m.text === 'Encrypted message' &&
            (m.from.toLowerCase() === activePeer ||
              m.to.toLowerCase() === activePeer)
          ) {
            if (currentKey) {
              if (
                activeSecretRef.current &&
                m.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
              ) {
                const decrypted = await decryptSecretPayloadWithKey(
                  m.payload,
                  currentKey,
                )
                if (decrypted) m.text = decrypted
              }
              if (
                !activeSecretRef.current &&
                m.payload.startsWith(ENCRYPTED_PREFIX)
              ) {
                const decrypted = await decryptPayloadWithKey(m.payload, currentKey)
                if (decrypted) m.text = decrypted
              }
            }
          }
          return m
        }),
      )

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

      const newestBySender: Record<string, string> = {}
      for (const row of rows) {
        const sender = row.from_address.toLowerCase()
        if (sender === addressLower) continue
        const current = newestBySender[sender]
        if (!current || row.created_at > current) {
          newestBySender[sender] = row.created_at
        }
      }
      Object.entries(newestBySender).forEach(([sender, createdAt]) => {
        applyPeerVisibility(sender, false, createdAt)
      })
    },
    [address, applyPeerVisibility, syncLog],
  )

  const loadOlderMessages = useCallback(async () => {
    if (!supabase || !address || !activePeerValid) return
    const peerLower = activePeer.toLowerCase()
    if (olderMessagesLoadingRef.current[peerLower]) return
    if (olderMessagesExhaustedRef.current[peerLower]) return
    const oldest = oldestMessageByPeerRef.current[peerLower]
    if (!oldest) return
    olderMessagesLoadingRef.current = {
      ...olderMessagesLoadingRef.current,
      [peerLower]: true,
    }
    const addressLower = address.toLowerCase()
    const el = chatBodyRef.current
    const prevHeight = el?.scrollHeight ?? 0
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_FIELDS)
        .eq('chain_id', abstract.id)
        .or(
          `and(from_address.eq.${addressLower},to_address.eq.${peerLower}),and(from_address.eq.${peerLower},to_address.eq.${addressLower})`,
        )
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(ACTIVE_CHAT_PAGE_SIZE)
      if (error || !data || data.length === 0) {
        olderMessagesExhaustedRef.current = {
          ...olderMessagesExhaustedRef.current,
          [peerLower]: true,
        }
        return
      }
      await ingestMessages(data as SupabaseMessage[], 'history_page')
      if (data.length < ACTIVE_CHAT_PAGE_SIZE) {
        olderMessagesExhaustedRef.current = {
          ...olderMessagesExhaustedRef.current,
          [peerLower]: true,
        }
      }
      await wait(0)
      if (el) {
        const nextHeight = el.scrollHeight
        el.scrollTop += Math.max(0, nextHeight - prevHeight)
      }
    } finally {
      olderMessagesLoadingRef.current = {
        ...olderMessagesLoadingRef.current,
        [peerLower]: false,
      }
    }
  }, [address, activePeer, activePeerValid, ingestMessages])

  const handleChatScroll = () => {
    const el = chatBodyRef.current
    if (!el) return
    if (el.scrollTop <= 120) {
      void loadOlderMessages()
    }
    const threshold = 80
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < threshold
  }

  const fetchMessageUpdates = useCallback(
    async (options: { since?: string; txHash?: string }) => {
      if (!supabase || !address) return
      syncLog('message_fetch', {
        since: options.since,
        txHash: options.txHash,
      })
      const addressLower = address.toLowerCase()
      let query = supabase
        .from('messages')
        .select(MESSAGE_FIELDS)
        .eq('chain_id', abstract.id)
        .or(`from_address.eq.${addressLower},to_address.eq.${addressLower}`)
        .order('created_at', { ascending: true })
        .limit(120)
      if (options.txHash) {
        query = query.eq('tx_hash', options.txHash)
      } else if (options.since) {
        query = query.gt('created_at', options.since)
      }
      const { data } = await query
      if (data && data.length) {
        await ingestMessages(data as SupabaseMessage[], 'message_fetch')
      }
    },
    [address, ingestMessages, syncLog],
  )

  useEffect(() => {
    const supabaseClient = supabase
    if (!supabaseClient) return
    if (!address) return
    let cancelled = false
    const addressLower = address.toLowerCase()

    const loadHistory = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('messages')
          .select(MESSAGE_FIELDS)
          .eq('chain_id', abstract.id)
          .or(`from_address.eq.${addressLower},to_address.eq.${addressLower}`)
          .order('created_at', { ascending: false })
          .limit(HISTORY_PAGE_SIZE)
        if (error || !data) return
        await ingestMessages(data as SupabaseMessage[], 'history')
        syncLog('history_loaded', { count: data.length })
      } catch (err) {
        syncLog('history_error', { error: getErrorMessage(err) })
      }
    }

    // Polling for new messages (fallback for Realtime)
    const pollMessages = async () => {
      if (pollMessagesInFlightRef.current) return
      if (document.visibilityState === 'hidden') return
      pollMessagesInFlightRef.current = true
      try {
        const lastCreated = lastMessageTimestampRef.current

        const { data } = await supabaseClient
          .from('messages')
          .select(MESSAGE_FIELDS)
          .eq('chain_id', abstract.id)
          .or(`from_address.eq.${addressLower},to_address.eq.${addressLower}`)
          .gt('created_at', lastCreated)
          .order('created_at', { ascending: true })
          .limit(80)

        if (!cancelled && data) {
          await ingestMessages(data, 'poll')
        }
      } catch (err) {
        syncLog('poll_error', { error: getErrorMessage(err) })
      } finally {
        pollMessagesInFlightRef.current = false
      }
    }

    loadHistory()
    pollMessages()
    const interval = setInterval(pollMessages, GLOBAL_POLL_MS)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollMessages()
      }
    }
    window.addEventListener('focus', pollMessages)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      pollMessagesInFlightRef.current = false
      clearInterval(interval)
      window.removeEventListener('focus', pollMessages)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [address, ingestMessages, syncLog])

  useEffect(() => {
    const supabaseClient = supabase
    if (!supabaseClient || !address || !activePeerValid) return
    let cancelled = false
    const addressLower = address.toLowerCase()
    const peerLower = activePeer.toLowerCase()

    const ensureChatBootstrap = async () => {
      if (newestMessageByPeerRef.current[peerLower]) return
      try {
        const { data, error } = await supabaseClient
          .from('messages')
          .select(MESSAGE_FIELDS)
          .eq('chain_id', abstract.id)
          .or(
            `and(from_address.eq.${addressLower},to_address.eq.${peerLower}),and(from_address.eq.${peerLower},to_address.eq.${addressLower})`,
          )
          .order('created_at', { ascending: false })
          .limit(ACTIVE_CHAT_PAGE_SIZE)
        if (error || !data || cancelled) return
        await ingestMessages(data as SupabaseMessage[], 'chat_bootstrap')
      } catch (err) {
        syncLog('chat_bootstrap_error', { error: getErrorMessage(err) })
      }
    }

    const pollActiveMessages = async () => {
      if (pollActiveMessagesInFlightRef.current) return
      if (document.visibilityState === 'hidden') return
      pollActiveMessagesInFlightRef.current = true
      try {
        const since = newestMessageByPeerRef.current[peerLower]
        let query = supabaseClient
          .from('messages')
          .select(MESSAGE_FIELDS)
          .eq('chain_id', abstract.id)
          .or(
            `and(from_address.eq.${addressLower},to_address.eq.${peerLower}),and(from_address.eq.${peerLower},to_address.eq.${addressLower})`,
          )
          .order('created_at', { ascending: true })
          .limit(80)
        if (since) {
          query = query.gt('created_at', since)
        }
        const { data } = await query
        if (!cancelled && data && data.length) {
          await ingestMessages(data as SupabaseMessage[], 'chat_poll')
        }
      } catch (err) {
        syncLog('chat_poll_error', { error: getErrorMessage(err) })
      } finally {
        pollActiveMessagesInFlightRef.current = false
      }
    }

    const channel = supabaseClient
      .channel(`chat:messages:${addressLower}:${peerLower}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chain_id=eq.${abstract.id},from_address=eq.${addressLower},to_address=eq.${peerLower}`,
        },
        async (payload) => {
          const row = payload.new as SupabaseMessage
          await ingestMessages([row], 'realtime_active')
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chain_id=eq.${abstract.id},from_address=eq.${peerLower},to_address=eq.${addressLower}`,
        },
        async (payload) => {
          const row = payload.new as SupabaseMessage
          await ingestMessages([row], 'realtime_active')
        },
      )
      .subscribe((status, err) => {
        syncLog('chat_realtime_status', {
          status,
          error: err ? getErrorMessage(err) : undefined,
        })
        if (status === 'SUBSCRIBED') {
          pollActiveMessages()
        }
      })

    ensureChatBootstrap()
    pollActiveMessages()
    const interval = setInterval(pollActiveMessages, ACTIVE_CHAT_POLL_MS)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollActiveMessages()
      }
    }
    window.addEventListener('focus', pollActiveMessages)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      pollActiveMessagesInFlightRef.current = false
      supabaseClient.removeChannel(channel)
      clearInterval(interval)
      window.removeEventListener('focus', pollActiveMessages)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [address, activePeer, activePeerValid, ingestMessages, syncLog])

  useEffect(() => {
    if (!address || !publicClient) return
    let cancelled = false
    const ownLower = address.toLowerCase()
    const peerSet = new Set(peers.map((peer) => peer.toLowerCase()))
    const MAX_BLOCKS_PER_POLL = 35n

    const pollIncoming = async () => {
      if (pollIncomingInFlightRef.current) return
      if (document.visibilityState === 'hidden') return
      pollIncomingInFlightRef.current = true
      try {
        const latest = await publicClient.getBlockNumber()
        const start =
          lastScannedBlock.current ??
          (latest > 180n ? latest - 180n : 0n)
        if (start >= latest) {
          lastScannedBlock.current = latest
          return
        }
        const endBlock = start + MAX_BLOCKS_PER_POLL < latest ? start + MAX_BLOCKS_PER_POLL : latest
        const discovered: Message[] = []
        const upserts: Array<{
          tx_hash: string
          from_address: string
          to_address: string
          text: string
          created_at: string
          chain_id: number
        }> = []
        for (let blockNumber = start + 1n; blockNumber <= endBlock; blockNumber++) {
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
              (tx.to?.toLowerCase() === ownLower ||
                (tx.from.toLowerCase() === tx.to?.toLowerCase() &&
                  peerSet.has(tx.from.toLowerCase()))) &&
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
          let oldest = discovered[0]?.createdAt
          let newest = discovered[0]?.createdAt
          for (const message of discovered) {
            if (!oldest || message.createdAt < oldest) oldest = message.createdAt
            if (!newest || message.createdAt > newest) newest = message.createdAt
          }
          syncLog('chain_discovered', {
            count: discovered.length,
            oldest,
            newest,
          })
          const activeLower = activePeerRef.current
          if (activeLower) {
            let newest = ''
            for (const message of discovered) {
              if (
                message.from.toLowerCase() === activeLower &&
                message.to.toLowerCase() === ownLower
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
        }
        if (supabase && upserts.length) {
          await supabase.from('messages').upsert(upserts, {
            onConflict: 'tx_hash',
          })
          syncLog('chain_upsert', { count: upserts.length })
        }
        if (!cancelled) {
          lastScannedBlock.current = endBlock
          setLastSyncBlock(endBlock.toString())
        }
      } catch (err) {
        syncLog('chain_error', { error: getErrorMessage(err) })
        return
      } finally {
        pollIncomingInFlightRef.current = false
      }
    }

    const chainIntervalMs = activePeerValid ? 1000 : 3000
    const interval = setInterval(pollIncoming, chainIntervalMs)
    pollIncoming()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollIncoming()
      }
    }
    window.addEventListener('focus', pollIncoming)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      pollIncomingInFlightRef.current = false
      clearInterval(interval)
      window.removeEventListener('focus', pollIncoming)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [address, publicClient, peers, activePeerValid, syncLog])

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
      .on('broadcast', { event: 'profile' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          displayName?: string | null
          avatarUrl?: string | null
        }
        if (!data?.from || !data?.to) return
        if (data.to.toLowerCase() !== addressLower) return
        const key = data.from.toLowerCase()
        if (data.displayName !== undefined) {
          setCustomNames((prev) => ({
            ...prev,
            [key]: data.displayName ?? null,
          }))
        }
        if (data.avatarUrl !== undefined) {
          setCustomAvatars((prev) => ({
            ...prev,
            [key]: data.avatarUrl ?? null,
          }))
        }
      })
      .on('broadcast', { event: 'peer_visibility' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          peer?: string
          hidden?: boolean
          updatedAt?: string
        }
        if (!data?.from || !data?.to || !data.peer) return
        if (data.to.toLowerCase() !== addressLower) return
        applyPeerVisibility(
          data.peer,
          Boolean(data.hidden),
          data.updatedAt ?? new Date().toISOString(),
          { force: true },
        )
      })
      .on('broadcast', { event: 'message_hint' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          deviceId?: string
          txHash?: string
          since?: string
        }
        if (!data?.from || !data?.to) return
        if (data.to.toLowerCase() !== addressLower) return
        if (data.deviceId === deviceIdRef.current) return
        syncLog('message_hint_receive', {
          from: data.from?.toLowerCase(),
          txHash: data.txHash,
          since: data.since,
          deviceId: data.deviceId,
        })
        const since = data.since ?? lastMessageTimestampRef.current
        void fetchMessageUpdates({ since, txHash: data.txHash })
      })
      .on('broadcast', { event: 'sync_request' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          deviceId?: string
        }
        if (!data?.from || !data?.to || !data.deviceId) return
        if (data.to.toLowerCase() !== addressLower) return
        if (data.deviceId === deviceIdRef.current) return
        if (document.visibilityState === 'hidden') return
        channel.send({
          type: 'broadcast',
          event: 'sync_state',
          payload: {
            from: addressLower,
            to: addressLower,
            deviceId: data.deviceId,
            hiddenPeers: hiddenPeersRef.current,
            peerVisibilityUpdatedAt: peerVisibilityUpdatedAtRef.current,
            customNames: customNamesRef.current,
            customAvatars: customAvatarsRef.current,
          },
        })
      })
      .on('broadcast', { event: 'sync_state' }, (payload) => {
        const data = payload.payload as {
          from?: string
          to?: string
          deviceId?: string
          hiddenPeers?: string[]
          peerVisibilityUpdatedAt?: Record<string, string>
          customNames?: Record<string, string | null>
          customAvatars?: Record<string, string | null>
        }
        if (!data?.from || !data?.to || !data.deviceId) return
        if (data.to.toLowerCase() !== addressLower) return
        if (data.deviceId !== deviceIdRef.current) return
        const incomingHidden = new Set(
          Array.isArray(data.hiddenPeers)
            ? data.hiddenPeers.map((peer) => peer.toLowerCase())
            : [],
        )
        const incomingUpdatedAt =
          data.peerVisibilityUpdatedAt && typeof data.peerVisibilityUpdatedAt === 'object'
            ? data.peerVisibilityUpdatedAt
            : {}
        const visibilityPeers = new Set([
          ...Object.keys(incomingUpdatedAt),
          ...incomingHidden,
        ])
        visibilityPeers.forEach((peer) => {
          const updatedAt = incomingUpdatedAt[peer] ?? '1970-01-01'
          applyPeerVisibility(peer, incomingHidden.has(peer), updatedAt, {
            force: true,
          })
        })
        if (data.customNames && typeof data.customNames === 'object') {
          setCustomNames((prev) => ({ ...prev, ...data.customNames }))
        }
        if (data.customAvatars && typeof data.customAvatars === 'object') {
          setCustomAvatars((prev) => ({ ...prev, ...data.customAvatars }))
        }
      })
      .subscribe((status) => {
        syncLog('signals_status', { status })
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'sync_request',
            payload: {
              from: addressLower,
              to: addressLower,
              deviceId: deviceIdRef.current,
            },
          })
        }
      })

    return () => {
      channel.unsubscribe()
      signalsChannelRef.current = null
    }
  }, [address, applyPeerVisibility, fetchMessageUpdates, syncLog])

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
    if (typing && now - lastTypingSentRef.current < 1500) return
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

  const emitProfileSync = useCallback(
    (displayName: string | null, avatarUrl: string | null) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'profile',
        payload: {
          from: addressLower,
          to: addressLower,
          displayName,
          avatarUrl,
        },
      })
    },
    [address],
  )

  const emitPeerVisibility = useCallback(
    (peer: string, hidden: boolean, updatedAt: string) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'peer_visibility',
        payload: {
          from: addressLower,
          to: addressLower,
          peer,
          hidden,
          updatedAt,
        },
      })
    },
    [address],
  )

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
    const peerLower = peer.toLowerCase()
    const updatedAt = new Date().toISOString()
    if (activePeer.toLowerCase() === peerLower) {
      setActivePeer('')
      setPeerInput('')
    }
    applyPeerVisibility(peerLower, true, updatedAt)
    emitPeerVisibility(peerLower, true, updatedAt)
  }

  const handleSetPeer = () => {
    if (!peerInputValid) {
      setError('Enter a valid recipient address')
      return
    }
    const peer = peerInput.toLowerCase()
    const updatedAt = new Date().toISOString()
    setActivePeer(peer)
    setActiveSecret(false)
    setSecretPassphraseDraft('')
    applyPeerVisibility(peer, false, updatedAt)
    setLastReadByPeer((prev) => ({ ...prev, [peer]: new Date().toISOString() }))
    setError(null)
    emitPeerVisibility(peer, false, updatedAt)
  }

  const handleSelectPeer = (peer: string, secret?: boolean) => {
    const peerLower = peer.toLowerCase()
    const updatedAt = new Date().toISOString()
    setActivePeer(peerLower)
    setPeerInput(peerLower)
    setActiveSecret(Boolean(secret))
    setSecretPassphraseDraft(
      secret ? secretPassphrases[peerLower] ?? '' : '',
    )
    applyPeerVisibility(peerLower, false, updatedAt)
    setLastReadByPeer((prev) => ({
      ...prev,
      [peerLower]: new Date().toISOString(),
    }))
    setError(null)
    emitPeerVisibility(peerLower, false, updatedAt)
  }

  const handleSaveSecretPassphrase = () => {
    if (!activePeerValid) return
    const peerLower = activePeer.toLowerCase()
    const next = secretPassphraseDraft.trim()
    setSecretPassphrases((prev) => {
      if (!next) {
        const updated = { ...prev }
        delete updated[peerLower]
        return updated
      }
      return { ...prev, [peerLower]: next }
    })
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
    let payload: string | null = null
    try {
      if (activeSecret) {
        if (!key) {
          setError('Set a shared password for this secret chat')
          return
        }
        if (conversationKey) {
          const iv = crypto.getRandomValues(new Uint8Array(12))
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            conversationKey,
            encoder.encode(text),
          )
          payload = `${SECRET_ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(
            new Uint8Array(encrypted),
          )}`
        } else {
          payload = await encryptSecretPayload(text, key, address, activePeer)
        }
      } else {
        if (conversationKey) {
          const iv = crypto.getRandomValues(new Uint8Array(12))
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            conversationKey,
            encoder.encode(text),
          )
          payload = `${ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(
            new Uint8Array(encrypted),
          )}`
        } else if (key) {
          payload = await encryptPayload(text, key, address, activePeer)
        } else {
          payload = text
        }
      }
    } catch (err) {
      setError(getErrorMessage(err))
      return
    }
    const createdAt = new Date().toISOString()
    const pending: Message = {
      id: crypto.randomUUID(),
      from: address,
      to: activePeer,
      text,
      payload,
      createdAt,
      status: 'pending',
    }
    syncLog('send_start', { to: peerLower, createdAt })
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
          const sessionError = getErrorMessage(e)
          if (
            sessionError.toLowerCase().includes('failed to initialize request') ||
            sessionError.toLowerCase().includes('session')
          ) {
            localStorage.removeItem(`session:${addressLower}`)
            setSessionEnabled(false)
          }
          console.warn('Session failed, falling back to wallet', e)
        }
      }

      if (!hash) {
        const sendWithWallet = async () =>
          abstractClient.sendTransaction({
            to: address as `0x${string}`,
            data: toHex(payload),
            value: 0n,
          })
        try {
          hash = await sendWithWallet()
        } catch (e) {
          const walletError = getErrorMessage(e)
          if (walletError.toLowerCase().includes('failed to initialize request')) {
            await wait(400)
            hash = await sendWithWallet()
          } else {
            throw e
          }
        }
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
              created_at: createdAt,
              chain_id: abstract.id,
            },
          ],
          { onConflict: 'tx_hash' },
        )
        syncLog('send_upsert', { txHash: hash, createdAt })
      }
      signalsChannelRef.current?.send({
        type: 'broadcast',
        event: 'message_hint',
        payload: {
          from: addressLower,
          to: addressLower,
          deviceId: deviceIdRef.current,
          txHash: hash,
          since: createdAt,
        },
      })
      syncLog('send_hint', { txHash: hash, createdAt })
    } catch (err) {
      const message = getErrorMessage(err)
      syncLog('send_error', { error: message })
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

  const handleRemoveMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

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

  const displayNames = useMemo(
    () => ({ ...profileNames, ...customNames }),
    [profileNames, customNames],
  )
  const addressLower = address ? address.toLowerCase() : ''
  const profileLabel =
    addressLower && displayNames[addressLower]
      ? displayNames[addressLower]
      : address ?? '—'

  const handleOpenProfile = () => {
    setProfileOpen(true)
    setProfileEditing(false)
    setProfileError(null)
    if (addressLower) {
      setProfileNameDraft(displayNames[addressLower] ?? '')
    } else {
      setProfileNameDraft('')
    }
  }

  const handleProfileCancel = () => {
    setProfileEditing(false)
    if (addressLower) {
      setProfileNameDraft(displayNames[addressLower] ?? '')
    } else {
      setProfileNameDraft('')
    }
  }

  const handleProfileSave = async () => {
    if (!addressLower) return
    setProfileError(null)
    setProfileSaving(true)
    const nextName = profileNameDraft.trim()
    const previousName = customNames[addressLower] ?? null
    setCustomNames((prev) => ({ ...prev, [addressLower]: nextName || null }))
    try {
      const row = await saveProfile({
        address: addressLower,
        display_name: nextName || null,
        avatar_url: customAvatars[addressLower] ?? null,
        updated_at: new Date().toISOString(),
      })
      if (row) {
        setCustomNames((prev) => ({
          ...prev,
          [addressLower]: row.display_name ?? null,
        }))
        setCustomAvatars((prev) => ({
          ...prev,
          [addressLower]: row.avatar_url ?? null,
        }))
      } else {
        setCustomNames((prev) => ({ ...prev, [addressLower]: nextName || null }))
        await loadProfiles([addressLower])
      }
      emitProfileSync(
        row?.display_name ?? (nextName || null),
        row ? row.avatar_url ?? null : customAvatars[addressLower] ?? null,
      )
      setProfileNameDraft(nextName)
      setProfileEditing(false)
    } catch (err) {
      console.error('Profile save error:', err)
      if (!isAbortError(err)) {
        setProfileError(getErrorMessage(err))
        setCustomNames((prev) => ({ ...prev, [addressLower]: previousName }))
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarPick = () => {
    if (!addressLower) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !addressLower) return
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select an image file')
      event.target.value = ''
      return
    }
    setProfileError(null)
    setProfileSaving(true)
    compressAvatar(file)
      .then(async (result) => {
        if (getDataUrlBytes(result) > MAX_AVATAR_BYTES) {
          setProfileError('Image is too large')
          return
        }
        setCustomAvatars((prev) => ({ ...prev, [addressLower]: result }))
        const row = await saveProfile({
          address: addressLower,
          display_name: customNames[addressLower] ?? null,
          avatar_url: result,
          updated_at: new Date().toISOString(),
        })
        if (row) {
          setCustomNames((prev) => ({
            ...prev,
            [addressLower]: row.display_name ?? null,
          }))
          setCustomAvatars((prev) => ({
            ...prev,
            [addressLower]: row.avatar_url ?? null,
          }))
        } else {
          await loadProfiles([addressLower])
        }
        emitProfileSync(
          row?.display_name ?? customNames[addressLower] ?? null,
          row?.avatar_url ?? result,
        )
      })
      .catch((err) => {
        console.error('Avatar save error:', err)
        if (!isAbortError(err)) {
          setProfileError(getErrorMessage(err))
        }
      })
      .finally(() => {
        setProfileSaving(false)
      })
    event.target.value = ''
  }

  const activePeerLower = activePeerValid ? activePeer.toLowerCase() : ''
  const lastOnlineAt = activePeerLower ? onlinePeers[activePeerLower] : undefined
  const isPeerOnline =
    activePeerValid && lastOnlineAt ? onlineTick - lastOnlineAt < 12000 : false
  const handleBackToList = () => {
    setActivePeer('')
    setPeerInput('')
    setActiveSecret(false)
    setSecretPassphraseDraft('')
    setError(null)
  }

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
            <button
              className="settings-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label={t.settings}
              title={t.settings}
            >
              <span className="settings-btn__icon">⚙️</span>
            </button>
            <button
              className="settings-btn"
              onClick={handleOpenProfile}
              aria-label={t.profile}
              title={t.profile}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-btn__svg">
                <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
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

      <main className={`app__main ${activePeerValid ? 'app__main--chat' : ''}`}>
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
              className="btn btn--icon btn--open"
              onClick={handleSetPeer}
              disabled={!peerInputValid}
              aria-label={t.open}
              title={t.open}
            >
              <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16.2 16.2l4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
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
            {peerCards.length === 0 ? (
              <div className="peer-list__empty">
                {t.emptyPeers}
              </div>
            ) : (
              peerCards.map((card) => {
                const peerLower = card.peer.toLowerCase()
                const isSecretCard = card.secret
                const hasSecret = Boolean(secretPeers[peerLower])
                const isActive =
                  activePeer.toLowerCase() === peerLower &&
                  activeSecret === isSecretCard
                const canCreateSecret = !hasSecret && !isSecretCard
                return (
                  <button
                    key={`${peerLower}:${isSecretCard ? 'secret' : 'main'}`}
                    className={`peer ${isActive ? 'peer--active' : ''} ${
                      isEditing ? 'peer--shake' : ''
                    }`}
                    onClick={() => !isEditing && handleSelectPeer(peerLower, isSecretCard)}
                  >
                    {isEditing && !isSecretCard && (
                      <div
                        className={`peer__lock ${
                          canCreateSecret ? '' : 'peer__lock--off'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!canCreateSecret) return
                          void handleCreateSecretChat(peerLower)
                          handleSelectPeer(peerLower, true)
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect
                            x="6"
                            y="10"
                            width="12"
                            height="9"
                            rx="2.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M8 10V7a4 4 0 0 1 8 0v3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                    {isEditing && isSecretCard && (
                      <div
                        className="peer__remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveSecretChat(peerLower)
                        }}
                      >
                        ✕
                      </div>
                    )}
                    {isEditing && !isSecretCard && (
                      <div
                        className="peer__remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemovePeer(peerLower)
                        }}
                      >
                        ✕
                      </div>
                    )}
                    {!isEditing && unreadPeers[peerLower] && (
                      <div className="peer__unread">!</div>
                    )}
                    {isSecretCard && (
                      <div className="peer__secret-lock">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect
                            x="6"
                            y="10"
                            width="12"
                            height="9"
                            rx="2.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M8 10V7a4 4 0 0 1 8 0v3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', overflow: 'hidden' }}>
                      <AbstractProfile
                        address={peerLower}
                        size="md"
                        src={customAvatars[peerLower] ?? undefined}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <span className="peer__address" style={{ width: '100%' }}>
                          {displayNames[peerLower] || shorten(peerLower)}
                        </span>
                        <span className="peer__full" style={{ width: '100%' }}>
                          {peerLower}
                        </span>
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
            {activePeerValid && (
              <button
                className="chat__back"
                onClick={handleBackToList}
                aria-label="Back"
                title="Back"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15 6l-6 6 6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <div className="chat__left">
              {activePeerValid && (
                <div className="chat__avatar">
                  <AbstractProfile
                    address={activePeer}
                    size="md"
                    src={customAvatars[activePeerLower] ?? undefined}
                  />
                </div>
              )}
              <div className="chat__title">
                {activePeerValid
                  ? displayNames[activePeerLower] || shorten(activePeer)
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
            <MessageList
              visibleMessages={visibleMessages}
              address={address}
              activePeer={activePeer}
              activeSecret={activeSecret}
              t={t}
              readReceiptsByPeer={readReceiptsByPeer}
              profileNames={displayNames}
              handleRemoveMessage={handleRemoveMessage}
            />
          </div>

          {activePeerValid && activeSecret && (
            <div className="chat__secret-bar">
              <input
                className="input chat__secret-input"
                placeholder={t.secretPassphrasePlaceholder}
                value={secretPassphraseDraft}
                onChange={(event) => setSecretPassphraseDraft(event.target.value)}
              />
              <button
                className="btn btn--ghost chat__secret-save"
                onClick={handleSaveSecretPassphrase}
                disabled={!secretPassphraseDraft.trim()}
              >
                {t.secretPassphraseSave}
              </button>
            </div>
          )}

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
                sending ||
                !connected ||
                !activePeerValid ||
                !messageText.trim() ||
                (activeSecret && !chatKeySaved.trim())
              }
              aria-label={t.send}
              title={t.send}
            >
              <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 12l-17-8 6 8-6 8 17-8z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </section>
      </main>
      {profileOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setProfileOpen(false)} />
          <div className="modal__content modal__content--profile">
            <div className="modal__header">
              <div className="modal__title">{t.profileTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="profile">
              <button
                className={`profile__avatar ${profileEditing ? 'editing' : ''}`}
                onClick={handleAvatarPick}
                disabled={!profileEditing}
                title={profileEditing ? "Change avatar" : undefined}
              >
                <AbstractProfile
                  address={address}
                  size="xl"
                  showTooltip={false}
                  src={addressLower ? customAvatars[addressLower] ?? undefined : undefined}
                />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="profile__file"
                onChange={handleAvatarChange}
              />
              <div className="profile__row">
                <div className="profile__address">{profileLabel}</div>
                <button
                  className="btn btn--ghost settings__control settings__control--sm"
                  onClick={() => {
                    setProfileEditing(true)
                    setProfileError(null)
                  }}
                  disabled={!address}
                >
                  {t.edit}
                </button>
              </div>
              {profileEditing && (
                <div className="profile__edit">
                  <input
                    className="input profile__input"
                    placeholder={t.profileNamePlaceholder}
                    value={profileNameDraft}
                    onChange={(event) => setProfileNameDraft(event.target.value)}
                  />
                  <div className="profile__actions">
                    <button
                      className="btn settings__control"
                      onClick={handleProfileSave}
                      disabled={profileSaving || !address}
                    >
                      {profileSaving ? 'Saving...' : t.save}
                    </button>
                    <button
                      className="btn btn--ghost settings__control"
                      onClick={handleProfileCancel}
                      disabled={profileSaving}
                    >
                      {t.profileCancel}
                    </button>
                  </div>
                </div>
              )}
              {profileError && <div className="error">{profileError}</div>}
            </div>
          </div>
        </div>
      )}
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
              <div>{t.walletStatusLabel}</div>
              <div className="settings__actions">
                <div className={`pill ${connected ? 'pill--on' : 'pill--off'}`}>
                  {connected ? t.connected : t.notConnected}
                </div>
              </div>
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
                <video
                  className="emoji-modal__video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src="/ppp1.mp4" type="video/mp4" />
                </video>
              </button>
              <button className="emoji-modal__item" onClick={() => handleSendGif('ppp2.mp4')}>
                <video
                  className="emoji-modal__video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src="/ppp2.mp4" type="video/mp4" />
                </video>
              </button>
              <button className="emoji-modal__item" onClick={() => handleSendGif('ppp3.mp4')}>
                <video
                  className="emoji-modal__video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src="/ppp3.mp4" type="video/mp4" />
                </video>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
