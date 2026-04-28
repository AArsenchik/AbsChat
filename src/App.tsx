import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent as ReactChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode, type TouchEvent } from 'react'
import {
  useAbstractClient,
  useGlobalWalletSignerAccount,
  useLoginWithAbstract,
} from '@abstract-foundation/agw-react'
import { useAccount, usePublicClient, useSignMessage } from 'wagmi'
import { fromHex, isAddress, toHex, parseEther, type Address } from 'viem'
import { abstract } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { LimitType, type SessionConfig } from '@abstract-foundation/agw-client/sessions'
import { supabase } from './lib/supabase'
import { DEFAULT_PROFILE_AVATAR_OPTIONS } from './lib/defaultAvatars'
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
  replyToKey?: string
}

type ReplyDraft = {
  key: string
  from: string
  text: string
}

type MessageReactions = Record<string, Record<string, string[]>>
type ReactionLedgerEntry = {
  threadKey: string
  messageKey: string
  emoji: string
  userId: string
  active: boolean
  updatedAt: number
}
type ReactionLedgerByKey = Record<string, ReactionLedgerEntry>
type AppTheme = 'abschat' | 'x-black'
type RegularConversationMode = 'managed' | 'legacy'
type StoredSessionData = {
  privateKey: `0x${string}`
  session: SessionConfig
}
type NftAvatarOption = {
  id: string
  name: string
  collectionName: string | null
  imageUrl: string
}

type UserSearchResult = {
  address: string
  name: string
  avatarUrl: string | null
}

type ContextMenuState = {
  x: number
  y: number
  messageKey: string
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
  bio?: string | null
  e2ee_public_key?: string | null
  e2ee_backup?: string | null
  e2ee_backup_iv?: string | null
  e2ee_backup_salt?: string | null
}

type GroupMeta = {
  id: string
  name: string
  avatar_url: string | null
  created_by: string
  created_at: string | null
  updated_at: string | null
  role?: string
  member_count?: number
}

type GroupMember = {
  address: string
  role: string
  joined_at: string | null
}

type GroupDetails = GroupMeta & {
  members: GroupMember[]
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
    searchPlaceholder: '0x... or username',
    searchNoUsers: 'No users found',
    searchLoading: 'Searching...',
    searchInvalid: 'Enter a valid recipient address or choose a username',
    createGroup: 'Create group',
    groupTitle: 'New group',
    groupTypeLabel: 'Group',
    groupNameLabel: 'Group name',
    groupNamePlaceholder: 'Enter group name',
    groupMembersLabel: 'Members',
    groupMembersPlaceholder: '0x... addresses separated by comma or new line',
    groupMembersHint: 'You are added automatically.',
    groupCreateAction: 'Create group',
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
    secretInfoTitle: 'Secret mode',
    secretInfoLine1: 'Secret chats use E2EE, which is safer than regular chatting.',
    secretInfoLine2: 'Both sides must set the same password to decrypt messages.',
    secretInfoLine3: 'The password is stored only on this device and never synced.',
    secretInfoLine4: 'Change or clear the password to blur messages instantly.',
    send: 'Send',
    signing: 'Signing…',
    seen: 'Seen',
    typing: 'Typing…',
    settings: 'Settings',
    settingsTitle: 'Settings',
    profile: 'Profile',
    profileTitle: 'Profile',
    profileNamePlaceholder: 'Username',
    profileBioPlaceholder: 'Bio',
    profileBioLimit: 'Up to 67 characters',
    profileCancel: 'Cancel',
    walletStatusLabel: 'Wallet',
    language: 'Language',
    docs: 'Docs',
    openDocs: 'Open docs',
    session: 'Create session',
    sessionEnabled: 'Enabled',
    revokeSession: 'Revoke session',
    transfer: 'Send money',
    transferTitle: 'Send ETH',
    transferRecipient: 'Recipient',
    transferAmountPlaceholder: 'Amount in ETH',
    transferAction: 'Send ETH',
    transferSentLabel: 'You sent',
    transferReceivedLabel: 'You received',
    transferSyncError: 'Transfer was sent, but the chat receipt could not be synced.',
    reply: 'Reply',
    pin: 'Pin',
    unpin: 'Unpin',
    pinned: 'Pinned',
    cancel: 'Cancel',
    pinOnlyMe: 'Only for me',
    pinForEveryone: 'For everyone',
    pinQuestionTitle: 'Pin message',
    pinQuestionText: 'Choose whether this pinned message should stay only on your side or appear for both chat participants.',
    noMessagesYet: 'No messages yet',
    secretChatLabel: 'Secret chat',
    theme: 'Theme',
    themeDefault: 'AbsChat',
    themeXBlack: 'X Black',
    profileChooseNftAvatar: 'Choose NFT avatar',
    profileChooseNftTitle: 'Choose profile photo',
    profileUseAgwAvatar: 'Use pfp from your AGW',
    profileLoadingNfts: 'Loading NFTs...',
    profileSyncingAvatar: 'Saving...',
    profileNoNfts: 'No NFTs found on your Abstract wallet yet.',
    leaveGroup: 'Leave group',
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
    searchPlaceholder: '0x... 或用户名',
    searchNoUsers: '未找到用户',
    searchLoading: '搜索中...',
    searchInvalid: '请输入有效地址或选择用户名',
    createGroup: 'Create group',
    groupTitle: 'New group',
    groupTypeLabel: 'Group',
    groupNameLabel: 'Group name',
    groupNamePlaceholder: 'Enter group name',
    groupMembersLabel: 'Members',
    groupMembersPlaceholder: '0x... addresses separated by comma or new line',
    groupMembersHint: 'You are added automatically.',
    groupCreateAction: 'Create group',
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
    secretInfoTitle: '密聊模式',
    secretInfoLine1: '密聊使用端到端加密，比普通聊天更安全。',
    secretInfoLine2: '双方必须设置相同密码才能解密消息。',
    secretInfoLine3: '密码只保存在本设备，不会同步。',
    secretInfoLine4: '修改或清除密码会立即模糊消息。',
    send: '发送',
    signing: '签名中…',
    seen: '已读',
    typing: '对方正在输入…',
    settings: '设置',
    settingsTitle: '设置',
    profile: '个人资料',
    profileTitle: '个人资料',
    profileNamePlaceholder: '用户名',
    profileBioPlaceholder: 'Bio',
    profileBioLimit: 'Up to 67 characters',
    profileCancel: '取消',
    walletStatusLabel: '钱包',
    language: '语言',
    docs: '文档',
    openDocs: '打开文档',
    session: '创建会话',
    sessionEnabled: '已启用',
    revokeSession: '撤销会话',
    transfer: 'Send money',
    transferTitle: 'Send ETH',
    transferRecipient: 'Recipient',
    transferAmountPlaceholder: 'Amount in ETH',
    transferAction: 'Send ETH',
    transferSentLabel: '你已发送',
    transferReceivedLabel: '你已收到',
    transferSyncError: 'Transfer was sent, but the chat receipt could not be synced.',
    reply: '回复',
    pin: '置顶',
    unpin: '取消置顶',
    pinned: '已置顶',
    cancel: '取消',
    pinOnlyMe: '仅自己可见',
    pinForEveryone: '双方可见',
    pinQuestionTitle: '置顶消息',
    pinQuestionText: '选择仅在你的设备上置顶，或让聊天双方都看到这条置顶消息。',
    noMessagesYet: '暂无消息',
    secretChatLabel: '密聊',
    theme: '主题',
    themeDefault: 'AbsChat',
    themeXBlack: 'X Black',
    profileChooseNftAvatar: 'Choose NFT avatar',
    profileChooseNftTitle: 'Choose profile photo',
    profileUseAgwAvatar: 'Use pfp from your AGW',
    profileLoadingNfts: 'Loading NFTs...',
    profileSyncingAvatar: 'Saving...',
    profileNoNfts: 'No NFTs found on your Abstract wallet yet.',
    leaveGroup: 'Leave group',
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
    searchPlaceholder: '0x... 또는 사용자 이름',
    searchNoUsers: '사용자를 찾을 수 없습니다',
    searchLoading: '검색 중...',
    searchInvalid: '유효한 주소를 입력하거나 사용자 이름을 선택하세요',
    createGroup: 'Create group',
    groupTitle: 'New group',
    groupTypeLabel: 'Group',
    groupNameLabel: 'Group name',
    groupNamePlaceholder: 'Enter group name',
    groupMembersLabel: 'Members',
    groupMembersPlaceholder: '0x... addresses separated by comma or new line',
    groupMembersHint: 'You are added automatically.',
    groupCreateAction: 'Create group',
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
    secretInfoTitle: '비밀 모드',
    secretInfoLine1: '비밀 채팅은 E2EE를 사용해 일반 채팅보다 안전합니다.',
    secretInfoLine2: '양쪽이 같은 비밀번호를 설정해야 복호화됩니다.',
    secretInfoLine3: '비밀번호는 이 기기에만 저장되고 동기화되지 않습니다.',
    secretInfoLine4: '비밀번호를 변경하거나 지우면 즉시 블러 처리됩니다.',
    send: '보내기',
    signing: '서명 중…',
    seen: '읽음',
    typing: '입력 중…',
    settings: '설정',
    settingsTitle: '설정',
    profile: '프로필',
    profileTitle: '프로필',
    profileNamePlaceholder: '사용자 이름',
    profileBioPlaceholder: 'Bio',
    profileBioLimit: 'Up to 67 characters',
    profileCancel: '취소',
    walletStatusLabel: '지갑',
    language: '언어',
    docs: '문서',
    openDocs: '문서 열기',
    session: '세션 생성',
    sessionEnabled: '활성화됨',
    revokeSession: '세션 취소',
    transfer: 'Send money',
    transferTitle: 'Send ETH',
    transferRecipient: 'Recipient',
    transferAmountPlaceholder: 'Amount in ETH',
    transferAction: 'Send ETH',
    transferSentLabel: 'You sent',
    transferReceivedLabel: 'You received',
    transferSyncError: 'Transfer was sent, but the chat receipt could not be synced.',
    reply: '답장',
    pin: '고정',
    unpin: '고정 해제',
    pinned: '고정됨',
    cancel: '취소',
    pinOnlyMe: '나만 보기',
    pinForEveryone: '모두에게',
    pinQuestionTitle: '메시지 고정',
    pinQuestionText: '이 고정을 내 쪽에만 둘지, 대화 상대에게도 보이게 할지 선택하세요.',
    noMessagesYet: '메시지가 아직 없습니다',
    secretChatLabel: '비밀 채팅',
    theme: '테마',
    themeDefault: 'AbsChat',
    themeXBlack: 'X Black',
    profileChooseNftAvatar: 'Choose NFT avatar',
    profileChooseNftTitle: 'Choose profile photo',
    profileUseAgwAvatar: 'Use pfp from your AGW',
    profileLoadingNfts: 'Loading NFTs...',
    profileSyncingAvatar: 'Saving...',
    profileNoNfts: 'No NFTs found on your Abstract wallet yet.',
    leaveGroup: 'Leave group',
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
    searchPlaceholder: '0x... またはユーザー名',
    searchNoUsers: 'ユーザーが見つかりません',
    searchLoading: '検索中...',
    searchInvalid: '有効なアドレスを入力するか、ユーザー名を選択してください',
    createGroup: 'Create group',
    groupTitle: 'New group',
    groupTypeLabel: 'Group',
    groupNameLabel: 'Group name',
    groupNamePlaceholder: 'Enter group name',
    groupMembersLabel: 'Members',
    groupMembersPlaceholder: '0x... addresses separated by comma or new line',
    groupMembersHint: 'You are added automatically.',
    groupCreateAction: 'Create group',
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
    secretInfoTitle: 'シークレットモード',
    secretInfoLine1: 'シークレットチャットはE2EEで通常より安全です。',
    secretInfoLine2: '双方が同じパスワードを設定すると復号できます。',
    secretInfoLine3: 'パスワードはこの端末にのみ保存され同期されません。',
    secretInfoLine4: 'パスワードを変更または削除すると即座にぼかされます。',
    send: '送信',
    signing: '署名中…',
    seen: '既読',
    typing: '入力中…',
    settings: '設定',
    settingsTitle: '設定',
    profile: 'プロフィール',
    profileTitle: 'プロフィール',
    profileNamePlaceholder: 'ユーザー名',
    profileBioPlaceholder: 'Bio',
    profileBioLimit: 'Up to 67 characters',
    profileCancel: 'キャンセル',
    walletStatusLabel: 'ウォレット',
    language: '言語',
    docs: 'ドキュメント',
    openDocs: 'ドキュメントを開く',
    session: 'セッション作成',
    sessionEnabled: '有効',
    revokeSession: 'セッションを取り消す',
    transfer: 'Send money',
    transferTitle: 'Send ETH',
    transferRecipient: 'Recipient',
    transferAmountPlaceholder: 'Amount in ETH',
    transferAction: 'Send ETH',
    transferSentLabel: 'You sent',
    transferReceivedLabel: 'You received',
    transferSyncError: 'Transfer was sent, but the chat receipt could not be synced.',
    reply: '返信',
    pin: 'ピン留め',
    unpin: 'ピン解除',
    pinned: 'ピン留め済み',
    cancel: 'キャンセル',
    pinOnlyMe: '自分だけ',
    pinForEveryone: '全員に表示',
    pinQuestionTitle: 'メッセージを固定',
    pinQuestionText: 'この固定を自分だけにするか、相手にも表示するか選んでください。',
    noMessagesYet: 'まだメッセージはありません',
    secretChatLabel: 'シークレットチャット',
    theme: 'テーマ',
    themeDefault: 'AbsChat',
    themeXBlack: 'X Black',
    profileChooseNftAvatar: 'Choose NFT avatar',
    profileChooseNftTitle: 'Choose profile photo',
    profileUseAgwAvatar: 'Use pfp from your AGW',
    profileLoadingNfts: 'Loading NFTs...',
    profileSyncingAvatar: 'Saving...',
    profileNoNfts: 'No NFTs found on your Abstract wallet yet.',
    leaveGroup: 'Leave group',
  },
}

type MessageListProps = {
  visibleMessages: Message[]
  address: Address | undefined
  activePeer: string
  activePeerGroup: boolean
  activeSecret: boolean
  t: (typeof dict)[keyof typeof dict]
  displayNames: Record<string, string | null>
  displayAvatars: Record<string, string | null>
  readReceiptsByPeer: Record<string, string>
  readReceiptTxByPeer: Record<string, string>
  pinnedMessageKey: string | null
  highlightedMessageKey: string | null
  currentUserReactionId: string
  reactionsByMessage: MessageReactions
  getReplyLabel: (replyKey: string) => string | null
  onReplyChipClick: (replyKey: string) => void
  onOpenContextMenu: (event: MouseEvent, message: Message) => void
  onOpenContextMenuAt: (x: number, y: number, message: Message) => void
  onToggleReaction: (message: Message, emoji: string) => void
  onRemoveFailedMessage: (message: Message) => void
  onOpenSenderProfile: (address: string) => void
}

const MessageList = memo(function MessageList({
  visibleMessages,
  address,
  activePeer,
  activePeerGroup,
  activeSecret,
  t,
  displayNames,
  displayAvatars,
  readReceiptsByPeer,
  readReceiptTxByPeer,
  pinnedMessageKey,
  highlightedMessageKey,
  currentUserReactionId,
  reactionsByMessage,
  getReplyLabel,
  onReplyChipClick,
  onOpenContextMenu,
  onOpenContextMenuAt,
  onToggleReaction,
  onRemoveFailedMessage,
  onOpenSenderProfile,
}: MessageListProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const failedRemoveHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [failedRemoveVisibleKey, setFailedRemoveVisibleKey] = useState<string | null>(null)
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }
  const clearFailedRemoveHideTimer = () => {
    if (failedRemoveHideTimerRef.current) {
      clearTimeout(failedRemoveHideTimerRef.current)
      failedRemoveHideTimerRef.current = null
    }
  }
  const showFailedRemove = (messageKey: string) => {
    clearFailedRemoveHideTimer()
    setFailedRemoveVisibleKey(messageKey)
  }
  const scheduleHideFailedRemove = () => {
    clearFailedRemoveHideTimer()
    failedRemoveHideTimerRef.current = setTimeout(() => {
      setFailedRemoveVisibleKey(null)
      failedRemoveHideTimerRef.current = null
    }, 280)
  }

  useEffect(() => {
    return () => {
      clearFailedRemoveHideTimer()
    }
  }, [])

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
        const readTxHash = normalizeTxHash(readReceiptTxByPeer[peerLower])
        const messageTxHash = normalizeTxHash(message.txHash)
        const messageKey = getMessageKey(message)
        const replyLabel = message.replyToKey ? getReplyLabel(message.replyToKey) : null
        const isPinned = Boolean(pinnedMessageKey && pinnedMessageKey === messageKey)
        const reactionEntries = Object.entries(reactionsByMessage[messageKey] ?? {})
          .filter(([, users]) => users.length > 0)
          .sort((a, b) => b[1].length - a[1].length)
        const isRead =
          outgoing &&
          ((Boolean(readTxHash) &&
            Boolean(messageTxHash) &&
            messageTxHash === readTxHash) ||
            (Boolean(readAt) && message.createdAt < readAt))
        const senderLower = message.from.toLowerCase()
        const senderName =
          displayNames[senderLower]?.trim() || (outgoing ? t.you : shorten(message.from))
        const senderAvatar = displayAvatars[senderLower] ?? undefined
        const gifSrc = getGifSrc(message.text)
        const transfer = parseTransferMessage(message.text)
        const imageUrls = extractMessageImageUrls(message.text)
        const messageText = stripMessageImageDirectives(message.text)
        const isFailedRemovable = Boolean(outgoing && message.status === 'failed')
        const failedRemoveVisible = isFailedRemovable && failedRemoveVisibleKey === messageKey
        const statusLabel =
          message.status === 'pending'
            ? t.awaitSig
            : message.status === 'failed'
              ? t.sigFailed
              : isRead
                ? t.seen
                : null
        const showGroupSenderMeta = Boolean(activePeerGroup && !outgoing)
        return (
          <div
            key={message.id}
            className={`message-row ${outgoing ? 'message-row--out' : 'message-row--in'} ${
              isFailedRemovable ? 'message-row--failed' : ''
            } ${failedRemoveVisible ? 'message-row--failed-visible' : ''}`}
            onMouseEnter={() => {
              if (!isFailedRemovable) return
              showFailedRemove(messageKey)
            }}
            onMouseLeave={() => {
              if (!isFailedRemovable) return
              scheduleHideFailedRemove()
            }}
          >
            <div className="message-row__main">
              {showGroupSenderMeta && (
                <button
                  className="message-row__group-avatar"
                  type="button"
                  onClick={() => onOpenSenderProfile(message.from)}
                  aria-label={`Open ${senderName} profile`}
                >
                  <AbstractProfile
                    address={message.from}
                    src={senderAvatar}
                    size="chat"
                    showTooltip={false}
                  />
                </button>
              )}
              {isFailedRemovable && (
                <button
                  className="message__failed-remove"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveFailedMessage(message)
                    setFailedRemoveVisibleKey(null)
                  }}
                  onMouseEnter={() => showFailedRemove(messageKey)}
                  onMouseLeave={scheduleHideFailedRemove}
                  type="button"
                  aria-label="Remove failed message"
                  title="Remove failed message"
                >
                  ×
                </button>
              )}
              <div className="message-row__bubble-stack">
                {showGroupSenderMeta && (
                  <button
                    className="message__group-sender"
                    type="button"
                    onClick={() => onOpenSenderProfile(message.from)}
                  >
                    <span className="message__group-sender-name">{senderName}</span>
                  </button>
                )}
                <div
                  data-message-key={messageKey}
                  className={`message ${outgoing ? 'message--out' : 'message--in'} ${
                    highlightedMessageKey === messageKey ? 'message--highlighted' : ''
                  }`}
                  onClick={(event) => {
                    if (!isFailedRemovable || !isMobileLayout()) return
                    const target = event.target as HTMLElement
                    if (target.closest('button, a')) return
                    event.preventDefault()
                    onRemoveFailedMessage(message)
                  }}
                  onContextMenu={(event) => {
                    if (isFailedRemovable && isMobileLayout()) {
                      event.preventDefault()
                      return
                    }
                    onOpenContextMenu(event, message)
                  }}
                  onTouchStart={(event) => {
                    if (isFailedRemovable && isMobileLayout()) return
                    clearLongPress()
                    longPressTriggeredRef.current = false
                    const touch = event.touches[0]
                    if (!touch) return
                    longPressTimerRef.current = setTimeout(() => {
                      longPressTriggeredRef.current = true
                      onOpenContextMenuAt(touch.clientX, touch.clientY, message)
                    }, 430)
                  }}
                  onTouchMove={() => {
                    clearLongPress()
                  }}
                  onTouchEnd={(event) => {
                    clearLongPress()
                    if (longPressTriggeredRef.current) {
                      event.preventDefault()
                    }
                  }}
                  onTouchCancel={() => {
                    clearLongPress()
                  }}
                >
                  {replyLabel && (
                    <button
                      className="message__reply-chip"
                      onClick={() => {
                        if (message.replyToKey) {
                          onReplyChipClick(message.replyToKey)
                        }
                      }}
                      type="button"
                    >
                      {replyLabel}
                    </button>
                  )}
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
                    ) : transfer ? (
                      <div className="message__transfer">
                        <div className="message__transfer-head">
                          <div className="message__transfer-label">
                            {outgoing ? t.transferSentLabel : t.transferReceivedLabel}
                          </div>
                          <span className="message__transfer-badge" aria-hidden="true">
                            $
                          </span>
                        </div>
                        <div className="message__transfer-amount">
                          {transfer.amount} ETH
                        </div>
                      </div>
                    ) : (
                      <div className="message__content">
                        {imageUrls.length > 0 && (
                          <div className="message__images">
                            {imageUrls.map((imageUrl) => (
                              <a
                                key={`${messageKey}:${imageUrl}`}
                                className="message__image-link"
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  className="message__image"
                                  src={imageUrl}
                                  alt="Attachment"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        {messageText && (
                          <span className="message__text-main">
                            {renderLinkedText(messageText)}
                          </span>
                        )}
                        <span className="message__time message__time--inline">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>
                  {reactionEntries.length > 0 && (
                    <div className="message__reactions">
                      {reactionEntries.map(([emoji, users]) => {
                        const selected = users.includes(currentUserReactionId)
                        return (
                          <button
                            key={`${messageKey}:${emoji}`}
                            className={`message__reaction ${selected ? 'message__reaction--selected' : ''}`}
                            disabled={!currentUserReactionId}
                            onClick={() => onToggleReaction(message, emoji)}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {(gifSrc || transfer) && (
                    <div className="message__footer">
                      <span className="message__time">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  )}
                  {isPinned && <div className="message__pinned-dot" aria-hidden="true" />}
                </div>
              </div>
            </div>
            {statusLabel && (
              <div
                className={`message__status ${
                  message.status === 'failed'
                    ? 'message__status--error'
                    : message.status === 'pending'
                      ? 'message__status--pending'
                      : 'message__status--read'
                }`}
              >
                {statusLabel}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
})

const profileNameCache = new Map<string, { value: string | null; ts: number }>()
const PROFILE_CACHE_TTL = 5 * 60 * 1000
const PROFILE_EMPTY_CACHE_TTL = 20 * 1000
const SUPABASE_PROFILE_CACHE_TTL = 5 * 60 * 1000
const HISTORY_PAGE_SIZE = 200
const ACTIVE_CHAT_PAGE_SIZE = 120
const ACTIVE_CHAT_POLL_MS = 6000
const GLOBAL_POLL_MS = 45000
const MOBILE_LAYOUT_MAX_WIDTH = 720
const PEER_SWIPE_ACTION_WIDTH = 54
const PEER_SWIPE_ACTION_GAP = 10
const PEER_SWIPE_ACTION_EDGE_INSET = 14
const PEER_SWIPE_CARD_GAP = 18

const getPeerSwipeWidth = (actionCount: number) => {
  if (actionCount <= 0) return 0
  return (
    PEER_SWIPE_ACTION_WIDTH * actionCount +
    PEER_SWIPE_ACTION_GAP * Math.max(0, actionCount - 1) +
    PEER_SWIPE_ACTION_EDGE_INSET +
    PEER_SWIPE_CARD_GAP
  )
}

const isMobileLayout = () =>
  typeof window !== 'undefined' &&
  window.matchMedia(`(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)`).matches

const shorten = (value?: string) => {
  if (!value) return '—'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

const formatRelativeTime = (value: string, now: number) => {
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return ''
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSeconds < 45) return 'now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}w`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo`
  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears}y`
}

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
const TRANSFER_PREFIX = 'transfer:v1:'
const GIF_PREFIX = 'gif:'
const GIF_FILES = ['ppp1.mp4', 'ppp2.mp4', 'ppp3.mp4'] as const
const BACKEND_AUTH_TOKEN_KEY = 'abschatAuthToken'
const BACKEND_AUTH_EXP_KEY = 'abschatAuthExp'
const BACKEND_AUTH_ADDRESS_KEY = 'abschatAuthAddress'
const API_BASE = '/api'
const SESSION_BIGINT_PREFIX = '__abschat_bigint__:'
const IMAGE_DIRECTIVE_PREFIX = 'img:'
const GROUP_ID_PREFIX = 'group:'
const GROUP_ID_REGEX = /^group:[a-z0-9-]{8,}$/i

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...Array.from(bytes)))
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
const stringifyWithBigInt = (value: unknown) =>
  JSON.stringify(value, (_, current) =>
    typeof current === 'bigint'
      ? `${SESSION_BIGINT_PREFIX}${current.toString()}`
      : current,
  )
const parseWithBigInt = <T,>(value: string) =>
  JSON.parse(value, (_, current) =>
    typeof current === 'string' && current.startsWith(SESSION_BIGINT_PREFIX)
      ? BigInt(current.slice(SESSION_BIGINT_PREFIX.length))
      : current,
  ) as T
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

const parseEncryptedV2Payload = (payload: string) => {
  if (!payload.startsWith(ENCRYPTED_V2_PREFIX)) return null
  const raw = payload.slice(ENCRYPTED_V2_PREFIX.length)
  const [ivBase64, dataBase64] = raw.split(':')
  if (!ivBase64 || !dataBase64) return null
  return { ivBase64, dataBase64 }
}

const parseEncryptedPayload = (payload: string) =>
  parseEncryptedV2Payload(payload) ?? parseEncryptedV1Payload(payload)

const parseSecretPayload = (payload: string) => {
  if (!payload.startsWith(SECRET_ENCRYPTED_PREFIX)) return null
  const raw = payload.slice(SECRET_ENCRYPTED_PREFIX.length)
  const [ivBase64, dataBase64] = raw.split(':')
  if (!ivBase64 || !dataBase64) return null
  return { ivBase64, dataBase64 }
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

const encryptPayloadV2WithKey = async (text: string, key: CryptoKey) => {
  if (!crypto?.subtle) {
    throw new Error('Encryption is not supported in this browser')
  }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text),
  )
  return `${ENCRYPTED_V2_PREFIX}${toBase64(iv)}:${toBase64(
    new Uint8Array(encrypted),
  )}`
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
  const parsed = parseEncryptedPayload(payload)
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

const buildTransferMessageText = (amount: string) => `${TRANSFER_PREFIX}${amount}`

const parseTransferMessage = (text: string) => {
  if (!text.startsWith(TRANSFER_PREFIX)) return null
  const amount = text.slice(TRANSFER_PREFIX.length).trim()
  if (!amount) return null
  return { amount }
}

const getGifSrc = (text: string) => {
  if (!text.startsWith(GIF_PREFIX)) return null
  const name = text.slice(GIF_PREFIX.length)
  return GIF_FILES.includes(name as (typeof GIF_FILES)[number]) ? `/${name}` : null
}

const normalizeTxHash = (value?: string | null) =>
  value ? value.toLowerCase() : undefined

const getMessageKey = (message: Pick<Message, 'id' | 'txHash'>) =>
  normalizeTxHash(message.txHash) ?? message.id

const REPLY_PREFIX = 'reply:v1:'

const buildOutgoingMessageText = (text: string, replyToKey?: string | null) => {
  if (!replyToKey) return text
  return `${REPLY_PREFIX}${replyToKey}\n${text}`
}

const parseIncomingMessageText = (text: string) => {
  if (!text.startsWith(REPLY_PREFIX)) {
    return { text, replyToKey: undefined as string | undefined }
  }
  const newline = text.indexOf('\n')
  if (newline <= REPLY_PREFIX.length) {
    return { text, replyToKey: undefined as string | undefined }
  }
  const replyToKey = text.slice(REPLY_PREFIX.length, newline).trim()
  const body = text.slice(newline + 1)
  if (!replyToKey) {
    return { text, replyToKey: undefined as string | undefined }
  }
  return { text: body, replyToKey }
}

const getMessageContent = (payload: string, fallbackText?: string) => {
  if (fallbackText && fallbackText !== 'Encrypted message') {
    return parseIncomingMessageText(fallbackText)
  }
  const initialText = getInitialText(payload)
  if (initialText === 'Encrypted message') {
    return { text: initialText, replyToKey: undefined as string | undefined }
  }
  return parseIncomingMessageText(initialText)
}

const getThreadKey = (peerLower: string, isSecret: boolean) =>
  `${peerLower}:${isSecret ? 'secret' : 'main'}`

const getConversationKey = (
  addressLower: string,
  peerLower: string,
  isSecret: boolean,
) => {
  const [a, b] = [addressLower, peerLower].sort()
  return `${a}:${b}:${isSecret ? 'secret' : 'main'}`
}

const getSharedConversationPassphrase = async (address: string, peer: string) => {
  const [a, b] = [address.toLowerCase(), peer.toLowerCase()].sort()
  const seed = `${a}:${b}:shared-secret-v1`
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(seed))
  return toBase64(new Uint8Array(hash))
}

const summarizeMessageText = (text: string) => {
  const transfer = parseTransferMessage(text)
  if (transfer) return `Transfer ${transfer.amount} ETH`
  const gifSrc = getGifSrc(text)
  const source = gifSrc ? '[GIF]' : text
  const oneLine = source.replace(/\s+/g, ' ').trim()
  return oneLine.length > 72 ? `${oneLine.slice(0, 72)}…` : oneLine
}

const QUICK_REACTIONS = ['❤️', '👌', '👍', '😢', '🔥', '😂', '👀'] as const
const ADDRESS_REGEX = /^0x[a-f0-9]{40}$/i
const MAX_GROUP_AVATAR_FILE_SIZE = 7 * 1024 * 1024
const MAX_GROUP_AVATAR_DATA_URL_LENGTH = 2_000_000
const TYPING_DM_PREFIX = 'dm:'
const TYPING_GROUP_PREFIX = 'group:'
const normalizeGroupId = (value?: string | null) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return GROUP_ID_REGEX.test(raw) ? raw : ''
}
const isGroupId = (value?: string | null) => Boolean(normalizeGroupId(value))
const normalizeAddressValue = (value?: string | null) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw || !ADDRESS_REGEX.test(raw)) return ''
  return raw
}

const buildDmTypingKey = (peerAddress: string) =>
  `${TYPING_DM_PREFIX}${normalizeAddressValue(peerAddress)}`

const buildGroupTypingKey = (groupId: string, memberAddress: string) =>
  `${TYPING_GROUP_PREFIX}${normalizeGroupId(groupId)}:${normalizeAddressValue(memberAddress)}`

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('Failed to read image'))
        return
      }
      resolve(result)
    }
    reader.readAsDataURL(file)
  })

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to process image'))
    img.src = src
  })

const toGroupAvatarDataUrl = async (file: File) => {
  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)
  const cropSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height)
  if (!cropSize || !Number.isFinite(cropSize)) return source
  const cropX = Math.max(0, Math.floor(((image.naturalWidth || image.width) - cropSize) / 2))
  const cropY = Math.max(0, Math.floor(((image.naturalHeight || image.height) - cropSize) / 2))
  const outputSize = Math.min(512, cropSize)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')
  if (!context) return source
  context.drawImage(
    image,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    outputSize,
    outputSize,
  )
  return canvas.toDataURL('image/png')
}

const isMissingGroupSchemaError = (message: string) => {
  const normalized = message.toLowerCase()
  if (normalized.includes('group tables are missing in supabase')) return true
  if (!normalized.includes('group')) return false
  return (
    normalized.includes("could not find the table 'public.groups'") ||
    normalized.includes("could not find the table 'public.group_members'") ||
    normalized.includes('schema cache')
  )
}

const normalizeReactionUserId = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!ADDRESS_REGEX.test(trimmed)) return null
  return trimmed
}

const getReactionUpdatedAtKey = (
  messageKey: string,
  emoji: string,
  userId: string,
) => `${messageKey}::${emoji}::${userId}`

const parseReactionUpdatedAt = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return Date.now()
  return Math.floor(numeric)
}

const sanitizeReactionLedgerMap = (value: Record<string, unknown>) => {
  const next: ReactionLedgerByKey = {}
  Object.entries(value).forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return
    const entry = raw as Partial<ReactionLedgerEntry>
    const userId = normalizeReactionUserId(entry.userId)
    const messageKey = typeof entry.messageKey === 'string' ? entry.messageKey : ''
    const emoji = typeof entry.emoji === 'string' ? entry.emoji : ''
    const threadKey = typeof entry.threadKey === 'string' ? entry.threadKey : ''
    if (!userId || !messageKey || !emoji || !threadKey) return
    next[key] = {
      threadKey,
      messageKey,
      emoji,
      userId,
      active: Boolean(entry.active),
      updatedAt: parseReactionUpdatedAt(entry.updatedAt),
    }
  })
  return next
}

const buildReactionsByMessage = (ledger: ReactionLedgerByKey) => {
  const next: MessageReactions = {}
  Object.values(ledger).forEach((entry) => {
    if (!entry.active) return
    const byEmoji = next[entry.messageKey] ?? {}
    const users = byEmoji[entry.emoji] ?? []
    if (!users.includes(entry.userId)) {
      byEmoji[entry.emoji] = [...users, entry.userId]
      next[entry.messageKey] = byEmoji
    }
  })
  return next
}

const LINK_REGEX = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi
const LINK_TRAILING_PUNCTUATION = /[),.!?]+$/
const IMAGE_URL_REGEX = /https?:\/\/[^\s<]+?\.(?:png|jpe?g|webp|gif|avif)(?:\?[^\s<]*)?/gi

const extractTrailingPunctuation = (value: string) => {
  const match = value.match(LINK_TRAILING_PUNCTUATION)
  if (!match) return { link: value, trailing: '' }
  const trailing = match[0]
  return { link: value.slice(0, -trailing.length), trailing }
}

const extractMessageImageUrls = (text: string) => {
  const urls: string[] = []
  const seen = new Set<string>()

  const add = (url: string) => {
    const normalized = url.trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    urls.push(normalized)
  }

  text
    .split('\n')
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line.toLowerCase().startsWith(IMAGE_DIRECTIVE_PREFIX)) return
      const raw = line.slice(IMAGE_DIRECTIVE_PREFIX.length).trim()
      const { link } = extractTrailingPunctuation(raw)
      if (link) add(link)
    })

  for (const match of text.matchAll(IMAGE_URL_REGEX)) {
    const { link } = extractTrailingPunctuation(match[0] ?? '')
    if (link) add(link)
  }

  return urls
}

const stripMessageImageDirectives = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trim().toLowerCase().startsWith(IMAGE_DIRECTIVE_PREFIX))
    .join('\n')
    .trim()

const renderLinkedText = (text: string): ReactNode => {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(LINK_REGEX)) {
    const fullMatch = match[0]
    const matchIndex = match.index ?? 0
    if (!fullMatch) continue

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex))
    }

    const { link, trailing } = extractTrailingPunctuation(fullMatch)
    if (link) {
      const href = link.startsWith('www.') ? `https://${link}` : link
      nodes.push(
        <a
          key={`${matchIndex}:${link}`}
          className="message__link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link}
        </a>,
      )
      if (trailing) {
        nodes.push(trailing)
      }
    } else {
      nodes.push(fullMatch)
    }

    lastIndex = matchIndex + fullMatch.length
  }

  if (nodes.length === 0) return text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

const toMessage = (row: SupabaseMessage): Message => ({
  ...(() => {
    const parsed = getMessageContent(row.text)
    return {
      id: normalizeTxHash(row.tx_hash) ?? row.tx_hash,
      from: row.from_address,
      to: row.to_address,
      text: parsed.text,
      payload: row.text,
      createdAt: row.created_at,
      status: 'sent' as MessageStatus,
      txHash: normalizeTxHash(row.tx_hash),
      replyToKey: parsed.replyToKey,
    }
  })(),
})

const mergeMessage = (current: Message, incoming: Message): Message => {
  const merged = { ...current, ...incoming }
  const currentText = current.text?.trim() ?? ''
  const incomingText = incoming.text?.trim() ?? ''
  const shouldKeepCurrentText =
    currentText !== '' &&
    currentText !== 'Encrypted message' &&
    incomingText === 'Encrypted message'
  const nextPayload = incoming.payload || current.payload
  const nextTextCandidate = shouldKeepCurrentText ? current.text : merged.text
  const parsed = getMessageContent(nextPayload, nextTextCandidate)

  return {
    ...merged,
    id: incoming.id || current.id,
    txHash: normalizeTxHash(incoming.txHash ?? current.txHash),
    status:
      incoming.status === 'pending' && current.status === 'sent'
        ? current.status
        : incoming.status === 'failed' && current.status === 'sent'
          ? current.status
          : incoming.status,
    text: parsed.text,
    payload: nextPayload,
    createdAt: incoming.createdAt || current.createdAt,
    replyToKey: incoming.replyToKey ?? current.replyToKey ?? parsed.replyToKey,
  }
}

const mergeMessages = (current: Message[], incoming: Message[]) => {
  if (!incoming.length) return current
  const merged = new Map<string, Message>()
  for (const message of current) {
    merged.set(normalizeTxHash(message.txHash) ?? message.id, message)
  }
  for (const message of incoming) {
    const key = normalizeTxHash(message.txHash) ?? message.id
    const existing = merged.get(key)
    merged.set(key, existing ? mergeMessage(existing, message) : message)
  }
  return Array.from(merged.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

import { AbstractProfile } from './components/AbstractProfile'

function App() {
  const { login, logout } = useLoginWithAbstract()
  const { address, status } = useAccount()
  const { address: signerAddress } = useGlobalWalletSignerAccount()
  const { data: abstractClient } = useAbstractClient()
  const publicClient = usePublicClient({ chainId: abstract.id })
  const { signMessageAsync } = useSignMessage()

  const [peerInput, setPeerInput] = useState('')
  const [peerSearchResults, setPeerSearchResults] = useState<UserSearchResult[]>([])
  const [peerSearchLoading, setPeerSearchLoading] = useState(false)
  const [activePeer, setActivePeer] = useState('')
  const [messageText, setMessageText] = useState('')
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferAmountDraft, setTransferAmountDraft] = useState('')
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [groupCreateNameDraft, setGroupCreateNameDraft] = useState('')
  const [groupCreateMemberQuery, setGroupCreateMemberQuery] = useState('')
  const [groupCreateMembers, setGroupCreateMembers] = useState<UserSearchResult[]>([])
  const [groupCreateMemberSearchResults, setGroupCreateMemberSearchResults] = useState<UserSearchResult[]>([])
  const [groupCreateMemberSearchLoading, setGroupCreateMemberSearchLoading] = useState(false)
  const [groupCreateAvatarDraft, setGroupCreateAvatarDraft] = useState<string | null>(null)
  const [groupCreateAvatarProcessing, setGroupCreateAvatarProcessing] = useState(false)
  const [groupCreateLoading, setGroupCreateLoading] = useState(false)
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null)
  const [groupProfileOpen, setGroupProfileOpen] = useState(false)
  const [groupDetailsById, setGroupDetailsById] = useState<Record<string, GroupDetails>>({})
  const [groupProfileDetails, setGroupProfileDetails] = useState<GroupDetails | null>(null)
  const [groupProfileNameDraft, setGroupProfileNameDraft] = useState('')
  const [groupProfileAvatarDraft, setGroupProfileAvatarDraft] = useState<string | null>(null)
  const [groupProfileAvatarProcessing, setGroupProfileAvatarProcessing] = useState(false)
  const [groupProfileLoading, setGroupProfileLoading] = useState(false)
  const [groupProfileSaving, setGroupProfileSaving] = useState(false)
  const [groupProfileError, setGroupProfileError] = useState<string | null>(null)
  const [groupProfileEditing, setGroupProfileEditing] = useState(false)
  const [groupProfileAddMoreOpen, setGroupProfileAddMoreOpen] = useState(false)
  const [groupProfileMemberQuery, setGroupProfileMemberQuery] = useState('')
  const [groupProfileMemberSearchResults, setGroupProfileMemberSearchResults] = useState<
    UserSearchResult[]
  >([])
  const [groupProfileMemberSearchLoading, setGroupProfileMemberSearchLoading] = useState(false)
  const [highlightedMessageKey, setHighlightedMessageKey] = useState<string | null>(null)
  const [pinPromptMessage, setPinPromptMessage] = useState<Message | null>(null)
  const [pinnedByThread, setPinnedByThread] = useState<Record<string, string>>({})
  const [pinnedUpdatedAtByThread, setPinnedUpdatedAtByThread] = useState<Record<string, string>>({})
  const [sharedPinnedByConversation, setSharedPinnedByConversation] = useState<Record<string, string>>({})
  const [sharedPinnedUpdatedAtByConversation, setSharedPinnedUpdatedAtByConversation] = useState<Record<string, string>>({})
  const [reactionLedgerByKey, setReactionLedgerByKey] = useState<ReactionLedgerByKey>({})
  const reactionLedgerByKeyRef = useRef<ReactionLedgerByKey>({})
  const pinnedUpdatedAtByThreadRef = useRef<Record<string, string>>({})
  const sharedPinnedUpdatedAtByConversationRef = useRef<Record<string, string>>({})
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  // Internal state for shared key, not exposed in UI anymore
  const [chatKeySaved, setChatKeySaved] = useState('')
  const [regularConversationMode, setRegularConversationMode] =
    useState<RegularConversationMode>('managed')
  const [regularConversationSecrets, setRegularConversationSecrets] = useState<
    Record<string, string>
  >({})
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncBlock, setLastSyncBlock] = useState<string | null>(null)
  const lastScannedBlock = useRef<bigint | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [profileNames, setProfileNames] = useState<Record<string, string | null>>({})
  const [customNames, setCustomNames] = useState<Record<string, string | null>>({})
  const [customAvatars, setCustomAvatars] = useState<Record<string, string | null>>({})
  const [customBios, setCustomBios] = useState<Record<string, string | null>>({})
  const [groupsById, setGroupsById] = useState<Record<string, GroupMeta>>({})
  const groupsByIdRef = useRef<Record<string, GroupMeta>>({})
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null)
  const conversationKeyRef = useRef<CryptoKey | null>(null)
  const regularConversationModeRef = useRef<RegularConversationMode>('managed')
  const regularConversationSecretsRef = useRef<Record<string, string>>({})
  const [activeSecret, setActiveSecret] = useState(false)
  const [secretPeers, setSecretPeers] = useState<Record<string, string>>({})
  const [secretPassphrases, setSecretPassphrases] = useState<Record<string, string>>({})
  const [secretPassphraseDraft, setSecretPassphraseDraft] = useState('')
  const activePeerRef = useRef<string>('')
  const activeSecretRef = useRef<boolean>(false)
  const [lastReadByPeer, setLastReadByPeer] = useState<Record<string, string>>({})
  const [readReceiptsByPeer, setReadReceiptsByPeer] = useState<Record<string, string>>({})
  const [readReceiptTxByPeer, setReadReceiptTxByPeer] = useState<Record<string, string>>({})
  const readReceiptsByPeerRef = useRef<Record<string, string>>({})
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
    Record<string, { displayName: string | null; avatarUrl: string | null; bio: string | null; ts: number }>
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
  const hiddenSecretPeersRef = useRef<string[]>([])
  const peerVisibilityUpdatedAtRef = useRef<Record<string, string>>({})
  const secretVisibilityUpdatedAtRef = useRef<Record<string, string>>({})
  const customNamesRef = useRef<Record<string, string | null>>({})
  const customAvatarsRef = useRef<Record<string, string | null>>({})
  const customBiosRef = useRef<Record<string, string | null>>({})
  const oldestMessageByPeerRef = useRef<Record<string, string>>({})
  const newestMessageByPeerRef = useRef<Record<string, string>>({})
  const olderMessagesLoadingRef = useRef<Record<string, boolean>>({})
  const olderMessagesExhaustedRef = useRef<Record<string, boolean>>({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [peerProfileAddress, setPeerProfileAddress] = useState<string | null>(null)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [profileBioDraft, setProfileBioDraft] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [nftPickerOpen, setNftPickerOpen] = useState(false)
  const [nftAvatarOptions, setNftAvatarOptions] = useState<NftAvatarOption[]>([])
  const [nftAvatarLoading, setNftAvatarLoading] = useState(false)
  const [nftAvatarLoaded, setNftAvatarLoaded] = useState(false)
  const [nftPickerUseAgwAvatar, setNftPickerUseAgwAvatar] = useState(false)
  const [peerSwipeState, setPeerSwipeState] = useState<{
    key: string | null
    offset: number
  }>({ key: null, offset: 0 })
  const [hiddenPeers, setHiddenPeers] = useState<string[]>([])
  const [peerVisibilityUpdatedAt, setPeerVisibilityUpdatedAt] = useState<Record<string, string>>({})
  const [hiddenSecretPeers, setHiddenSecretPeers] = useState<string[]>([])
  const [secretVisibilityUpdatedAt, setSecretVisibilityUpdatedAt] = useState<Record<string, string>>({})
  const [secretInfoOpen, setSecretInfoOpen] = useState(false)
  const groupCreateAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const groupProfileAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const groupDetailsWarmupRef = useRef<Record<string, boolean>>({})
  const backendAuthInFlightRef = useRef(false)
  const [backendAuthed, setBackendAuthed] = useState(false)
  const avatarPickerOptions = useMemo<NftAvatarOption[]>(() => {
    const merged = [...DEFAULT_PROFILE_AVATAR_OPTIONS]
    const seen = new Set(merged.map((item) => item.imageUrl))
    nftAvatarOptions.forEach((item) => {
      if (seen.has(item.imageUrl)) return
      seen.add(item.imageUrl)
      merged.push(item)
    })
    return merged
  }, [nftAvatarOptions])
  const peerSwipeTouchRef = useRef<{
    key: string
    startX: number
    startY: number
    baseOffset: number
    maxOffset: number
    moved: boolean
    horizontal: boolean
  } | null>(null)
  const peerSwipeSuppressTapRef = useRef<string | null>(null)

  useEffect(() => {
    reactionLedgerByKeyRef.current = reactionLedgerByKey
  }, [reactionLedgerByKey])

  useEffect(() => {
    setNftAvatarOptions([])
    setNftAvatarLoaded(false)
    setNftPickerOpen(false)
    setNftPickerUseAgwAvatar(false)
  }, [address])

  useEffect(() => {
    pinnedUpdatedAtByThreadRef.current = pinnedUpdatedAtByThread
  }, [pinnedUpdatedAtByThread])

  useEffect(() => {
    sharedPinnedUpdatedAtByConversationRef.current = sharedPinnedUpdatedAtByConversation
  }, [sharedPinnedUpdatedAtByConversation])

  const syncLog = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      const stamp = new Date().toISOString()
      const addr = address ? address.toLowerCase() : ''
      const deviceId = deviceIdRef.current
      console.log('[sync]', stamp, event, { address: addr, deviceId, ...data })
    },
    [address],
  )

  const clearBackendAuthStorage = useCallback(() => {
    localStorage.removeItem(BACKEND_AUTH_TOKEN_KEY)
    localStorage.removeItem(BACKEND_AUTH_EXP_KEY)
    localStorage.removeItem(BACKEND_AUTH_ADDRESS_KEY)
  }, [])

  const handleLogout = useCallback(() => {
    clearBackendAuthStorage()
    setBackendAuthed(false)
    logout()
  }, [clearBackendAuthStorage, logout])

  const ensureBackendAuth = useCallback(async () => {
    if (!address) {
      clearBackendAuthStorage()
      setBackendAuthed(false)
      return
    }
    const addressLower = address.toLowerCase()
    const storedToken = localStorage.getItem(BACKEND_AUTH_TOKEN_KEY)
    const storedExpRaw = localStorage.getItem(BACKEND_AUTH_EXP_KEY)
    const storedExp = Number(storedExpRaw ?? '0')
    const storedAddress = localStorage.getItem(BACKEND_AUTH_ADDRESS_KEY) ?? ''
    const hasValidExp =
      Number.isFinite(storedExp) && storedExp > Date.now() / 1000 + 60
    const canReuseToken =
      storedToken &&
      storedAddress === addressLower &&
      (!storedExpRaw || hasValidExp)
    if (canReuseToken) {
      supabase?.realtime.setAuth(storedToken)
      setBackendAuthed(true)
      return
    }
    clearBackendAuthStorage()
    if (backendAuthInFlightRef.current) return
    backendAuthInFlightRef.current = true
    try {
      const nonce = crypto.randomUUID()
      const message = `AbsChat login\nAddress: ${addressLower}\nNonce: ${nonce}`
      const signature = await signMessageAsync({ message })
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addressLower, message, signature }),
      })
      const data = await response.json()
      if (!response.ok || !data?.access_token) {
        throw new Error(data?.error ?? 'Auth failed')
      }
      localStorage.setItem(BACKEND_AUTH_TOKEN_KEY, data.access_token)
      if (data.expires_at) {
        localStorage.setItem(BACKEND_AUTH_EXP_KEY, String(data.expires_at))
      }
      localStorage.setItem(BACKEND_AUTH_ADDRESS_KEY, addressLower)
      supabase?.realtime.setAuth(data.access_token)
      setBackendAuthed(true)
    } catch (err) {
      clearBackendAuthStorage()
      setError(getErrorMessage(err))
      setBackendAuthed(false)
    } finally {
      backendAuthInFlightRef.current = false
    }
  }, [address, signMessageAsync, clearBackendAuthStorage, supabase])

  const emitSecretVisibility = useCallback(
    (peer: string, hidden: boolean, updatedAt: string) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      void signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'secret_visibility',
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

  const getBackendToken = useCallback((targetAddress?: string | null) => {
    if (typeof localStorage === 'undefined') return null
    const token = localStorage.getItem(BACKEND_AUTH_TOKEN_KEY)
    if (!token) return null
    const storedAddressRaw = localStorage.getItem(BACKEND_AUTH_ADDRESS_KEY) ?? ''
    const storedAddress = storedAddressRaw.trim().toLowerCase()
    const expectedAddressRaw = targetAddress ?? address ?? ''
    const expectedAddress = String(expectedAddressRaw).trim().toLowerCase()
    if (expectedAddress && (!storedAddress || storedAddress !== expectedAddress)) {
      return null
    }
    const expValue = localStorage.getItem(BACKEND_AUTH_EXP_KEY)
    if (!expValue) return token
    const exp = Number(expValue)
    if (!Number.isFinite(exp)) return token
    if (Date.now() / 1000 > exp - 60) return null
    return token
  }, [address])

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const callApi = async (token: string) => {
      const headers = new Headers(options?.headers)
      headers.set('Authorization', `Bearer ${token}`)
      if (!headers.has('Content-Type') && options?.body) {
        headers.set('Content-Type', 'application/json')
      }
      return await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      })
    }

    const ensureToken = async () => {
      let token = getBackendToken(address)
      if (!token && address) {
        await ensureBackendAuth()
        token = getBackendToken(address)
      }
      if (!token) {
        throw new Error('Auth failed')
      }
      return token
    }

    let token = await ensureToken()
    let response = await callApi(token)
    if ((response.status === 401 || response.status === 403) && address) {
      clearBackendAuthStorage()
      setBackendAuthed(false)
      await ensureBackendAuth()
      token = await ensureToken()
      response = await callApi(token)
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error ?? 'Request failed')
    }
    return response.json()
  }, [address, getBackendToken, ensureBackendAuth, clearBackendAuthStorage])

  const resolvePortalNameForAddress = useCallback(
    async (
      targetAddress: string,
      signal?: AbortSignal,
      fallbackAddresses: string[] = [],
    ) => {
      const peerLower = targetAddress.trim().toLowerCase()
      if (!peerLower) return null

      const lookupAddresses = Array.from(
        new Set(
          [peerLower, ...fallbackAddresses]
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
        ),
      )

      for (const lookupAddress of lookupAddresses) {
        const response = await fetch(
          `/api/portal?address=${encodeURIComponent(lookupAddress)}`,
          { signal },
        )
        if (!response.ok) continue
        const data = await response.json()
        const name =
          typeof data?.user?.name === 'string' && data.user.name.trim()
            ? data.user.name.trim()
            : null
        if (!name) continue
        profileNameCache.set(peerLower, { value: name, ts: Date.now() })
        return name
      }

      profileNameCache.set(peerLower, { value: null, ts: Date.now() })
      return null
    },
    [],
  )

  const fetchPortalNameForAddress = useCallback(
    async (
      targetAddress: string,
      signal?: AbortSignal,
      fallbackAddresses: string[] = [],
    ) => {
      const peerLower = targetAddress.trim().toLowerCase()
      if (!peerLower) return null
      const name = await resolvePortalNameForAddress(
        peerLower,
        signal,
        fallbackAddresses,
      )
      setProfileNames((prev) => ({ ...prev, [peerLower]: name }))
      return name
    },
    [resolvePortalNameForAddress],
  )

  const loadRegularConversationSecrets = useCallback(
    async (peersToLoad: string[]) => {
      if (!address || !backendAuthed || regularConversationModeRef.current === 'legacy') {
        return {}
      }
      const addressLower = address.toLowerCase()
      const peers = Array.from(
        new Set(
          peersToLoad
            .map((peer) => peer.trim().toLowerCase())
            .filter((peer) => peer && peer !== addressLower),
        ),
      )
      const missing = peers.filter((peer) => !regularConversationSecretsRef.current[peer])
      if (missing.length === 0) {
        return Object.fromEntries(
          peers
            .map((peer) => [peer, regularConversationSecretsRef.current[peer]])
            .filter((entry): entry is [string, string] => Boolean(entry[1])),
        )
      }
      const params = new URLSearchParams({ peers: missing.join(',') })
      const response = await apiFetch(`/conversation-keys?${params.toString()}`)
      const mode =
        response?.mode === 'legacy' ? ('legacy' as RegularConversationMode) : 'managed'
      if (mode === 'legacy') {
        regularConversationModeRef.current = 'legacy'
        setRegularConversationMode('legacy')
        return {}
      }
      const rows = Array.isArray(response?.data) ? response.data : []
      const updates: Record<string, string> = {}
      rows.forEach((item: { peer_address?: string; secret?: string }) => {
        const peerLower = String(item.peer_address ?? '').toLowerCase()
        const secret = typeof item.secret === 'string' ? item.secret : ''
        if (!peerLower || !secret) return
        updates[peerLower] = secret
      })
      if (Object.keys(updates).length > 0) {
        regularConversationSecretsRef.current = {
          ...regularConversationSecretsRef.current,
          ...updates,
        }
        setRegularConversationSecrets((prev) => ({ ...prev, ...updates }))
      }
      return updates
    },
    [address, apiFetch, backendAuthed],
  )

  const ensureRegularConversationMaterial = useCallback(
    async (peerLower: string) => {
      if (!address) {
        throw new Error('Wallet is not connected')
      }
      const cachedManagedSecret = regularConversationSecretsRef.current[peerLower] ?? ''
      if (regularConversationModeRef.current !== 'legacy' && cachedManagedSecret) {
        const salt = await getConversationSalt(address, peerLower)
        const key = await deriveKey(cachedManagedSecret, salt)
        return { mode: 'managed' as const, secret: cachedManagedSecret, key }
      }
      let mode = regularConversationModeRef.current
      if (mode !== 'legacy') {
        if (!backendAuthed) {
          await ensureBackendAuth()
        }
        let secret = regularConversationSecretsRef.current[peerLower] ?? ''
        if (!secret && regularConversationModeRef.current !== 'legacy') {
          const loaded = await loadRegularConversationSecrets([peerLower])
          secret = loaded[peerLower] ?? regularConversationSecretsRef.current[peerLower] ?? ''
        }
        mode = regularConversationModeRef.current
        if (mode !== 'legacy') {
          if (!secret) {
            throw new Error('Regular chat key is not ready yet')
          }
          const salt = await getConversationSalt(address, peerLower)
          const key = await deriveKey(secret, salt)
          return { mode: 'managed' as const, secret, key }
        }
      }
      const secret = await getSharedConversationPassphrase(address, peerLower)
      const salt = await getConversationSalt(address, peerLower)
      const key = await deriveKey(secret, salt)
      return { mode: 'legacy' as const, secret, key }
    },
    [address, backendAuthed, ensureBackendAuth, loadRegularConversationSecrets],
  )

  const loadSecretChats = useCallback(
    async (addressLower: string) => {
      if (!backendAuthed) return
      try {
        const response = await apiFetch(`/secret-chats?chainId=${abstract.id}`)
        const data = Array.isArray(response?.data) ? response.data : []
        const next: Record<string, string> = {}
        data.forEach((item: { address_a: string; address_b: string; created_at: string }) => {
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
    [apiFetch, backendAuthed],
  )


  const handleCreateSecretChat = useCallback(
    async (peerLower: string) => {
      if (!backendAuthed || !address) return
      const addressLower = address.toLowerCase()
      const createdAt = new Date().toISOString()
      try {
        try {
          await apiFetch('/secret-visibility', {
            method: 'POST',
            body: JSON.stringify({
              owner_address: addressLower,
              peer_address: peerLower,
              chain_id: abstract.id,
              hidden: false,
              updated_at: createdAt,
            }),
          })
        } catch (err) {
          syncLog('secret_visibility_create_error', { error: getErrorMessage(err) })
        }
        await apiFetch('/secret-chats', {
          method: 'POST',
          body: JSON.stringify({
            peer: peerLower,
            chain_id: abstract.id,
            created_at: createdAt,
          }),
        })
        setHiddenSecretPeers((prev) => prev.filter((peer) => peer !== peerLower))
        setSecretVisibilityUpdatedAt((prev) => ({
          ...prev,
          [peerLower]: createdAt,
        }))
        setSecretPeers((prev) => ({ ...prev, [peerLower]: createdAt }))
        emitSecretVisibility(peerLower, false, createdAt)
        syncLog('secret_chat_create', { peer: peerLower })
      } catch (err) {
        syncLog('secret_chat_create_error', { error: getErrorMessage(err) })
      }
    },
    [address, emitSecretVisibility, syncLog, backendAuthed, apiFetch],
  )

  const handleRemoveSecretChat = useCallback(
    async (peerLower: string) => {
      if (!address) return
      const updatedAt = new Date().toISOString()
      setHiddenSecretPeers((prev) => {
        if (prev.includes(peerLower)) return prev
        return [...prev, peerLower]
      })
      setSecretVisibilityUpdatedAt((prev) => ({
        ...prev,
        [peerLower]: updatedAt,
      }))
      if (activeSecret && activePeer.toLowerCase() === peerLower) {
        setActiveSecret(false)
      }
      const addressLower = address.toLowerCase()
      try {
        await apiFetch('/secret-visibility', {
          method: 'POST',
          body: JSON.stringify({
            owner_address: addressLower,
            peer_address: peerLower,
            chain_id: abstract.id,
            hidden: true,
            updated_at: updatedAt,
          }),
        })
      } catch (err) {
        syncLog('secret_visibility_remove_error', { error: getErrorMessage(err) })
      }
      emitSecretVisibility(peerLower, true, updatedAt)
      syncLog('secret_chat_remove', { peer: peerLower })
    },
    [address, activePeer, activeSecret, emitSecretVisibility, syncLog, apiFetch],
  )

  useEffect(() => {
    conversationKeyRef.current = conversationKey
  }, [conversationKey])

  useEffect(() => {
    regularConversationModeRef.current = regularConversationMode
  }, [regularConversationMode])

  useEffect(() => {
    regularConversationSecretsRef.current = regularConversationSecrets
  }, [regularConversationSecrets])

  useEffect(() => {
    activePeerRef.current = activePeer ? activePeer.toLowerCase() : ''
  }, [activePeer])

  useEffect(() => {
    activeSecretRef.current = activeSecret
  }, [activeSecret])


  useEffect(() => {
    hiddenPeersRef.current = hiddenPeers
  }, [hiddenPeers])

  useEffect(() => {
    hiddenSecretPeersRef.current = hiddenSecretPeers
  }, [hiddenSecretPeers])

  useEffect(() => {
    peerVisibilityUpdatedAtRef.current = peerVisibilityUpdatedAt
  }, [peerVisibilityUpdatedAt])

  useEffect(() => {
    secretVisibilityUpdatedAtRef.current = secretVisibilityUpdatedAt
  }, [secretVisibilityUpdatedAt])

  useEffect(() => {
    customNamesRef.current = customNames
  }, [customNames])

  useEffect(() => {
    customAvatarsRef.current = customAvatars
  }, [customAvatars])

  useEffect(() => {
    customBiosRef.current = customBios
  }, [customBios])

  useEffect(() => {
    groupsByIdRef.current = groupsById
  }, [groupsById])

  useEffect(() => {
    readReceiptsByPeerRef.current = readReceiptsByPeer
  }, [readReceiptsByPeer])

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
  const addressLower = address ? address.toLowerCase() : ''
  const peerInputTrimmed = peerInput.trim()
  const peerInputAddress = peerInputTrimmed ? normalizeAddressValue(peerInputTrimmed) : ''
  const peerInputIsGroup = peerInputTrimmed ? isGroupId(peerInputTrimmed) : false
  const peerInputValid = Boolean(peerInputAddress || peerInputIsGroup)
  const activePeerAddress = activePeer ? isAddress(activePeer) : false
  const activePeerGroup = isGroupId(activePeer)
  const activePeerValid = Boolean(activePeer) && (activePeerAddress || activePeerGroup)

  useEffect(() => {
    if (connected) void ensureBackendAuth()
  }, [connected, ensureBackendAuth])

  useEffect(() => {
    if (!connected) {
      setBackendAuthed(false)
    }
  }, [connected])

  useEffect(() => {
    if (!address) return
    const addressLower = address.toLowerCase()
    const storedAddress = localStorage.getItem(BACKEND_AUTH_ADDRESS_KEY)
    if (storedAddress && storedAddress !== addressLower) {
      localStorage.removeItem(BACKEND_AUTH_TOKEN_KEY)
      localStorage.removeItem(BACKEND_AUTH_EXP_KEY)
      localStorage.removeItem(BACKEND_AUTH_ADDRESS_KEY)
      setBackendAuthed(false)
    }
  }, [address])
  const [lang, setLang] = useState<string>(() => {
    const saved = localStorage.getItem('lang')
    return saved || 'en'
  })
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'abschat' ? 'abschat' : 'x-black'
  })
  const t = dict[lang as keyof typeof dict] || dict.en
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [sessionEnabled, setSessionEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('sessionEnabled')
    return saved === 'true'
  })
  const [isSessionSubmitting, setIsSessionSubmitting] = useState(false)
  const sessionCreateRunRef = useRef(0)

  const handleCreateSession = async () => {
    if (!abstractClient || !address || isSessionSubmitting) return
    const runId = Date.now()
    sessionCreateRunRef.current = runId
    setIsSessionSubmitting(true)

    let settled = false
    const softRecoveryTimer = window.setTimeout(() => {
      if (settled || sessionCreateRunRef.current !== runId) return
      setIsSessionSubmitting(false)
    }, 30000)

    try {
      const sessionPrivateKey = generatePrivateKey()
      const sessionSigner = privateKeyToAccount(sessionPrivateKey)
      const session: SessionConfig = {
        signer: sessionSigner.address,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7),
        feeLimit: {
          limitType: LimitType.Lifetime,
          limit: parseEther('10'),
          period: BigInt(0),
        },
        callPolicies: [],
        transferPolicies: [
          {
            target: address as Address,
            maxValuePerUse: parseEther('0'),
            valueLimit: {
              limitType: LimitType.Unlimited,
              limit: BigInt(0),
              period: BigInt(0),
            },
          },
        ],
      }
      const createdSession = await abstractClient.createSession({
        account: address as Address,
        chain: abstract,
        session,
      })
      if (sessionCreateRunRef.current !== runId) return
      settled = true
      window.clearTimeout(softRecoveryTimer)
      localStorage.setItem(
        `session:${address.toLowerCase()}`,
        stringifyWithBigInt({
          privateKey: sessionPrivateKey,
          session: createdSession.session,
        } satisfies StoredSessionData),
      )
      setSessionEnabled(true)
      alert('Session created! You can now chat without signing transactions.')
    } catch (err: unknown) {
      if (sessionCreateRunRef.current !== runId) return
      settled = true
      window.clearTimeout(softRecoveryTimer)
      console.error(err)
      const msg = getErrorMessage(err)
      if (msg.includes('Status: Unset') || msg.includes('Policy violation')) {
        alert(
          'Session creation failed: Session keys on Abstract Mainnet are currently restricted to whitelisted apps. ' +
            'This feature will be available once the app is whitelisted. ' +
            'Please continue signing transactions manually for now.',
        )
      } else if (
        msg.toLowerCase().includes('timed out') ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('approving')
      ) {
        alert(
          'Session approval is taking too long in Abstract Wallet. Close the wallet screen and try again. You can keep using regular signing for now.',
        )
      } else {
        alert(`Failed to create session: ${msg}`)
      }
      setSessionEnabled(false)
    } finally {
      if (sessionCreateRunRef.current === runId) {
        window.clearTimeout(softRecoveryTimer)
        setIsSessionSubmitting(false)
      }
    }
  }

  const handleRevokeSession = () => {
    localStorage.removeItem(`session:${address?.toLowerCase()}`)
    setSessionEnabled(false)
    alert('Session revoked.')
  }


  const peers = useMemo(() => {
    const set = new Set<string>()
    Object.keys(groupsById).forEach((groupId) => {
      const normalized = normalizeGroupId(groupId)
      if (normalized) set.add(normalized)
    })
    messages.forEach((message) => {
      if (!address) return
      const fromLower = message.from.toLowerCase()
      const toLower = message.to.toLowerCase()
      const peer =
        isGroupId(toLower)
          ? groupsById[toLower]
            ? toLower
            : ''
          : fromLower === address.toLowerCase()
            ? toLower
            : fromLower
      if (peer) set.add(peer.toLowerCase())
    })
    return Array.from(set).filter((p) => !hiddenPeers.includes(p.toLowerCase()))
  }, [
    messages,
    address,
    peerInputTrimmed,
    peerInputValid,
    peerInputAddress,
    peerInputIsGroup,
    hiddenPeers,
    groupsById,
  ])

  const peerCards = useMemo(() => {
    const base = new Set(peers.map((p) => p.toLowerCase()))
    const cards: { peer: string; secret: boolean }[] = []
    base.forEach((peerLower) => {
      cards.push({ peer: peerLower, secret: false })
      if (secretPeers[peerLower] && !hiddenSecretPeers.includes(peerLower)) {
        cards.push({ peer: peerLower, secret: true })
      }
    })
    Object.keys(secretPeers).forEach((peerLower) => {
      if (!base.has(peerLower) && !hiddenSecretPeers.includes(peerLower)) {
        cards.push({ peer: peerLower, secret: true })
      }
    })
    return cards
  }, [peers, secretPeers, hiddenSecretPeers])

  useEffect(() => {
    const targets: string[] = []
    const seen = new Set<string>()
    const ownAddressLower = address?.toLowerCase().trim() ?? ''
    const ownSignerLower = signerAddress?.toLowerCase().trim() ?? ''
    const pushTarget = (value?: string | null) => {
      const next = String(value ?? '').toLowerCase().trim()
      if (!next || seen.has(next) || isGroupId(next) || !isAddress(next)) return
      seen.add(next)
      targets.push(next)
    }
    pushTarget(address)
    peers.forEach((peer) => pushTarget(peer))
    if (activePeerValid) pushTarget(activePeer)
    if (targets.length === 0) return
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      const updates: Record<string, string | null> = {}
      const peersToLoad = targets.slice(0, 24)
      for (const peerLower of peersToLoad) {
        const cached = profileNameCache.get(peerLower)
        if (cached) {
          const ttl = cached.value ? PROFILE_CACHE_TTL : PROFILE_EMPTY_CACHE_TTL
          const isFresh = Date.now() - cached.ts < ttl
          if (cached.value || isFresh) {
            if (cached.value) {
              updates[peerLower] = cached.value
            }
            continue
          }
        }
        try {
          const fallbackAddresses =
            peerLower === ownAddressLower &&
            ownSignerLower &&
            ownSignerLower !== ownAddressLower
              ? [ownSignerLower]
              : []
          const name = await resolvePortalNameForAddress(
            peerLower,
            controller.signal,
            fallbackAddresses,
          )
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
  }, [address, signerAddress, peers, activePeer, activePeerValid, resolvePortalNameForAddress])

  useEffect(() => {
    const query = peerInputTrimmed
    if (!query || peerInputValid || query.length < 2) {
      setPeerSearchResults([])
      setPeerSearchLoading(false)
      return
    }
    if (!connected) {
      setPeerSearchResults([])
      setPeerSearchLoading(false)
      return
    }
    if (!backendAuthed) {
      void ensureBackendAuth().catch(() => {})
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setPeerSearchLoading(true)
      try {
        const response = await apiFetch(
          `/user-search?q=${encodeURIComponent(query)}&limit=8`,
        )
        if (cancelled) return
        setPeerSearchResults(
          Array.isArray(response?.data) ? (response.data as UserSearchResult[]) : [],
        )
      } catch (err) {
        if (!cancelled) {
          console.error('User search error:', err)
          setPeerSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setPeerSearchLoading(false)
        }
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [peerInputTrimmed, peerInputValid, connected, backendAuthed, ensureBackendAuth, apiFetch])

  useEffect(() => {
    if (!groupCreateOpen) {
      setGroupCreateMemberSearchResults([])
      setGroupCreateMemberSearchLoading(false)
      return
    }
    const query = groupCreateMemberQuery.trim()
    if (!query || query.length < 2 || ADDRESS_REGEX.test(query)) {
      setGroupCreateMemberSearchResults([])
      setGroupCreateMemberSearchLoading(false)
      return
    }
    if (!connected) {
      setGroupCreateMemberSearchResults([])
      setGroupCreateMemberSearchLoading(false)
      return
    }
    if (!backendAuthed) {
      void ensureBackendAuth().catch(() => {})
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setGroupCreateMemberSearchLoading(true)
      try {
        const response = await apiFetch(
          `/user-search?q=${encodeURIComponent(query)}&limit=10`,
        )
        if (cancelled) return
        setGroupCreateMemberSearchResults(
          Array.isArray(response?.data) ? (response.data as UserSearchResult[]) : [],
        )
      } catch (err) {
        if (!cancelled) {
          console.error('Group member search error:', err)
          setGroupCreateMemberSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setGroupCreateMemberSearchLoading(false)
        }
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    groupCreateOpen,
    groupCreateMemberQuery,
    connected,
    backendAuthed,
    ensureBackendAuth,
    apiFetch,
  ])

  useEffect(() => {
    if (!groupProfileOpen || !groupProfileAddMoreOpen) {
      setGroupProfileMemberSearchResults([])
      setGroupProfileMemberSearchLoading(false)
      return
    }
    const query = groupProfileMemberQuery.trim()
    if (!query || query.length < 2 || ADDRESS_REGEX.test(query)) {
      setGroupProfileMemberSearchResults([])
      setGroupProfileMemberSearchLoading(false)
      return
    }
    if (!connected) {
      setGroupProfileMemberSearchResults([])
      setGroupProfileMemberSearchLoading(false)
      return
    }
    if (!backendAuthed) {
      void ensureBackendAuth().catch(() => {})
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setGroupProfileMemberSearchLoading(true)
      try {
        const response = await apiFetch(
          `/user-search?q=${encodeURIComponent(query)}&limit=10`,
        )
        if (cancelled) return
        setGroupProfileMemberSearchResults(
          Array.isArray(response?.data) ? (response.data as UserSearchResult[]) : [],
        )
      } catch (err) {
        if (!cancelled) {
          console.error('Group profile member search error:', err)
          setGroupProfileMemberSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setGroupProfileMemberSearchLoading(false)
        }
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    groupProfileOpen,
    groupProfileAddMoreOpen,
    groupProfileMemberQuery,
    connected,
    backendAuthed,
    ensureBackendAuth,
    apiFetch,
  ])

  const loadProfiles = useCallback(
    async (addresses: string[]) => {
      if (!backendAuthed || addresses.length === 0) return
      const now = Date.now()
      const cachedNameUpdates: Record<string, string | null> = {}
      const cachedAvatarUpdates: Record<string, string | null> = {}
      const cachedBioUpdates: Record<string, string | null> = {}
      const toFetch: string[] = []
      addresses.forEach((address) => {
        const key = address.toLowerCase()
        const cached = profileCacheRef.current[key]
        if (cached) {
          const isFresh = now - cached.ts < SUPABASE_PROFILE_CACHE_TTL
          if (isFresh) {
            cachedNameUpdates[key] = cached.displayName ?? null
            cachedAvatarUpdates[key] = cached.avatarUrl ?? null
            cachedBioUpdates[key] = cached.bio ?? null
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
      if (Object.keys(cachedBioUpdates).length > 0) {
        setCustomBios((prev) => ({ ...prev, ...cachedBioUpdates }))
      }
      if (toFetch.length === 0) return
      let data: SupabaseProfile[] = []
      try {
        const response = await apiFetch(
          `/profiles?addresses=${encodeURIComponent(toFetch.join(','))}`,
        )
        data = Array.isArray(response?.data) ? response.data : []
      } catch (err) {
        console.error('Profile load error:', err)
        return
      }
      const nameUpdates: Record<string, string | null> = {}
      const avatarUpdates: Record<string, string | null> = {}
      const bioUpdates: Record<string, string | null> = {}
      const received = new Set<string>()
      data.forEach((item: SupabaseProfile) => {
        if (!item?.address) return
        const key = item.address.toLowerCase()
        received.add(key)
        nameUpdates[key] = item.display_name ?? null
        avatarUpdates[key] = item.avatar_url ?? null
        const hasBioField = Object.prototype.hasOwnProperty.call(item, 'bio')
        const cachedBio = profileCacheRef.current[key]?.bio ?? null
        const currentBio = customBiosRef.current[key] ?? null
        const nextBio = hasBioField ? item.bio ?? null : currentBio ?? cachedBio
        bioUpdates[key] = nextBio
        profileCacheRef.current[key] = {
          displayName: item.display_name ?? null,
          avatarUrl: item.avatar_url ?? null,
          bio: nextBio,
          ts: now,
        }
      })
      toFetch.forEach((key) => {
        if (received.has(key)) return
        profileCacheRef.current[key] = {
          displayName: null,
          avatarUrl: null,
          bio: null,
          ts: now,
        }
      })
      if (Object.keys(nameUpdates).length > 0) {
        setCustomNames((prev) => ({ ...prev, ...nameUpdates }))
      }
      if (Object.keys(avatarUpdates).length > 0) {
        setCustomAvatars((prev) => ({ ...prev, ...avatarUpdates }))
      }
      if (Object.keys(bioUpdates).length > 0) {
        setCustomBios((prev) => ({ ...prev, ...bioUpdates }))
      }
    },
    [setCustomNames, setCustomAvatars, setCustomBios, backendAuthed, apiFetch],
  )

  const saveProfile = useCallback(
    async (payload: {
      address: string
      display_name: string | null
      avatar_url: string | null
      bio: string | null
      updated_at: string
    }) => {
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
        const response = await withTimeout(
          apiFetch('/profiles', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
          12000,
        )
        const row = response?.data as SupabaseProfile | null
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
    [apiFetch],
  )

  const fetchNftAvatars = useCallback(
    async (walletAddress: string) => {
      const response = await apiFetch(
        `/nfts?address=${encodeURIComponent(walletAddress.toLowerCase())}`,
      )
      return Array.isArray(response?.data) ? (response.data as NftAvatarOption[]) : []
    },
    [apiFetch],
  )

  const loadGroups = useCallback(async () => {
    if (!backendAuthed || !address) return
    let response: { data?: unknown } | null = null
    try {
      response = await apiFetch('/groups')
    } catch (err) {
      const message = getErrorMessage(err)
      if (isMissingGroupSchemaError(message)) {
        setGroupsById({})
        return
      }
      throw err
    }
    const rows = Array.isArray(response?.data) ? (response.data as GroupMeta[]) : []
    const mapped: Record<string, GroupMeta> = {}
    rows.forEach((row) => {
      const groupId = normalizeGroupId(row.id)
      if (!groupId) return
      mapped[groupId] = {
        id: groupId,
        name:
          typeof row.name === 'string' && row.name.trim()
            ? row.name.trim()
            : `${GROUP_ID_PREFIX}${groupId.slice(GROUP_ID_PREFIX.length, GROUP_ID_PREFIX.length + 6)}`,
        avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
        created_by: String(row.created_by ?? '').toLowerCase(),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? row.created_at ?? null,
        role: row.role,
        member_count: row.member_count,
      }
    })
    const previousGroups = groupsByIdRef.current
    const visibilityUpdatedAt = new Date().toISOString()
    const removedGroupIds = Object.keys(previousGroups).filter((groupId) => !mapped[groupId])
    const addedGroupIds = Object.keys(mapped).filter((groupId) => !previousGroups[groupId])
    if (removedGroupIds.length > 0 || addedGroupIds.length > 0) {
      const nextVisibilityUpdatedAt = {
        ...peerVisibilityUpdatedAtRef.current,
      }
      removedGroupIds.forEach((groupId) => {
        nextVisibilityUpdatedAt[groupId] = visibilityUpdatedAt
      })
      addedGroupIds.forEach((groupId) => {
        nextVisibilityUpdatedAt[groupId] = visibilityUpdatedAt
      })
      peerVisibilityUpdatedAtRef.current = nextVisibilityUpdatedAt
      setPeerVisibilityUpdatedAt((prev) => ({
        ...prev,
        ...Object.fromEntries(
          [...removedGroupIds, ...addedGroupIds].map((groupId) => [groupId, visibilityUpdatedAt]),
        ),
      }))
    }
    if (removedGroupIds.length > 0) {
      setHiddenPeers((prev) => Array.from(new Set([...prev, ...removedGroupIds])))
      if (removedGroupIds.includes(activePeerRef.current)) {
        setActivePeer('')
        setPeerInput('')
      }
    }
    if (addedGroupIds.length > 0) {
      setHiddenPeers((prev) => prev.filter((peer) => !addedGroupIds.includes(peer)))
    }
    setGroupsById(mapped)
  }, [backendAuthed, address, apiFetch])

  const loadGroupDetails = useCallback(
    async (groupId: string, options?: { applyToProfile?: boolean }) => {
      if (!address) return null
      const normalizedGroupId = normalizeGroupId(groupId)
      if (!normalizedGroupId) return null
      const applyToProfile = options?.applyToProfile ?? true
      const response = await apiFetch(
        `/groups?id=${encodeURIComponent(normalizedGroupId)}`,
      )
      const row = response?.data as Partial<GroupDetails> | null | undefined
      if (!row) return null
      const normalizedMembers = Array.isArray(row.members)
        ? row.members
            .map((member) => {
              const memberAddress = normalizeAddressValue(member?.address)
              if (!memberAddress) return null
              return {
                address: memberAddress,
                role:
                  typeof member.role === 'string' && member.role.trim()
                    ? member.role.trim()
                    : 'member',
                joined_at: member.joined_at ?? null,
              } satisfies GroupMember
            })
            .filter((member): member is GroupMember => Boolean(member))
        : []
      const details: GroupDetails = {
        id: normalizedGroupId,
        name:
          typeof row.name === 'string' && row.name.trim()
            ? row.name.trim()
            : `${GROUP_ID_PREFIX}${normalizedGroupId.slice(
                GROUP_ID_PREFIX.length,
                GROUP_ID_PREFIX.length + 6,
              )}`,
        avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
        created_by: normalizeAddressValue(String(row.created_by ?? '')),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? row.created_at ?? null,
        role: typeof row.role === 'string' ? row.role : 'member',
        member_count:
          typeof row.member_count === 'number'
            ? row.member_count
            : normalizedMembers.length,
        members: normalizedMembers,
      }
      setGroupDetailsById((prev) => ({
        ...prev,
        [normalizedGroupId]: details,
      }))
      setGroupsById((prev) => ({
        ...prev,
        [normalizedGroupId]: {
          id: details.id,
          name: details.name,
          avatar_url: details.avatar_url,
          created_by: details.created_by,
          created_at: details.created_at,
          updated_at: details.updated_at,
          role: details.role,
          member_count: details.member_count,
        },
      }))
      if (applyToProfile) {
        setGroupProfileDetails(details)
        setGroupProfileNameDraft(details.name)
        setGroupProfileAvatarDraft(details.avatar_url ?? null)
      }
      if (details.members.length > 0) {
        void loadProfiles(details.members.map((member) => member.address))
      }
      return details
    },
    [address, apiFetch, loadProfiles],
  )

  useEffect(() => {
    if (!backendAuthed || !address) return
    const groupIds = Object.keys(groupsById)
    if (groupIds.length === 0) return
    let cancelled = false
    const warmGroupMembers = async () => {
      for (const groupId of groupIds) {
        if (cancelled) return
        const cached = groupDetailsById[groupId]
        if (cached && cached.members.length > 0) continue
        if (groupDetailsWarmupRef.current[groupId]) continue
        groupDetailsWarmupRef.current[groupId] = true
        try {
          await loadGroupDetails(groupId, { applyToProfile: false })
        } catch {
          delete groupDetailsWarmupRef.current[groupId]
        }
      }
    }
    void warmGroupMembers()
    return () => {
      cancelled = true
    }
  }, [backendAuthed, address, groupsById, groupDetailsById, loadGroupDetails])

  const formatGroupCreateError = useCallback((error: unknown) => {
    const message = getErrorMessage(error)
    if (isMissingGroupSchemaError(message)) {
      return "Group tables are missing in Supabase. Run the SQL from README for public.groups and public.group_members, then retry."
    }
    return message
  }, [])

  useEffect(() => {
    if (!backendAuthed || !address) return
    let cancelled = false
    const load = async () => {
      try {
        await loadGroups()
      } catch (err) {
        if (cancelled) return
        console.error('Group list load error:', err)
      }
    }
    void load()
    const interval = setInterval(() => {
      void load()
    }, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [backendAuthed, address, loadGroups])

  useEffect(() => {
    const targets = new Set<string>()
    const activePeerLowerValue = activePeer.toLowerCase()
    if (address) targets.add(address.toLowerCase())
    peers.forEach((peer) => {
      const lower = peer.toLowerCase()
      if (isAddress(lower)) targets.add(lower)
    })
    if (activePeerValid && activePeerAddress) targets.add(activePeerLowerValue)
    if (activePeerValid && activePeerGroup) {
      messages.forEach((message) => {
        if (normalizeGroupId(message.to) !== activePeerLowerValue) return
        const fromLower = normalizeAddressValue(message.from)
        if (fromLower) targets.add(fromLower)
      })
      if (
        groupProfileDetails &&
        normalizeGroupId(groupProfileDetails.id) === activePeerLowerValue
      ) {
        groupProfileDetails.members.forEach((member) => {
          const memberAddress = normalizeAddressValue(member.address)
          if (memberAddress) targets.add(memberAddress)
        })
      }
    }
    const list = Array.from(targets).filter((item) => isAddress(item))
    void loadProfiles(list)
  }, [
    peers,
    activePeer,
    activePeerValid,
    activePeerAddress,
    activePeerGroup,
    messages,
    groupProfileDetails,
    address,
    loadProfiles,
  ])

  const unreadCountsByThread = useMemo(() => {
    if (!address) return {}
    const own = address.toLowerCase()
    const active = activePeer.toLowerCase()
    const next: Record<string, number> = {}
    for (const message of messages) {
      const from = message.from.toLowerCase()
      const to = message.to.toLowerCase()
      const isGroupMessage = isGroupId(to)
      if (isGroupMessage) {
        if (from === own) continue
        const isActiveSameThread = to === active && !activeSecret
        if (isActiveSameThread) continue
        const lastRead = lastReadByPeer[to] ?? '1970-01-01'
        if (message.createdAt > lastRead) {
          const key = getThreadKey(to, false)
          next[key] = (next[key] ?? 0) + 1
        }
        continue
      }
      if (to !== own || from === own) continue
      const isSecretMessage = message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
      const isActiveSameThread =
        from === active &&
        ((activeSecret && isSecretMessage) || (!activeSecret && !isSecretMessage))
      if (isActiveSameThread) continue
      const lastRead = lastReadByPeer[from] ?? '1970-01-01'
      if (message.createdAt > lastRead) {
        const key = `${from}:${isSecretMessage ? 'secret' : 'main'}`
        next[key] = (next[key] ?? 0) + 1
      }
    }
    return next
  }, [address, activePeer, activeSecret, lastReadByPeer, messages])

  const threadPreviewByKey = useMemo(() => {
    if (!address) return {} as Record<
      string,
      { createdAt: string; text: string }
    >
    const own = address.toLowerCase()
    const next: Record<string, { createdAt: string; text: string }> = {}
    for (const message of messages) {
      const from = message.from.toLowerCase()
      const to = message.to.toLowerCase()
      const groupMessage = isGroupId(to)
      if (!groupMessage && from !== own && to !== own) continue
      const peerLower = groupMessage ? to : from === own ? to : from
      const isSecretMessage =
        !groupMessage && message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
      const threadKey = getThreadKey(peerLower, isSecretMessage)
      const previewText = summarizeMessageText(message.text) || 'Message'
      const current = next[threadKey]
      if (
        !current ||
        message.createdAt > current.createdAt ||
        (message.createdAt === current.createdAt && previewText !== current.text)
      ) {
        next[threadKey] = {
          createdAt: message.createdAt,
          text: previewText,
        }
      }
    }
    return next
  }, [address, messages])

  const visibleMessages = useMemo(() => {
    if (!address || !activePeerValid) return []
    const own = address.toLowerCase()
    const peer = activePeer.toLowerCase()
    const groupThread = isGroupId(peer)
    return messages
      .filter((message) => {
        const from = message.from.toLowerCase()
        const to = message.to.toLowerCase()
        const pairMatch = groupThread
          ? to === peer
          : (from === own && to === peer) || (from === peer && to === own)
        if (!pairMatch) return false
        if (groupThread) return true
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
      setCustomBios({})
      setGroupsById({})
      setGroupDetailsById({})
      setSecretPassphrases({})
      setSecretPassphraseDraft('')
      setLastReadByPeer({})
      setReadReceiptsByPeer({})
      setReadReceiptTxByPeer({})
      setPinnedByThread({})
      setPinnedUpdatedAtByThread({})
      setSharedPinnedByConversation({})
      setSharedPinnedUpdatedAtByConversation({})
      setReactionLedgerByKey({})
      reactionLedgerByKeyRef.current = {}
      pinnedUpdatedAtByThreadRef.current = {}
      sharedPinnedUpdatedAtByConversationRef.current = {}
      setReplyDraft(null)
      setPinPromptMessage(null)
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
        setCustomBios({})
        setGroupsById({})
        setGroupDetailsById({})
        setHiddenPeers([])
        setPeerVisibilityUpdatedAt({})
        setLastReadByPeer({})
        setReadReceiptsByPeer({})
        setSecretPassphrases({})
        setSecretPassphraseDraft('')
        setPinnedByThread({})
        setPinnedUpdatedAtByThread({})
        setSharedPinnedByConversation({})
        setSharedPinnedUpdatedAtByConversation({})
        regularConversationModeRef.current = 'managed'
        regularConversationSecretsRef.current = {}
        setRegularConversationMode('managed')
        setRegularConversationSecrets({})
        setReactionLedgerByKey({})
        reactionLedgerByKeyRef.current = {}
        pinnedUpdatedAtByThreadRef.current = {}
        sharedPinnedUpdatedAtByConversationRef.current = {}
        return
      }
      const parsed = JSON.parse(raw) as {
        messages?: Message[]
        lastScannedBlock?: string
        profileNames?: Record<string, string | null>
        customNames?: Record<string, string | null>
        customAvatars?: Record<string, string | null>
        customBios?: Record<string, string | null>
        groupsById?: Record<string, GroupMeta>
        hiddenPeers?: string[]
        peerVisibilityUpdatedAt?: Record<string, string>
        hiddenSecretPeers?: string[]
        secretVisibilityUpdatedAt?: Record<string, string>
        secretPassphrases?: Record<string, string>
        lastReadByPeer?: Record<string, string>
        readReceiptsByPeer?: Record<string, string>
        readReceiptTxByPeer?: Record<string, string>
        pinnedByThread?: Record<string, string>
        pinnedUpdatedAtByThread?: Record<string, string>
        sharedPinnedByConversation?: Record<string, string>
        sharedPinnedUpdatedAtByConversation?: Record<string, string>
        reactionLedgerByKey?: Record<string, unknown>
      }
      const normalized =
        parsed.messages?.map((message) => {
          const withPayload = message.payload ? message : { ...message, payload: message.text }
          const parsedText = getMessageContent(withPayload.payload, withPayload.text)
          return {
            ...withPayload,
            text: parsedText.text,
            replyToKey: withPayload.replyToKey ?? parsedText.replyToKey,
          }
        }) ?? []
      setMessages(normalized)
      setLastSyncBlock(parsed.lastScannedBlock ?? null)
      setProfileNames(parsed.profileNames ?? {})
      setCustomNames(parsed.customNames ?? {})
      setCustomAvatars(parsed.customAvatars ?? {})
      setCustomBios(parsed.customBios ?? {})
      const storedGroups = parsed.groupsById ?? {}
      const normalizedGroups = Object.fromEntries(
        Object.entries(storedGroups).flatMap(([groupKey, group]) => {
          const groupId = normalizeGroupId(group?.id ?? groupKey)
          if (!groupId) return []
          const fallbackName = `${GROUP_ID_PREFIX}${groupId.slice(
            GROUP_ID_PREFIX.length,
            GROUP_ID_PREFIX.length + 6,
          )}`
          return [
            [
              groupId,
              {
                id: groupId,
                name:
                  typeof group?.name === 'string' && group.name.trim()
                    ? group.name.trim()
                    : fallbackName,
                avatar_url: typeof group?.avatar_url === 'string' ? group.avatar_url : null,
                created_by: normalizeAddressValue(String(group?.created_by ?? '')),
                created_at: group?.created_at ?? null,
                updated_at: group?.updated_at ?? group?.created_at ?? null,
                role: group?.role ?? 'member',
                member_count:
                  typeof group?.member_count === 'number' ? group.member_count : undefined,
              } satisfies GroupMeta,
            ],
          ]
        }),
      )
      setGroupsById(normalizedGroups)
      setHiddenPeers(parsed.hiddenPeers ?? [])
      setPeerVisibilityUpdatedAt(parsed.peerVisibilityUpdatedAt ?? {})
      setHiddenSecretPeers(parsed.hiddenSecretPeers ?? [])
      setSecretVisibilityUpdatedAt(parsed.secretVisibilityUpdatedAt ?? {})
      setSecretPassphrases(parsed.secretPassphrases ?? {})
      setLastReadByPeer(parsed.lastReadByPeer ?? {})
      setReadReceiptsByPeer(parsed.readReceiptsByPeer ?? {})
      setReadReceiptTxByPeer(
        Object.fromEntries(
          Object.entries(parsed.readReceiptTxByPeer ?? {}).map(([peer, txHash]) => [
            peer,
            normalizeTxHash(txHash) ?? txHash,
          ]),
        ),
      )
      setPinnedByThread(parsed.pinnedByThread ?? {})
      setPinnedUpdatedAtByThread(parsed.pinnedUpdatedAtByThread ?? {})
      setSharedPinnedByConversation(parsed.sharedPinnedByConversation ?? {})
      setSharedPinnedUpdatedAtByConversation(
        parsed.sharedPinnedUpdatedAtByConversation ?? {},
      )
      regularConversationModeRef.current = 'managed'
      regularConversationSecretsRef.current = {}
      setRegularConversationMode('managed')
      setRegularConversationSecrets({})
      const sanitizedReactionLedger = sanitizeReactionLedgerMap(
        parsed.reactionLedgerByKey ?? {},
      )
      reactionLedgerByKeyRef.current = sanitizedReactionLedger
      setReactionLedgerByKey(sanitizedReactionLedger)
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
      setCustomBios({})
      setGroupsById({})
      setGroupDetailsById({})
      setHiddenPeers([])
      setPeerVisibilityUpdatedAt({})
      setHiddenSecretPeers([])
      setSecretVisibilityUpdatedAt({})
      setSecretPassphrases({})
      setSecretPassphraseDraft('')
      setLastReadByPeer({})
      setReadReceiptsByPeer({})
      setReadReceiptTxByPeer({})
      setPinnedByThread({})
      setPinnedUpdatedAtByThread({})
      setSharedPinnedByConversation({})
      setSharedPinnedUpdatedAtByConversation({})
      regularConversationModeRef.current = 'managed'
      regularConversationSecretsRef.current = {}
      setRegularConversationMode('managed')
      setRegularConversationSecrets({})
      setReactionLedgerByKey({})
      reactionLedgerByKeyRef.current = {}
      pinnedUpdatedAtByThreadRef.current = {}
      sharedPinnedUpdatedAtByConversationRef.current = {}
      setReplyDraft(null)
      setPinPromptMessage(null)
    }
  }, [address])

  useEffect(() => {
    if (!address || !activePeerValid || !activePeerAddress) {
      setChatKeySaved('')
      return
    }
    let cancelled = false
    const peerLower = activePeer.toLowerCase()
    if (!activeSecret) {
      const syncRegularKey = async () => {
        if (regularConversationMode === 'legacy' || !backendAuthed) {
          const key = await getSharedConversationPassphrase(address, activePeer)
          if (!cancelled) {
            setChatKeySaved(key)
          }
          return
        }
        const cached = regularConversationSecrets[peerLower]
        if (cached) {
          setChatKeySaved(cached)
          return
        }
        setChatKeySaved('')
        try {
          const loaded = await loadRegularConversationSecrets([peerLower])
          const nextSecret =
            loaded[peerLower] ?? regularConversationSecretsRef.current[peerLower] ?? ''
          if (!cancelled && nextSecret) {
            setChatKeySaved(nextSecret)
            return
          }
        } catch {
          return
        }
        if (!cancelled && regularConversationModeRef.current === 'legacy') {
          const key = await getSharedConversationPassphrase(address, activePeer)
          if (!cancelled) {
            setChatKeySaved(key)
          }
        }
      }
      void syncRegularKey()
      return () => {
        cancelled = true
      }
    }
    setChatKeySaved(secretPassphrases[peerLower] ?? '')
    return () => {
      cancelled = true
    }
  }, [
    address,
    activePeer,
    activePeerValid,
    activePeerAddress,
    activeSecret,
    secretPassphrases,
    backendAuthed,
    regularConversationMode,
    regularConversationSecrets,
    loadRegularConversationSecrets,
  ])

  // Derive and cache CryptoKey when chat key changes
  useEffect(() => {
    if (!chatKeySaved || !address || !activePeerValid || !activePeerAddress) {
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
  }, [chatKeySaved, address, activePeer, activePeerValid, activePeerAddress])

  useEffect(() => {
    if (!address || !activePeerValid || !activePeerAddress || !activeSecret) return
    const own = address.toLowerCase()
    const peer = activePeer.toLowerCase()
    setMessages((prev) => {
      let changed = false
      const next = prev.map((message) => {
        const from = message.from.toLowerCase()
        const to = message.to.toLowerCase()
        const pairMatch =
          (from === own && to === peer) || (from === peer && to === own)
        if (!pairMatch) return message
        if (!message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)) return message
        if (message.text === 'Encrypted message') return message
        changed = true
        return { ...message, text: 'Encrypted message' }
      })
      return changed ? next : prev
    })
  }, [address, activePeer, activePeerValid, activePeerAddress, activeSecret, chatKeySaved])

  // Auto-save key is handled in generation effect
  useEffect(() => {
    if (!address || !activePeerValid || !activePeerAddress) return
  }, [address, activePeer, activePeerValid, activePeerAddress, chatKeySaved])

  useEffect(() => {
    if (!address || !activePeerValid || !activePeerAddress) return
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
      if (activeSecret && !conversationKeyRef.current) return

      if (!activeSecret) {
        const needsManagedKey = needed.some(({ m }) =>
          m.payload.startsWith(ENCRYPTED_V2_PREFIX),
        )
        if (
          needsManagedKey &&
          regularConversationModeRef.current !== 'legacy' &&
          !conversationKeyRef.current
        ) {
          try {
            await loadRegularConversationSecrets([activePeerLower])
          } catch {
            return
          }
          const modeAfterLoad = regularConversationModeRef.current
          if (!conversationKeyRef.current && modeAfterLoad === 'managed') {
            return
          }
        }
      }

      let legacyKey: CryptoKey | null | undefined
      const getLegacyKey = async () => {
        if (legacyKey !== undefined) return legacyKey
        try {
          const secret = await getSharedConversationPassphrase(address, activePeerLower)
          const salt = await getConversationSalt(address, activePeerLower)
          legacyKey = await deriveKey(secret, salt)
          return legacyKey
        } catch {
          legacyKey = null
          return null
        }
      }

      const updates = [...messages]
      let changed = false

      await Promise.all(
        needed.map(async ({ m, index }) => {
          let decrypted: string | null = null
          if (activeSecret) {
            const managedKey = conversationKeyRef.current
            if (!managedKey) return
            decrypted = await decryptSecretPayloadWithKey(m.payload, managedKey)
          } else if (m.payload.startsWith(ENCRYPTED_V2_PREFIX)) {
            const managedKey = conversationKeyRef.current
            if (!managedKey) return
            decrypted = await decryptPayloadWithKey(m.payload, managedKey)
          } else {
            const fallbackKey = await getLegacyKey()
            if (!fallbackKey) return
            decrypted = await decryptPayloadWithKey(m.payload, fallbackKey)
          }
          if (decrypted && decrypted !== m.text) {
            const parsed = parseIncomingMessageText(decrypted)
            updates[index] = {
              ...m,
              text: parsed.text,
              replyToKey: parsed.replyToKey,
            }
            changed = true
          }
        }),
      )

      if (!cancelled && changed) {
        setMessages(updates)
      }
    }

    void decryptFast()
    return () => {
      cancelled = true
    }
  }, [
    address,
    activePeer,
    activePeerValid,
    activePeerAddress,
    activeSecret,
    messages,
    conversationKey,
    loadRegularConversationSecrets,
  ])

  useEffect(() => {
    if (!address) return
    let cancelled = false
    const addressLower = address.toLowerCase()

    const decryptAcrossThreads = async () => {
      const needed = messages
        .map((message) => ({ key: getMessageKey(message), message }))
        .filter(({ message }) => {
          if (message.text !== 'Encrypted message') return false
          return isEncryptedPayload(message.payload)
        })

      if (needed.length === 0) return

      const managedPeers = Array.from(
        new Set(
          needed
            .filter(
              ({ message }) =>
                !message.payload.startsWith(SECRET_ENCRYPTED_PREFIX) &&
                message.payload.startsWith(ENCRYPTED_V2_PREFIX),
            )
            .map(({ message }) => {
              const from = message.from.toLowerCase()
              const to = message.to.toLowerCase()
              return from === addressLower ? to : from
            }),
        ),
      )

      if (
        managedPeers.length > 0 &&
        backendAuthed &&
        regularConversationModeRef.current !== 'legacy'
      ) {
        try {
          await loadRegularConversationSecrets(managedPeers)
        } catch {
          return
        }
      }

      const keyCache = new Map<string, CryptoKey | null>()
      const updates = new Map<string, { text: string; replyToKey?: string }>()

      const resolveKey = async (peerLower: string, payload: string) => {
        const isSecret = payload.startsWith(SECRET_ENCRYPTED_PREFIX)
        const version = isSecret
          ? 'secret'
          : payload.startsWith(ENCRYPTED_V2_PREFIX)
            ? 'managed'
            : 'legacy'
        const threadKey = `${getThreadKey(peerLower, isSecret)}:${version}`
        if (keyCache.has(threadKey)) {
          return keyCache.get(threadKey) ?? null
        }
        const passphrase = isSecret
          ? secretPassphrases[peerLower]?.trim() ?? ''
          : payload.startsWith(ENCRYPTED_V2_PREFIX)
            ? regularConversationSecretsRef.current[peerLower] ?? ''
            : await getSharedConversationPassphrase(addressLower, peerLower)
        if (!passphrase) {
          keyCache.set(threadKey, null)
          return null
        }
        try {
          const salt = await getConversationSalt(addressLower, peerLower)
          const key = await deriveKey(passphrase, salt)
          keyCache.set(threadKey, key)
          return key
        } catch {
          keyCache.set(threadKey, null)
          return null
        }
      }

      await Promise.all(
        needed.map(async ({ key, message }) => {
          const from = message.from.toLowerCase()
          const to = message.to.toLowerCase()
          const peerLower = from === addressLower ? to : from
          const isSecret = message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
          const keyForThread = await resolveKey(peerLower, message.payload)
          if (!keyForThread) return
          const decrypted = isSecret
            ? await decryptSecretPayloadWithKey(message.payload, keyForThread)
            : await decryptPayloadWithKey(message.payload, keyForThread)
          if (!decrypted || decrypted === message.text) return
          const parsed = parseIncomingMessageText(decrypted)
          updates.set(key, {
            text: parsed.text,
            replyToKey: parsed.replyToKey,
          })
        }),
      )

      if (cancelled || updates.size === 0) return
      setMessages((prev) => {
        let changed = false
        const next = prev.map((message) => {
          const decrypted = updates.get(getMessageKey(message))
          if (!decrypted) return message
          if (
            message.text === decrypted.text &&
            message.replyToKey === decrypted.replyToKey
          ) {
            return message
          }
          changed = true
          return {
            ...message,
            text: decrypted.text,
            replyToKey: decrypted.replyToKey ?? message.replyToKey,
          }
        })
        return changed ? next : prev
      })
    }

    void decryptAcrossThreads()
    return () => {
      cancelled = true
    }
  }, [
    address,
    messages,
    secretPassphrases,
    backendAuthed,
    loadRegularConversationSecrets,
  ])

  useEffect(() => {
    if (!address) return
    const key = `abstract-messenger:${address.toLowerCase()}`
    const payload = {
      messages,
      lastScannedBlock: lastSyncBlock ?? lastScannedBlock.current?.toString(),
      profileNames,
      customNames,
      customAvatars,
      customBios,
      groupsById,
      hiddenPeers,
      peerVisibilityUpdatedAt,
      hiddenSecretPeers,
      secretVisibilityUpdatedAt,
      secretPassphrases,
      lastReadByPeer,
      readReceiptsByPeer,
      readReceiptTxByPeer,
      pinnedByThread,
      pinnedUpdatedAtByThread,
      sharedPinnedByConversation,
      sharedPinnedUpdatedAtByConversation,
      reactionLedgerByKey,
    }
    localStorage.setItem(key, JSON.stringify(payload))
  }, [
    address,
    lastSyncBlock,
    messages,
    profileNames,
    customNames,
    customAvatars,
    customBios,
    groupsById,
    hiddenPeers,
    peerVisibilityUpdatedAt,
    hiddenSecretPeers,
    secretVisibilityUpdatedAt,
    secretPassphrases,
    lastReadByPeer,
    readReceiptsByPeer,
    readReceiptTxByPeer,
    pinnedByThread,
    pinnedUpdatedAtByThread,
    sharedPinnedByConversation,
    sharedPinnedUpdatedAtByConversation,
    reactionLedgerByKey,
  ])

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.dataset.theme = theme
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

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

  const applySecretVisibility = useCallback(
    (
      peer: string,
      hidden: boolean,
      updatedAt: string,
      options?: { force?: boolean },
    ) => {
      const peerLower = peer.toLowerCase()
      const current = secretVisibilityUpdatedAtRef.current[peerLower] ?? '1970-01-01'
      if (!options?.force && updatedAt <= current) return
      secretVisibilityUpdatedAtRef.current = {
        ...secretVisibilityUpdatedAtRef.current,
        [peerLower]: updatedAt,
      }
      setSecretVisibilityUpdatedAt((prev) => {
        const existing = prev[peerLower] ?? '1970-01-01'
        if (!options?.force && updatedAt <= existing) return prev
        return { ...prev, [peerLower]: updatedAt }
      })
      setHiddenSecretPeers((prev) => {
        if (hidden) {
          if (prev.includes(peerLower)) return prev
          return [...prev, peerLower]
        }
        if (!prev.includes(peerLower)) return prev
        return prev.filter((p) => p !== peerLower)
      })
      if (hidden && activeSecretRef.current && activePeerRef.current === peerLower) {
        setActiveSecret(false)
      }
    },
    [],
  )

  const applyPinnedSync = useCallback(
    (
      threadKey: string,
      pinnedMessageKey: string | null,
      updatedAt: string,
      options?: { force?: boolean },
    ) => {
      const normalizedUpdatedAt = Number.isNaN(Date.parse(updatedAt))
        ? new Date().toISOString()
        : new Date(updatedAt).toISOString()
      const current = pinnedUpdatedAtByThreadRef.current[threadKey] ?? '1970-01-01'
      if (!options?.force && normalizedUpdatedAt <= current) return
      const nextUpdated = {
        ...pinnedUpdatedAtByThreadRef.current,
        [threadKey]: normalizedUpdatedAt,
      }
      pinnedUpdatedAtByThreadRef.current = nextUpdated
      setPinnedUpdatedAtByThread(nextUpdated)
      setPinnedByThread((prev) => {
        if (pinnedMessageKey) {
          if (prev[threadKey] === pinnedMessageKey) return prev
          return { ...prev, [threadKey]: pinnedMessageKey }
        }
        if (!(threadKey in prev)) return prev
        const next = { ...prev }
        delete next[threadKey]
        return next
      })
    },
    [],
  )

  const applySharedPinnedSync = useCallback(
    (
      conversationKey: string,
      pinnedMessageKey: string | null,
      updatedAt: string,
      options?: { force?: boolean },
    ) => {
      const normalizedUpdatedAt = Number.isNaN(Date.parse(updatedAt))
        ? new Date().toISOString()
        : new Date(updatedAt).toISOString()
      const current =
        sharedPinnedUpdatedAtByConversationRef.current[conversationKey] ?? '1970-01-01'
      if (!options?.force && normalizedUpdatedAt <= current) return
      const nextUpdated = {
        ...sharedPinnedUpdatedAtByConversationRef.current,
        [conversationKey]: normalizedUpdatedAt,
      }
      sharedPinnedUpdatedAtByConversationRef.current = nextUpdated
      setSharedPinnedUpdatedAtByConversation(nextUpdated)
      setSharedPinnedByConversation((prev) => {
        if (pinnedMessageKey) {
          if (prev[conversationKey] === pinnedMessageKey) return prev
          return { ...prev, [conversationKey]: pinnedMessageKey }
        }
        if (!(conversationKey in prev)) return prev
        const next = { ...prev }
        delete next[conversationKey]
        return next
      })
    },
    [],
  )

  const applyReactionSync = useCallback(
    (
      threadKey: string,
      messageKey: string,
      emoji: string,
      userId: string,
      active: boolean,
      updatedAt: unknown,
    ) => {
      const normalizedUserId = normalizeReactionUserId(userId)
      if (!normalizedUserId || !threadKey) return
      const normalizedUpdatedAt = parseReactionUpdatedAt(updatedAt)
      const reactionKey = getReactionUpdatedAtKey(messageKey, emoji, normalizedUserId)
      setReactionLedgerByKey((prev) => {
        const current = prev[reactionKey]
        if (current && normalizedUpdatedAt <= current.updatedAt) return prev
        return {
          ...prev,
          [reactionKey]: {
            threadKey,
            messageKey,
            emoji,
            userId: normalizedUserId,
            active,
            updatedAt: normalizedUpdatedAt,
          },
        }
      })
    },
    [],
  )

  const loadSecretVisibility = useCallback(
    async () => {
      if (!backendAuthed) return
      try {
        const response = await apiFetch(`/secret-visibility?chainId=${abstract.id}`)
        const data = Array.isArray(response?.data) ? response.data : []
        data.forEach((item: { peer_address: string; hidden: boolean; updated_at: string }) => {
          if (!item.peer_address || !item.updated_at) return
          applySecretVisibility(
            item.peer_address,
            Boolean(item.hidden),
            item.updated_at,
            { force: true },
          )
        })
      } catch {
        return
      }
    },
    [applySecretVisibility, backendAuthed, apiFetch],
  )

  useEffect(() => {
    if (!backendAuthed || !address) {
      setSecretPeers({})
      return
    }
    const addressLower = address.toLowerCase()
    loadSecretVisibility()
    loadSecretChats(addressLower)
  }, [address, loadSecretChats, loadSecretVisibility, backendAuthed])

  const ingestMessages = useCallback(
    async (rows: SupabaseMessage[], source?: string) => {
      if (!rows.length || !address) return
      const addressLower = address.toLowerCase()
      for (const row of rows) {
        const from = row.from_address.toLowerCase()
        const to = row.to_address.toLowerCase()
        const peerLower = isGroupId(to) ? to : from === addressLower ? to : from
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

      const managedPeersToWarm = Array.from(
        new Set(
          rows
            .filter((row) => row.text.startsWith(ENCRYPTED_V2_PREFIX))
            .map((row) => {
              const from = row.from_address.toLowerCase()
              const to = row.to_address.toLowerCase()
              if (isGroupId(to)) return ''
              return from === addressLower ? to : from
            }),
        ),
      ).filter((peer) => Boolean(peer) && isAddress(peer))
      if (
        managedPeersToWarm.length > 0 &&
        backendAuthed &&
        regularConversationModeRef.current !== 'legacy'
      ) {
        void loadRegularConversationSecrets(managedPeersToWarm).catch(() => {
          // Keep placeholders if conversation keys are not available yet.
        })
      }

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
            const current =
              secretVisibilityUpdatedAtRef.current[peerLower] ?? '1970-01-01'
            if (m.createdAt > current) {
              setHiddenSecretPeers((prev) =>
                prev.filter((peer) => peer !== peerLower),
              )
              setSecretVisibilityUpdatedAt((prev) => ({
                ...prev,
                [peerLower]: m.createdAt,
              }))
              emitSecretVisibility(peerLower, false, m.createdAt)
            }
            if (backendAuthed) {
              void apiFetch('/secret-chats', {
                method: 'POST',
                body: JSON.stringify({
                  peer: peerLower,
                  chain_id: abstract.id,
                  created_at: m.createdAt,
                }),
              }).catch(() => {})
            }
          }
          if (m.text === 'Encrypted message' && isEncryptedPayload(m.payload)) {
            const peerLower =
              isGroupId(m.to)
                ? m.to.toLowerCase()
                : m.from.toLowerCase() === addressLower
                  ? m.to.toLowerCase()
                  : m.from.toLowerCase()
            if (isGroupId(peerLower)) return m
            const isSecret = m.payload.startsWith(SECRET_ENCRYPTED_PREFIX)
            const passphrase = isSecret
              ? secretPassphrases[peerLower]?.trim() ?? ''
              : m.payload.startsWith(ENCRYPTED_V2_PREFIX)
                ? regularConversationSecretsRef.current[peerLower] ?? ''
                : await getSharedConversationPassphrase(addressLower, peerLower)
            if (passphrase) {
              try {
                const salt = await getConversationSalt(addressLower, peerLower)
                const key = await deriveKey(passphrase, salt)
                const decrypted = isSecret
                  ? await decryptSecretPayloadWithKey(m.payload, key)
                  : await decryptPayloadWithKey(m.payload, key)
                if (decrypted) {
                  const parsed = parseIncomingMessageText(decrypted)
                  m.text = parsed.text
                  m.replyToKey = parsed.replyToKey
                }
              } catch {
                // Keep encrypted placeholder if the key is not ready yet.
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
          const from = row.from_address.toLowerCase()
          const to = row.to_address.toLowerCase()
          const isIncomingForDirect =
            from === activeLower && to === addressLower
          const isIncomingForGroup =
            isGroupId(activeLower) && to === activeLower && from !== addressLower
          if (isIncomingForDirect || isIncomingForGroup) {
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
        const target = row.to_address.toLowerCase()
        const peerKey = isGroupId(target) ? target : sender
        const current = newestBySender[peerKey]
        if (!current || row.created_at > current) {
          newestBySender[peerKey] = row.created_at
        }
      }
      Object.entries(newestBySender).forEach(([peerKey, createdAt]) => {
        applyPeerVisibility(peerKey, false, createdAt)
      })
    },
    [
      address,
      applyPeerVisibility,
      emitSecretVisibility,
      syncLog,
      apiFetch,
      backendAuthed,
      secretPassphrases,
      loadRegularConversationSecrets,
    ],
  )

  const loadOlderMessages = useCallback(async () => {
    if (!backendAuthed || !address || !activePeerValid) return
    const peerLower = activePeer.toLowerCase()
    if (olderMessagesLoadingRef.current[peerLower]) return
    if (olderMessagesExhaustedRef.current[peerLower]) return
    const oldest = oldestMessageByPeerRef.current[peerLower]
    if (!oldest) return
    olderMessagesLoadingRef.current = {
      ...olderMessagesLoadingRef.current,
      [peerLower]: true,
    }
    const el = chatBodyRef.current
    const prevHeight = el?.scrollHeight ?? 0
    try {
      const response = await apiFetch(
        `/messages?peer=${peerLower}&before=${encodeURIComponent(
          oldest,
        )}&chainId=${abstract.id}&limit=${ACTIVE_CHAT_PAGE_SIZE}&order=desc`,
      )
      const data = Array.isArray(response?.data) ? response.data : []
      if (data.length === 0) {
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
  }, [address, activePeer, activePeerValid, ingestMessages, backendAuthed, apiFetch])

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

  useEffect(() => {
    if (!backendAuthed) return
    if (!address) return
    let cancelled = false

    const loadHistory = async () => {
      try {
        const params = new URLSearchParams()
        params.set('chainId', String(abstract.id))
        params.set('limit', String(HISTORY_PAGE_SIZE))
        params.set('order', 'desc')
        const response = await apiFetch(`/messages?${params.toString()}`)
        const data = Array.isArray(response?.data) ? response.data : []
        if (!data.length) return
        await ingestMessages(data as SupabaseMessage[], 'history')
        syncLog('history_loaded', { count: data.length })
      } catch (err) {
        syncLog('history_error', { error: getErrorMessage(err) })
      }
    }

    const pollMessages = async () => {
      if (pollMessagesInFlightRef.current) return
      if (document.visibilityState === 'hidden') return
      pollMessagesInFlightRef.current = true
      try {
        const lastCreated = lastMessageTimestampRef.current
        const params = new URLSearchParams()
        params.set('chainId', String(abstract.id))
        params.set('since', lastCreated)
        params.set('limit', '80')
        const response = await apiFetch(`/messages?${params.toString()}`)
        const data = Array.isArray(response?.data) ? response.data : []
        if (!cancelled && data.length) {
          await ingestMessages(data as SupabaseMessage[], 'poll')
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
  }, [address, ingestMessages, syncLog, backendAuthed, apiFetch])

  useEffect(() => {
    if (!backendAuthed || !address || !activePeerValid) return
    let cancelled = false
    const peerLower = activePeer.toLowerCase()

    const ensureChatBootstrap = async () => {
      if (newestMessageByPeerRef.current[peerLower]) return
      try {
        const params = new URLSearchParams()
        params.set('chainId', String(abstract.id))
        params.set('peer', peerLower)
        params.set('limit', String(ACTIVE_CHAT_PAGE_SIZE))
        params.set('order', 'desc')
        const response = await apiFetch(`/messages?${params.toString()}`)
        const data = Array.isArray(response?.data) ? response.data : []
        if (!data.length || cancelled) return
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
        const params = new URLSearchParams()
        params.set('chainId', String(abstract.id))
        params.set('peer', peerLower)
        params.set('limit', '80')
        const since = newestMessageByPeerRef.current[peerLower]
        if (since) params.set('since', since)
        const response = await apiFetch(`/messages?${params.toString()}`)
        const data = Array.isArray(response?.data) ? response.data : []
        if (!cancelled && data.length) {
          await ingestMessages(data as SupabaseMessage[], 'chat_poll')
        }
      } catch (err) {
        syncLog('chat_poll_error', { error: getErrorMessage(err) })
      } finally {
        pollActiveMessagesInFlightRef.current = false
      }
    }

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
      clearInterval(interval)
      window.removeEventListener('focus', pollActiveMessages)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [address, activePeer, activePeerValid, ingestMessages, syncLog, backendAuthed, apiFetch])

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
            const parsed = getMessageContent(payload)
            const toAddress = tx.to ?? address
            discovered.push({
              id: normalizeTxHash(tx.hash) ?? tx.hash,
              from: tx.from,
              to: toAddress,
              text: parsed.text,
              payload,
              createdAt: timestamp,
              status: 'sent',
              txHash: normalizeTxHash(tx.hash),
              replyToKey: parsed.replyToKey,
            })
            upserts.push({
              tx_hash: normalizeTxHash(tx.hash) ?? tx.hash,
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
        if (backendAuthed && upserts.length) {
          await apiFetch('/messages', {
            method: 'POST',
            body: JSON.stringify({ rows: upserts }),
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
  }, [address, publicClient, peers, activePeerValid, syncLog, apiFetch, backendAuthed])

  useEffect(() => {
    if (!supabase || !backendAuthed || !address) {
      signalsChannelRef.current = null
      return
    }
    const addressLower = address.toLowerCase()
    const token = getBackendToken(addressLower)
    if (token) {
      supabase.realtime.setAuth(token)
    }
    const channel = supabase.channel('chat:signals')
    signalsChannelRef.current = channel
    channel
      .on('broadcast', { event: 'message' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          row?: SupabaseMessage
        }
        if (!data?.from || !data?.to || !data.row) return
        if (data.to.toLowerCase() !== addressLower) return
        if (!data.row.tx_hash || !data.row.from_address || !data.row.to_address) return
        void ingestMessages([data.row], 'broadcast')
      })
      .on('broadcast', { event: 'presence' }, (payload: { payload: unknown }) => {
        const data = payload.payload as { from?: string; to?: string; active?: boolean }
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
      .on('broadcast', { event: 'typing' }, (payload: { payload: unknown }) => {
        const data = payload.payload as { from?: string; to?: string; typing?: boolean }
        if (!data?.from || !data?.to) return
        const fromLower = normalizeAddressValue(data.from)
        const toLower = String(data.to ?? '').trim().toLowerCase()
        if (!fromLower || !toLower || fromLower === addressLower) return
        const isDirectSignal = isAddress(toLower) && toLower === addressLower
        const isGroupSignal = isGroupId(toLower) && Boolean(groupsByIdRef.current[toLower])
        if (!isDirectSignal && !isGroupSignal) return
        const typingKey = isGroupSignal
          ? buildGroupTypingKey(toLower, fromLower)
          : buildDmTypingKey(fromLower)
        if (!typingKey) return
        if (data.typing) {
          setTypingPeers((prev) => ({ ...prev, [typingKey]: true }))
          if (typingTimeoutsRef.current[typingKey]) {
            clearTimeout(typingTimeoutsRef.current[typingKey])
          }
          typingTimeoutsRef.current[typingKey] = setTimeout(() => {
            delete typingTimeoutsRef.current[typingKey]
            setTypingPeers((prev) => {
              if (!prev[typingKey]) return prev
              const next = { ...prev }
              delete next[typingKey]
              return next
            })
          }, 5500)
        } else {
          if (typingTimeoutsRef.current[typingKey]) {
            clearTimeout(typingTimeoutsRef.current[typingKey])
            delete typingTimeoutsRef.current[typingKey]
          }
          setTypingPeers((prev) => {
            if (!prev[typingKey]) return prev
            const next = { ...prev }
            delete next[typingKey]
            return next
          })
        }
      })
      .on('broadcast', { event: 'read' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          readAt?: string
          txHash?: string
        }
        if (!data?.from || !data?.to || !data.readAt) return
        if (data.to.toLowerCase() !== addressLower) return
        const peerLower = data.from.toLowerCase()
        const readAt = data.readAt
        setReadReceiptsByPeer((prev) => {
          const current = prev[peerLower] ?? '1970-01-01'
          if (readAt <= current) return prev
          const next = { ...prev, [peerLower]: readAt }
          readReceiptsByPeerRef.current = next
          return next
        })
        const txHash = normalizeTxHash(data.txHash)
        if (txHash) {
          setReadReceiptTxByPeer((prev) => {
            const currentReadAt = readReceiptsByPeerRef.current[peerLower] ?? '1970-01-01'
            if (readAt < currentReadAt) return prev
            if (prev[peerLower] === txHash && readAt <= currentReadAt) return prev
            return { ...prev, [peerLower]: txHash }
          })
        }
      })
      .on('broadcast', { event: 'thread_read' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          peer?: string
          readAt?: string
        }
        if (!data?.to || !data.peer || !data.readAt) return
        if (data.to.toLowerCase() !== addressLower) return
        const peerLower = String(data.peer).toLowerCase()
        const readAt = data.readAt
        setLastReadByPeer((prev) => {
          const current = prev[peerLower] ?? '1970-01-01'
          if (readAt <= current) return prev
          return { ...prev, [peerLower]: readAt }
        })
      })
      .on('broadcast', { event: 'group_membership' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          groupId?: string
          hidden?: boolean
          updatedAt?: string
        }
        if (!data?.to || !data?.groupId) return
        if (data.to.toLowerCase() !== addressLower) return
        const groupId = normalizeGroupId(data.groupId)
        if (!groupId) return
        const updatedAt = data.updatedAt ?? new Date().toISOString()
        const hidden = data.hidden !== false
        if (hidden) {
          setGroupsById((prev) => {
            if (!prev[groupId]) return prev
            const next = { ...prev }
            delete next[groupId]
            return next
          })
        }
        applyPeerVisibility(groupId, hidden, updatedAt, { force: true })
      })
      .on('broadcast', { event: 'reaction' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          threadKey?: string
          messageKey?: string
          emoji?: string
          active?: boolean
          updatedAt?: number
        }
        if (!data?.from || !data?.to || !data.threadKey || !data.messageKey || !data.emoji) return
        if (data.to.toLowerCase() !== addressLower) return
        applyReactionSync(
          String(data.threadKey),
          String(data.messageKey),
          String(data.emoji),
          data.from,
          Boolean(data.active),
          data.updatedAt,
        )
      })
      .on('broadcast', { event: 'reaction_snapshot' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          threadKey?: string
          items?: Array<{
            messageKey?: string
            emoji?: string
            active?: boolean
            updatedAt?: number
          }>
        }
        if (!data?.from || !data?.to || !data.threadKey || !Array.isArray(data.items)) return
        if (data.to.toLowerCase() !== addressLower) return
        const from = data.from
        data.items.forEach((item) => {
          if (!item?.messageKey || !item?.emoji) return
          applyReactionSync(
            String(data.threadKey),
            String(item.messageKey),
            String(item.emoji),
            from,
            Boolean(item.active),
            item.updatedAt,
          )
        })
      })
      .on('broadcast', { event: 'pinned' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          threadKey?: string
          pinnedMessageKey?: string | null
          updatedAt?: string
        }
        if (!data?.from || !data?.to || !data.threadKey) return
        if (data.to.toLowerCase() !== addressLower) return
        applyPinnedSync(
          data.threadKey,
          data.pinnedMessageKey ?? null,
          data.updatedAt ?? new Date().toISOString(),
        )
      })
      .on('broadcast', { event: 'pinned_snapshot' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          pins?: Record<string, string | null>
          updatedAtByThread?: Record<string, string>
        }
        if (!data?.from || !data?.to || !data.pins || !data.updatedAtByThread) return
        if (data.to.toLowerCase() !== addressLower) return
        Object.entries(data.updatedAtByThread).forEach(([threadKey, updatedAt]) => {
          applyPinnedSync(
            threadKey,
            data.pins?.[threadKey] ?? null,
            updatedAt,
          )
        })
      })
      .on('broadcast', { event: 'shared_pinned' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          conversationKey?: string
          pinnedMessageKey?: string | null
          updatedAt?: string
        }
        if (!data?.from || !data?.to || !data.conversationKey) return
        if (data.to.toLowerCase() !== addressLower) return
        applySharedPinnedSync(
          data.conversationKey,
          data.pinnedMessageKey ?? null,
          data.updatedAt ?? new Date().toISOString(),
        )
      })
      .on('broadcast', { event: 'shared_pinned_snapshot' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          pins?: Record<string, string | null>
          updatedAtByConversation?: Record<string, string>
        }
        if (!data?.from || !data?.to || !data.pins || !data.updatedAtByConversation) return
        if (data.to.toLowerCase() !== addressLower) return
        Object.entries(data.updatedAtByConversation).forEach(
          ([conversationKey, updatedAt]) => {
            applySharedPinnedSync(
              conversationKey,
              data.pins?.[conversationKey] ?? null,
              updatedAt,
            )
          },
        )
      })
      .on('broadcast', { event: 'profile' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          displayName?: string | null
          avatarUrl?: string | null
          bio?: string | null
        }
        if (!data?.from || !data?.to) return
        if (data.to.toLowerCase() !== addressLower) return
        const key = data.from.toLowerCase()
        if (data.displayName !== undefined) {
          setCustomNames((prev) => ({ ...prev, [key]: data.displayName ?? null }))
        }
        if (data.avatarUrl !== undefined) {
          setCustomAvatars((prev) => ({ ...prev, [key]: data.avatarUrl ?? null }))
        }
        if (data.bio !== undefined) {
          setCustomBios((prev) => ({ ...prev, [key]: data.bio ?? null }))
        }
      })
      .on('broadcast', { event: 'peer_visibility' }, (payload: { payload: unknown }) => {
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
      .on('broadcast', { event: 'secret_visibility' }, (payload: { payload: unknown }) => {
        const data = payload.payload as {
          from?: string
          to?: string
          peer?: string
          hidden?: boolean
          updatedAt?: string
        }
        if (!data?.from || !data?.to || !data.peer) return
        if (data.to.toLowerCase() !== addressLower) return
        applySecretVisibility(
          data.peer,
          Boolean(data.hidden),
          data.updatedAt ?? new Date().toISOString(),
          { force: true },
        )
      })
      .subscribe()
    return () => {
      channel.unsubscribe()
      signalsChannelRef.current = null
    }
  }, [
    address,
    backendAuthed,
    getBackendToken,
    ingestMessages,
    applyPeerVisibility,
    applySecretVisibility,
    applyPinnedSync,
    applySharedPinnedSync,
    applyReactionSync,
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineTick(Date.now())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const emitPresence = useCallback((active: boolean) => {
    if (!signalsChannelRef.current || !address || !activePeerValid || activePeerGroup) return
    void signalsChannelRef.current.send({
      type: 'broadcast',
      event: 'presence',
      payload: {
        from: address.toLowerCase(),
        to: activePeer.toLowerCase(),
        active,
      },
    })
  }, [address, activePeerValid, activePeer, activePeerGroup])

  const emitTyping = (typing: boolean) => {
    if (!signalsChannelRef.current || !address || !activePeerValid) return
    const now = Date.now()
    if (typing && now - lastTypingSentRef.current < 1500) return
    if (typing) lastTypingSentRef.current = now
    const target = activePeer.toLowerCase()
    if (!target) return
    void signalsChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        from: address.toLowerCase(),
        to: target,
        typing,
      },
    })
  }

  const emitProfileSync = useCallback(
    (displayName: string | null, avatarUrl: string | null, bio: string | null) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      void signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'profile',
        payload: {
          from: addressLower,
          to: addressLower,
          displayName,
          avatarUrl,
          bio,
        },
      })
    },
    [address],
  )

  const emitPeerVisibility = useCallback(
    (peer: string, hidden: boolean, updatedAt: string) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      void signalsChannelRef.current.send({
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

  const emitThreadReadSync = useCallback(
    (peer: string, readAt: string) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      void signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'thread_read',
        payload: {
          from: addressLower,
          to: addressLower,
          peer,
          readAt,
        },
      })
    },
    [address],
  )

  const emitGroupMembershipChange = useCallback(
    (targetAddress: string, groupId: string, hidden: boolean, updatedAt: string) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      const normalizedTarget = normalizeAddressValue(targetAddress)
      const normalizedGroupId = normalizeGroupId(groupId)
      if (!normalizedTarget || !normalizedGroupId) return
      void signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'group_membership',
        payload: {
          from: addressLower,
          to: normalizedTarget,
          groupId: normalizedGroupId,
          hidden,
          updatedAt,
        },
      })
    },
    [address],
  )

  const emitMessageSync = useCallback(
    (message: {
      txHash: string
      from: string
      to: string
      payload: string
      createdAt: string
    }) => {
      if (!signalsChannelRef.current || !address || !activePeerValid) return
      const from = address.toLowerCase()
      const peer = activePeer.toLowerCase()
      const row = {
        tx_hash: message.txHash,
        from_address: message.from.toLowerCase(),
        to_address: message.to.toLowerCase(),
        text: message.payload,
        created_at: message.createdAt,
        chain_id: abstract.id,
      }
      const sendTo = (to: string) =>
        signalsChannelRef.current?.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            from,
            to,
            row,
          },
        })
      if (!isGroupId(peer)) {
        void sendTo(peer)
      }
      if (peer !== from) {
        void sendTo(from)
      }
    },
    [address, activePeer, activePeerValid],
  )

  const emitReaction = useCallback(
    (
      threadKey: string,
      messageKey: string,
      emoji: string,
      active: boolean,
      updatedAt: number,
    ) => {
      if (!signalsChannelRef.current || !address || !activePeerValid) return
      const from = address.toLowerCase()
      const peer = activePeer.toLowerCase()
      const sendTo = (to: string) =>
        signalsChannelRef.current?.send({
          type: 'broadcast',
          event: 'reaction',
          payload: {
            from,
            to,
            threadKey,
            messageKey,
            emoji,
            active,
            updatedAt,
          },
        })
      void sendTo(peer)
      if (peer !== from) {
        void sendTo(from)
      }
    },
    [address, activePeer, activePeerValid],
  )

  const emitReactionSnapshot = useCallback(
    (threadKey: string) => {
      if (!signalsChannelRef.current || !address || !activePeerValid || !threadKey) return
      const from = address.toLowerCase()
      const peer = activePeer.toLowerCase()
      const items = Object.values(reactionLedgerByKeyRef.current)
        .filter((entry) => entry.threadKey === threadKey && entry.userId === from)
        .map((entry) => ({
          messageKey: entry.messageKey,
          emoji: entry.emoji,
          active: entry.active,
          updatedAt: entry.updatedAt,
        }))
      const sendTo = (to: string) =>
        signalsChannelRef.current?.send({
          type: 'broadcast',
          event: 'reaction_snapshot',
          payload: {
            from,
            to,
            threadKey,
            items,
          },
        })
      void sendTo(peer)
      if (peer !== from) {
        void sendTo(from)
      }
    },
    [address, activePeer, activePeerValid],
  )

  const emitPinnedSync = useCallback(
    (threadKey: string, pinnedMessageKey: string | null, updatedAt: string) => {
      if (!signalsChannelRef.current || !address) return
      const addressLower = address.toLowerCase()
      void signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'pinned',
        payload: {
          from: addressLower,
          to: addressLower,
          threadKey,
          pinnedMessageKey,
          updatedAt,
        },
      })
    },
    [address],
  )

  const emitSharedPinnedSync = useCallback(
    (conversationKey: string, pinnedMessageKey: string | null, updatedAt: string) => {
      if (!signalsChannelRef.current || !address || !activePeerValid) return
      const addressLower = address.toLowerCase()
      const peerLower = activePeer.toLowerCase()
      const sendTo = (to: string) =>
        signalsChannelRef.current?.send({
          type: 'broadcast',
          event: 'shared_pinned',
          payload: {
            from: addressLower,
            to,
            conversationKey,
            pinnedMessageKey,
            updatedAt,
          },
        })
      void sendTo(addressLower)
      void sendTo(peerLower)
    },
    [address, activePeer, activePeerValid],
  )

  const emitPinnedSnapshot = useCallback(() => {
    if (!signalsChannelRef.current || !address) return
    const addressLower = address.toLowerCase()
    void signalsChannelRef.current.send({
      type: 'broadcast',
      event: 'pinned_snapshot',
      payload: {
        from: addressLower,
        to: addressLower,
        pins: pinnedByThread,
        updatedAtByThread: pinnedUpdatedAtByThreadRef.current,
      },
    })
  }, [address, pinnedByThread])

  const emitSharedPinnedSnapshot = useCallback(
    (conversationKey: string) => {
      if (!signalsChannelRef.current || !address || !activePeerValid || !conversationKey) return
      const addressLower = address.toLowerCase()
      const peerLower = activePeer.toLowerCase()
      const pins: Record<string, string | null> = {
        [conversationKey]: sharedPinnedByConversation[conversationKey] ?? null,
      }
      const updatedAtByConversation: Record<string, string> = {
        [conversationKey]:
          sharedPinnedUpdatedAtByConversationRef.current[conversationKey] ??
          new Date(0).toISOString(),
      }
      const sendTo = (to: string) =>
        signalsChannelRef.current?.send({
          type: 'broadcast',
          event: 'shared_pinned_snapshot',
          payload: {
            from: addressLower,
            to,
            pins,
            updatedAtByConversation,
          },
        })
      void sendTo(addressLower)
      void sendTo(peerLower)
    },
    [address, activePeer, activePeerValid, sharedPinnedByConversation],
  )

  useEffect(() => {
    if (!address || !activePeerValid || activePeerGroup) return
    emitPresence(true)
    const interval = setInterval(() => {
      emitPresence(true)
    }, 4000)
    return () => {
      clearInterval(interval)
      emitPresence(false)
    }
  }, [emitPresence, address, activePeerValid, activePeerGroup])

  useEffect(() => {
    if (!address) return
    const sync = () => emitPinnedSnapshot()
    sync()
    const interval = setInterval(sync, 10000)
    const handleFocus = () => sync()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [address, emitPinnedSnapshot, pinnedByThread, pinnedUpdatedAtByThread])

  useEffect(() => {
    if (!address || !activePeerValid) return
    const peerLower = activePeer.toLowerCase()
    const incoming = visibleMessages.filter((message) => {
      if (activePeerGroup) return message.from.toLowerCase() !== address.toLowerCase()
      return message.from.toLowerCase() === peerLower
    })
    if (incoming.length === 0) return
    const latestMessage = incoming[incoming.length - 1]
    const latest = latestMessage.createdAt
    const currentRead = lastReadByPeer[peerLower] ?? '1970-01-01'
    if (latest <= currentRead) return
    setLastReadByPeer((prev) => {
      const current = prev[peerLower] ?? '1970-01-01'
      if (latest <= current) return prev
      return { ...prev, [peerLower]: latest }
    })
    emitThreadReadSync(peerLower, latest)
    if (signalsChannelRef.current && !activePeerGroup) {
      void signalsChannelRef.current.send({
        type: 'broadcast',
        event: 'read',
        payload: {
          from: address.toLowerCase(),
          to: peerLower,
          readAt: latest,
          txHash: normalizeTxHash(latestMessage.txHash),
        },
      })
    }
  }, [
    address,
    activePeerValid,
    activePeer,
    activePeerGroup,
    visibleMessages,
    lastReadByPeer,
    emitThreadReadSync,
  ])

  const displayNames = useMemo(() => {
    const merged = { ...profileNames }
    Object.entries(customNames).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        merged[key] = value.trim()
      }
    })
    Object.entries(groupsById).forEach(([groupId, group]) => {
      if (group?.name?.trim()) {
        merged[groupId] = group.name.trim()
      }
    })
    return merged
  }, [profileNames, customNames, groupsById])

  const displayAvatars = useMemo<Record<string, string | null>>(() => {
    const merged = { ...customAvatars }
    Object.entries(groupsById).forEach(([groupId, group]) => {
      merged[groupId] = group.avatar_url ?? null
    })
    return merged
  }, [customAvatars, groupsById])

  const activeTypingParticipants = useMemo(() => {
    if (!activePeerValid || !addressLower) return [] as string[]
    const activePeerLowerValue = activePeer.toLowerCase()
    if (!activePeerLowerValue) return [] as string[]
    if (activePeerGroup) {
      const prefix = `${TYPING_GROUP_PREFIX}${activePeerLowerValue}:`
      const addresses = new Set<string>()
      Object.entries(typingPeers).forEach(([key, typing]) => {
        if (!typing || !key.startsWith(prefix)) return
        const sender = normalizeAddressValue(key.slice(prefix.length))
        if (!sender || sender === addressLower) return
        addresses.add(sender)
      })
      return Array.from(addresses)
    }
    const dmKey = buildDmTypingKey(activePeerLowerValue)
    if (!typingPeers[dmKey]) return [] as string[]
    return [activePeerLowerValue]
  }, [activePeerValid, activePeerGroup, activePeer, addressLower, typingPeers])

  const activeTypingLabel = useMemo(() => {
    if (activeTypingParticipants.length === 0) return ''
    if (!activePeerGroup) return t.typing
    const names = activeTypingParticipants
      .map((item) => displayNames[item]?.trim() || shorten(item))
      .filter(Boolean)
    if (names.length === 0) return t.typing
    if (names.length === 1) return `${names[0]} typing…`
    if (names.length === 2) return `${names[0]}, ${names[1]} typing…`
    return `${names[0]} +${names.length - 1} typing…`
  }, [activeTypingParticipants, activePeerGroup, t.typing, displayNames])

  const selectedGroupMemberAddresses = useMemo(
    () => new Set(groupCreateMembers.map((member) => member.address.toLowerCase())),
    [groupCreateMembers],
  )

  const visibleGroupMemberSearchResults = useMemo(() => {
    const query = groupCreateMemberQuery.trim().toLowerCase()
    if (!groupCreateOpen || !query || query.length < 2) {
      return [] as UserSearchResult[]
    }
    const ownAddress = address?.toLowerCase() ?? ''
    const merged: UserSearchResult[] = []
    const seen = new Set<string>()
    const push = (item: UserSearchResult) => {
      const key = item.address.toLowerCase()
      if (!isAddress(key)) return
      if (key === ownAddress) return
      if (selectedGroupMemberAddresses.has(key)) return
      if (seen.has(key)) return
      seen.add(key)
      merged.push({
        address: key,
        name: item.name?.trim() || shorten(key),
        avatarUrl: item.avatarUrl ?? null,
      })
    }

    peers.forEach((peerLower) => {
      if (!isAddress(peerLower)) return
      const label = displayNames[peerLower]?.trim() || ''
      if (!label || !label.toLowerCase().includes(query)) return
      push({
        address: peerLower,
        name: label,
        avatarUrl: displayAvatars[peerLower] ?? null,
      })
    })

    groupCreateMemberSearchResults.forEach((item) => {
      if (!item.name.trim().toLowerCase().includes(query)) return
      push(item)
    })

    return merged
  }, [
    groupCreateMemberQuery,
    groupCreateOpen,
    groupCreateMemberSearchResults,
    peers,
    displayNames,
    displayAvatars,
    selectedGroupMemberAddresses,
    address,
  ])

  const groupProfileMemberAddresses = useMemo(
    () =>
      new Set(
        (groupProfileDetails?.members ?? []).map((member) => member.address.toLowerCase()),
      ),
    [groupProfileDetails],
  )

  const groupProfileMemberQueryTrimmed = groupProfileMemberQuery.trim()
  const typedGroupProfileMemberAddress = normalizeAddressValue(groupProfileMemberQueryTrimmed)
  const canAddTypedGroupProfileMember = Boolean(
    groupProfileDetails &&
      (String(groupProfileDetails.role ?? '').toLowerCase() === 'owner' ||
        String(groupProfileDetails.role ?? '').toLowerCase() === 'admin') &&
      typedGroupProfileMemberAddress &&
      typedGroupProfileMemberAddress !== addressLower &&
      !groupProfileMemberAddresses.has(typedGroupProfileMemberAddress),
  )

  const visibleGroupProfileMemberSearchResults = useMemo(() => {
    const query = groupProfileMemberQuery.trim().toLowerCase()
    if (!groupProfileOpen || !groupProfileAddMoreOpen || !query || query.length < 2) {
      return [] as UserSearchResult[]
    }
    const ownAddress = address?.toLowerCase() ?? ''
    const merged: UserSearchResult[] = []
    const seen = new Set<string>()
    const push = (item: UserSearchResult) => {
      const key = item.address.toLowerCase()
      if (!isAddress(key)) return
      if (key === ownAddress) return
      if (groupProfileMemberAddresses.has(key)) return
      if (seen.has(key)) return
      seen.add(key)
      merged.push({
        address: key,
        name: item.name?.trim() || shorten(key),
        avatarUrl: item.avatarUrl ?? null,
      })
    }

    peers.forEach((peerLower) => {
      if (!isAddress(peerLower)) return
      const label = displayNames[peerLower]?.trim() || ''
      if (!label || !label.toLowerCase().includes(query)) return
      push({
        address: peerLower,
        name: label,
        avatarUrl: displayAvatars[peerLower] ?? null,
      })
    })

    groupProfileMemberSearchResults.forEach((item) => {
      if (!item.name.trim().toLowerCase().includes(query)) return
      push(item)
    })

    return merged
  }, [
    groupProfileMemberQuery,
    groupProfileOpen,
    groupProfileAddMoreOpen,
    groupProfileMemberAddresses,
    groupProfileMemberSearchResults,
    peers,
    displayNames,
    displayAvatars,
    address,
  ])

  const typedPeerSearchResult = useMemo(() => {
    if (!peerInputTrimmed || !peerInputValid || peerInputIsGroup || !peerInputAddress) {
      return null
    }
    const peerLower = peerInputAddress
    const knownResult =
      peerSearchResults.find((item) => item.address.toLowerCase() === peerLower) ?? null
    return {
      address: peerLower,
      name:
        knownResult?.name?.trim() ||
        displayNames[peerLower]?.trim() ||
        shorten(peerLower),
      avatarUrl: knownResult?.avatarUrl ?? displayAvatars[peerLower] ?? null,
    } satisfies UserSearchResult
  }, [
    peerInputTrimmed,
    peerInputValid,
    peerInputIsGroup,
    peerInputAddress,
    peerSearchResults,
    displayNames,
    displayAvatars,
  ])

  const visiblePeerSearchResults = useMemo(() => {
    if (!peerInputTrimmed) return [] as UserSearchResult[]
    const query = peerInputTrimmed.toLowerCase()
    const merged: UserSearchResult[] = []
    const seen = new Set<string>()
    const push = (item: UserSearchResult) => {
      const key = item.address.toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      merged.push({
        address: key,
        name: item.name?.trim() || shorten(key),
        avatarUrl: item.avatarUrl ?? null,
      })
    }

    if (typedPeerSearchResult) {
      push(typedPeerSearchResult)
      return merged
    }

    peers.forEach((peerLower) => {
      const label = displayNames[peerLower]?.trim()
      if (!label || !label.toLowerCase().includes(query)) return
      push({
        address: peerLower,
        name: label,
        avatarUrl: displayAvatars[peerLower] ?? null,
      })
    })
    peerSearchResults.forEach((item) => {
      if (!item.name.trim().toLowerCase().includes(query)) return
      push(item)
    })
    return merged
  }, [
    peerInputTrimmed,
    typedPeerSearchResult,
    peers,
    displayNames,
    displayAvatars,
    peerSearchResults,
  ])

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

  const exactNicknameMatch = useMemo(() => {
    if (!peerInputTrimmed || peerInputValid) return null
    const query = peerInputTrimmed.toLowerCase()
    for (const peerLower of peers) {
      const label = displayNames[peerLower]?.trim()
      if (label && label.toLowerCase() === query) {
        return {
          address: peerLower,
          name: label,
          avatarUrl: displayAvatars[peerLower] ?? null,
        } satisfies UserSearchResult
      }
    }
    return (
      visiblePeerSearchResults.find((item) => item.name.trim().toLowerCase() === query) ?? null
    )
  }, [peerInputTrimmed, peerInputValid, peers, displayNames, displayAvatars, visiblePeerSearchResults])

  const resolvedPeerInputAddress = peerInputValid
    ? peerInputIsGroup
      ? normalizeGroupId(peerInputTrimmed)
      : peerInputAddress
    : exactNicknameMatch?.address ?? ''

  const openPeerChat = useCallback(
    (peerAddress: string, profile?: Partial<UserSearchResult>) => {
      const peer = peerAddress.toLowerCase()
      const updatedAt = new Date().toISOString()
      const nextName =
        typeof profile?.name === 'string' && profile.name.trim() ? profile.name.trim() : null
      if (nextName) {
        profileNameCache.set(peer, { value: nextName, ts: Date.now() })
        setProfileNames((prev) => ({ ...prev, [peer]: nextName }))
      }
      setActivePeer(peer)
      setPeerInput('')
      setPeerSearchResults([])
      setActiveSecret(false)
      setSecretPassphraseDraft('')
      applyPeerVisibility(peer, false, updatedAt)
      setLastReadByPeer((prev) => ({ ...prev, [peer]: new Date().toISOString() }))
      setError(null)
      emitPeerVisibility(peer, false, updatedAt)
    },
    [applyPeerVisibility, emitPeerVisibility],
  )

  const handleSetPeer = () => {
    if (!resolvedPeerInputAddress) {
      setError(t.searchInvalid)
      return
    }
    openPeerChat(resolvedPeerInputAddress, exactNicknameMatch ?? undefined)
  }

  const buildGroupMemberFromAddress = useCallback(
    (rawAddress: string) => {
      const normalized = normalizeAddressValue(rawAddress)
      if (!normalized) return null
      return {
        address: normalized,
        name: displayNames[normalized]?.trim() || shorten(normalized),
        avatarUrl: displayAvatars[normalized] ?? null,
      } satisfies UserSearchResult
    },
    [displayNames, displayAvatars],
  )

  const addGroupMember = useCallback(
    (item: UserSearchResult | null) => {
      if (!item) return
      const normalized = normalizeAddressValue(item.address)
      if (!normalized || (address && normalized === address.toLowerCase())) return
      setGroupCreateMembers((prev) => {
        if (prev.some((member) => member.address.toLowerCase() === normalized)) {
          return prev
        }
        return [
          ...prev,
          {
            address: normalized,
            name: item.name?.trim() || shorten(normalized),
            avatarUrl: item.avatarUrl ?? null,
          },
        ]
      })
      setGroupCreateMemberQuery('')
      setGroupCreateMemberSearchResults([])
      setGroupCreateError(null)
    },
    [address],
  )

  const handleRemoveGroupMember = (memberAddress: string) => {
    const normalized = normalizeAddressValue(memberAddress)
    if (!normalized) return
    setGroupCreateMembers((prev) =>
      prev.filter((member) => member.address.toLowerCase() !== normalized),
    )
  }

  const handleGroupMemberQueryKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== 'Enter' && event.key !== ',') return
    const query = groupCreateMemberQuery.trim()
    if (!query) return
    event.preventDefault()
    const normalizedQuery = query.toLowerCase()
    const exactSearchMatch =
      visibleGroupMemberSearchResults.find(
        (item) =>
          item.name.trim().toLowerCase() === normalizedQuery ||
          item.address.toLowerCase() === normalizedQuery,
      ) ?? null
    if (exactSearchMatch) {
      addGroupMember(exactSearchMatch)
      return
    }
    addGroupMember(buildGroupMemberFromAddress(query))
  }

  const handleGroupAvatarUploadClick = () => {
    groupCreateAvatarInputRef.current?.click()
  }

  const handleGroupAvatarFileChange = async (
    event: ReactChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.currentTarget.value = ''
    if (!file.type.startsWith('image/')) {
      setGroupCreateError('Select an image file (png, jpg, webp, gif).')
      return
    }
    if (file.size > MAX_GROUP_AVATAR_FILE_SIZE) {
      setGroupCreateError('Image is too large. Use file up to 7 MB.')
      return
    }
    setGroupCreateAvatarProcessing(true)
    setGroupCreateError(null)
    try {
      const dataUrl = await toGroupAvatarDataUrl(file)
      if (dataUrl.length > MAX_GROUP_AVATAR_DATA_URL_LENGTH) {
        setGroupCreateError('Image is still too large after processing. Try a smaller image.')
        return
      }
      setGroupCreateAvatarDraft(dataUrl)
    } catch (err) {
      setGroupCreateError(getErrorMessage(err))
    } finally {
      setGroupCreateAvatarProcessing(false)
    }
  }

  const closeGroupProfile = useCallback(() => {
    setGroupProfileOpen(false)
    setGroupProfileLoading(false)
    setGroupProfileSaving(false)
    setGroupProfileError(null)
    setGroupProfileEditing(false)
    setGroupProfileAvatarProcessing(false)
    setGroupProfileAddMoreOpen(false)
    setGroupProfileMemberQuery('')
    setGroupProfileMemberSearchResults([])
    setGroupProfileMemberSearchLoading(false)
    if (groupProfileAvatarInputRef.current) {
      groupProfileAvatarInputRef.current.value = ''
    }
  }, [])

  const handleOpenGroupProfile = useCallback(
    async (groupId: string) => {
      const normalizedGroupId = normalizeGroupId(groupId)
      if (!normalizedGroupId) return
      const cachedDetails = groupDetailsById[normalizedGroupId] ?? null
      const groupMeta = groupsById[normalizedGroupId] ?? null
      const immediateDetails =
        cachedDetails ??
        (groupMeta
          ? ({
              ...groupMeta,
              members: [],
            } satisfies GroupDetails)
          : null)
      setGroupProfileOpen(true)
      setGroupProfileError(null)
      if (immediateDetails) {
        setGroupProfileDetails(immediateDetails)
        setGroupProfileNameDraft(immediateDetails.name)
        setGroupProfileAvatarDraft(immediateDetails.avatar_url ?? null)
      }
      const immediateHasMembers =
        (immediateDetails?.members.length ?? 0) > 0 ||
        (immediateDetails?.member_count ?? 0) === 0
      setGroupProfileLoading(!immediateDetails || !immediateHasMembers)
      setGroupProfileEditing(false)
      setGroupProfileAddMoreOpen(false)
      setGroupProfileMemberQuery('')
      setGroupProfileMemberSearchResults([])
      try {
        let details: GroupDetails | null = null
        try {
          details = await loadGroupDetails(normalizedGroupId)
        } catch (firstError) {
          // Mobile reload often races backend auth; retry once before surfacing an error.
          const firstMessage = getErrorMessage(firstError).toLowerCase()
          const shouldRetry =
            firstMessage.includes('auth failed') ||
            firstMessage.includes('request failed') ||
            firstMessage.includes('network')
          if (!shouldRetry) throw firstError
          await new Promise((resolve) => setTimeout(resolve, 350))
          details = await loadGroupDetails(normalizedGroupId)
        }
        if (!details) {
          if (!immediateDetails) {
            throw new Error('Group not found')
          }
          return
        }
      } catch (err) {
        if (!immediateDetails) {
          setGroupProfileError(formatGroupCreateError(err))
        }
      } finally {
        setGroupProfileLoading(false)
      }
    },
    [groupDetailsById, groupsById, loadGroupDetails, formatGroupCreateError],
  )

  const handleAddGroupProfileMember = useCallback(
    async (item: UserSearchResult | null) => {
      const groupRole = String(groupProfileDetails?.role ?? '').toLowerCase()
      const canEditGroup = groupRole === 'owner' || groupRole === 'admin'
      if (!item || !groupProfileDetails || !canEditGroup || !groupProfileEditing) return
      const memberAddress = normalizeAddressValue(item.address)
      const groupId = normalizeGroupId(groupProfileDetails.id)
      if (
        !memberAddress ||
        !groupId ||
        memberAddress === addressLower ||
        groupProfileMemberAddresses.has(memberAddress)
      ) {
        return
      }
      setGroupProfileSaving(true)
      setGroupProfileError(null)
      try {
        await apiFetch(`/groups?id=${encodeURIComponent(groupId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            addMembers: [memberAddress],
          }),
        })
        const nextMember: GroupMember = {
          address: memberAddress,
          role: 'member',
          joined_at: new Date().toISOString(),
        }
        setGroupProfileDetails((prev) => {
          if (!prev) return prev
          if (prev.members.some((member) => member.address === memberAddress)) return prev
          const members = [...prev.members, nextMember]
          return {
            ...prev,
            members,
            member_count: members.length,
            updated_at: nextMember.joined_at,
          }
        })
        setGroupsById((prev) => {
          const current = prev[groupId]
          return {
            ...prev,
            [groupId]: {
              id: groupId,
              name: current?.name ?? groupProfileDetails.name,
              avatar_url: current?.avatar_url ?? groupProfileDetails.avatar_url,
              created_by: current?.created_by ?? groupProfileDetails.created_by,
              created_at: current?.created_at ?? groupProfileDetails.created_at,
              updated_at: nextMember.joined_at,
              role: current?.role ?? groupProfileDetails.role,
              member_count: (current?.member_count ?? groupProfileDetails.member_count ?? 0) + 1,
            },
          }
        })
        setGroupProfileMemberQuery('')
        setGroupProfileMemberSearchResults([])
        setGroupProfileAddMoreOpen(false)
      } catch (err) {
        setGroupProfileError(formatGroupCreateError(err))
      } finally {
        setGroupProfileSaving(false)
      }
    },
    [
      groupProfileDetails,
      groupProfileEditing,
      groupProfileMemberAddresses,
      apiFetch,
      formatGroupCreateError,
    ],
  )

  const handleGroupProfileAvatarUploadClick = () => {
    groupProfileAvatarInputRef.current?.click()
  }

  const handleLeaveGroup = useCallback(async () => {
    if (!groupProfileDetails) return
    const groupId = normalizeGroupId(groupProfileDetails.id)
    if (!groupId) return
    const confirmed = window.confirm('Leave this group?')
    if (!confirmed) return
    const updatedAt = new Date().toISOString()
    setGroupProfileSaving(true)
    setGroupProfileError(null)
    try {
      await apiFetch(`/groups?id=${encodeURIComponent(groupId)}`, {
        method: 'DELETE',
      })
      setGroupsById((prev) => {
        if (!prev[groupId]) return prev
        const next = { ...prev }
        delete next[groupId]
        return next
      })
      applyPeerVisibility(groupId, true, updatedAt, { force: true })
      emitPeerVisibility(groupId, true, updatedAt)
      closeGroupProfile()
      setGroupProfileDetails(null)
      setGroupProfileNameDraft('')
      setGroupProfileAvatarDraft(null)
    } catch (err) {
      setGroupProfileError(formatGroupCreateError(err))
    } finally {
      setGroupProfileSaving(false)
    }
  }, [
    groupProfileDetails,
    apiFetch,
    applyPeerVisibility,
    emitPeerVisibility,
    closeGroupProfile,
    formatGroupCreateError,
  ])

  const handleUpdateGroupMemberRole = useCallback(
    async (memberAddress: string, nextRole: 'admin' | 'member') => {
      if (!groupProfileDetails || !groupProfileEditing) return
      const groupId = normalizeGroupId(groupProfileDetails.id)
      const currentRole = String(groupProfileDetails.role ?? '').toLowerCase()
      const targetAddress = normalizeAddressValue(memberAddress)
      if (!groupId || !targetAddress || currentRole !== 'owner') return
      setGroupProfileSaving(true)
      setGroupProfileError(null)
      try {
        await apiFetch(`/groups?id=${encodeURIComponent(groupId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            memberAddress: targetAddress,
            memberRole: nextRole,
          }),
        })
        await loadGroupDetails(groupId)
      } catch (err) {
        setGroupProfileError(formatGroupCreateError(err))
      } finally {
        setGroupProfileSaving(false)
      }
    },
    [
      groupProfileDetails,
      groupProfileEditing,
      apiFetch,
      loadGroupDetails,
      formatGroupCreateError,
    ],
  )

  const handleKickGroupMember = useCallback(
    async (memberAddress: string, memberName: string) => {
      if (!groupProfileDetails || !groupProfileEditing) return
      const groupId = normalizeGroupId(groupProfileDetails.id)
      const currentRole = String(groupProfileDetails.role ?? '').toLowerCase()
      const targetAddress = normalizeAddressValue(memberAddress)
      if (!groupId || !targetAddress || currentRole !== 'owner') return
      const confirmed = window.confirm(`Remove ${memberName} from the group?`)
      if (!confirmed) return
      const updatedAt = new Date().toISOString()
      setGroupProfileSaving(true)
      setGroupProfileError(null)
      try {
        await apiFetch(`/groups?id=${encodeURIComponent(groupId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            removeMember: targetAddress,
          }),
        })
        emitGroupMembershipChange(targetAddress, groupId, true, updatedAt)
        await loadGroupDetails(groupId)
      } catch (err) {
        setGroupProfileError(formatGroupCreateError(err))
      } finally {
        setGroupProfileSaving(false)
      }
    },
    [
      groupProfileDetails,
      groupProfileEditing,
      apiFetch,
      emitGroupMembershipChange,
      loadGroupDetails,
      formatGroupCreateError,
    ],
  )

  const handleGroupProfileAvatarFileChange = async (
    event: ReactChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.currentTarget.value = ''
    if (!file.type.startsWith('image/')) {
      setGroupProfileError('Select an image file (png, jpg, webp, gif).')
      return
    }
    if (file.size > MAX_GROUP_AVATAR_FILE_SIZE) {
      setGroupProfileError('Image is too large. Use file up to 7 MB.')
      return
    }
    setGroupProfileAvatarProcessing(true)
    setGroupProfileError(null)
    try {
      const dataUrl = await toGroupAvatarDataUrl(file)
      if (dataUrl.length > MAX_GROUP_AVATAR_DATA_URL_LENGTH) {
        setGroupProfileError(
          'Image is still too large after processing. Try a smaller image.',
        )
        return
      }
      setGroupProfileAvatarDraft(dataUrl)
    } catch (err) {
      setGroupProfileError(getErrorMessage(err))
    } finally {
      setGroupProfileAvatarProcessing(false)
    }
  }

  const handleGroupProfileSave = useCallback(async () => {
    if (!groupProfileDetails) return false
    const groupId = normalizeGroupId(groupProfileDetails.id)
    const groupRole = String(groupProfileDetails.role ?? '').toLowerCase()
    if (!groupId) return false
    if (groupRole !== 'owner' && groupRole !== 'admin') {
      setGroupProfileError('Only group admins can edit group profile.')
      return false
    }
    if (groupProfileAvatarProcessing) return false
    const nextName = groupProfileNameDraft.trim()
    if (!nextName) {
      setGroupProfileError('Enter group name')
      return false
    }
    if (nextName.length > 64) {
      setGroupProfileError('Group name is too long')
      return false
    }
    const currentAvatar = groupProfileDetails.avatar_url ?? null
    const nextAvatar = groupProfileAvatarDraft ?? null
    const changed =
      nextName !== groupProfileDetails.name || nextAvatar !== currentAvatar
    if (!changed) {
      return true
    }
    setGroupProfileSaving(true)
    setGroupProfileError(null)
    try {
      const response = await apiFetch(
        `/groups?id=${encodeURIComponent(groupId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: nextName,
            avatarUrl: nextAvatar,
          }),
        },
      )
      const updated = response?.data as Partial<GroupMeta> | null | undefined
      const normalizedName =
        typeof updated?.name === 'string' && updated.name.trim()
          ? updated.name.trim()
          : nextName
      const normalizedAvatar =
        typeof updated?.avatar_url === 'string' ? updated.avatar_url : nextAvatar
      const updatedAt =
        updated?.updated_at ?? groupProfileDetails.updated_at ?? new Date().toISOString()
      const createdAt = updated?.created_at ?? groupProfileDetails.created_at ?? null
      const memberCount =
        typeof updated?.member_count === 'number'
          ? updated.member_count
          : groupProfileDetails.member_count
      setGroupProfileDetails((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          name: normalizedName,
          avatar_url: normalizedAvatar,
          updated_at: updatedAt,
          created_at: createdAt,
          member_count: memberCount,
        }
      })
      setGroupProfileNameDraft(normalizedName)
      setGroupProfileAvatarDraft(normalizedAvatar)
      setGroupsById((prev) => ({
        ...prev,
        [groupId]: {
          id: groupId,
          name: normalizedName,
          avatar_url: normalizedAvatar,
          created_by: groupProfileDetails.created_by,
          created_at: createdAt,
          updated_at: updatedAt,
          role: groupProfileDetails.role,
          member_count: memberCount,
        },
      }))
      return true
    } catch (err) {
      setGroupProfileError(formatGroupCreateError(err))
      return false
    } finally {
      setGroupProfileSaving(false)
    }
  }, [
    groupProfileDetails,
    groupProfileAvatarProcessing,
    groupProfileNameDraft,
    groupProfileAvatarDraft,
    apiFetch,
    formatGroupCreateError,
  ])

  useEffect(() => {
    const groupRole = String(groupProfileDetails?.role ?? '').toLowerCase()
    const canEditGroup = groupRole === 'owner' || groupRole === 'admin'
    if (
      !groupProfileOpen ||
      !groupProfileEditing ||
      !canEditGroup ||
      !groupProfileDetails ||
      groupProfileLoading ||
      groupProfileSaving ||
      groupProfileAvatarProcessing
    ) {
      return
    }
    const nextName = groupProfileNameDraft.trim()
    if (!nextName || nextName === groupProfileDetails.name) return
    const timer = window.setTimeout(() => {
      void handleGroupProfileSave()
    }, 550)
    return () => window.clearTimeout(timer)
  }, [
    groupProfileOpen,
    groupProfileEditing,
    groupProfileDetails,
    groupProfileLoading,
    groupProfileSaving,
    groupProfileAvatarProcessing,
    groupProfileNameDraft,
    handleGroupProfileSave,
  ])

  useEffect(() => {
    const groupRole = String(groupProfileDetails?.role ?? '').toLowerCase()
    const canEditGroup = groupRole === 'owner' || groupRole === 'admin'
    if (
      !groupProfileOpen ||
      !groupProfileEditing ||
      !canEditGroup ||
      !groupProfileDetails ||
      groupProfileLoading ||
      groupProfileSaving ||
      groupProfileAvatarProcessing
    ) {
      return
    }
    const currentAvatar = groupProfileDetails.avatar_url ?? null
    const nextAvatar = groupProfileAvatarDraft ?? null
    if (nextAvatar === currentAvatar) return
    void handleGroupProfileSave()
  }, [
    groupProfileOpen,
    groupProfileEditing,
    groupProfileDetails,
    groupProfileLoading,
    groupProfileSaving,
    groupProfileAvatarProcessing,
    groupProfileAvatarDraft,
    handleGroupProfileSave,
  ])

  const handleToggleGroupProfileEditing = useCallback(async () => {
    const groupRole = String(groupProfileDetails?.role ?? '').toLowerCase()
    const canEditGroup = groupRole === 'owner' || groupRole === 'admin'
    if (!groupProfileDetails || !canEditGroup) {
      closeGroupProfile()
      return
    }
    if (groupProfileSaving || groupProfileAvatarProcessing) return
    if (groupProfileEditing) {
      const saved = await handleGroupProfileSave()
      if (!saved) return
      setGroupProfileEditing(false)
      setGroupProfileAddMoreOpen(false)
      setGroupProfileMemberQuery('')
      setGroupProfileMemberSearchResults([])
      setGroupProfileError(null)
      return
    }
    setGroupProfileEditing(true)
    setGroupProfileError(null)
  }, [
    groupProfileDetails,
    groupProfileSaving,
    groupProfileAvatarProcessing,
    groupProfileEditing,
    handleGroupProfileSave,
    closeGroupProfile,
  ])

  const handleOpenCreateGroup = () => {
    setGroupCreateNameDraft('')
    setGroupCreateMemberQuery('')
    setGroupCreateMembers([])
    setGroupCreateMemberSearchResults([])
    setGroupCreateMemberSearchLoading(false)
    setGroupCreateAvatarDraft(null)
    setGroupCreateAvatarProcessing(false)
    setGroupCreateError(null)
    if (groupCreateAvatarInputRef.current) {
      groupCreateAvatarInputRef.current.value = ''
    }
    setGroupCreateOpen(true)
  }

  const handleCreateGroup = async () => {
    if (!connected || !address) {
      setGroupCreateError('Connect wallet first')
      return
    }
    const name = groupCreateNameDraft.trim()
    if (!name) {
      setGroupCreateError('Enter group name')
      return
    }
    if (name.length > 64) {
      setGroupCreateError('Group name is too long')
      return
    }
    const members = Array.from(
      new Set(
        groupCreateMembers
          .map((member) => normalizeAddressValue(member.address))
          .filter(Boolean)
          .filter((member) => member !== address.toLowerCase()),
      ),
    )
    if (members.length === 0) {
      setGroupCreateError('Add at least one member')
      return
    }
    if (groupCreateAvatarProcessing) return
    setGroupCreateLoading(true)
    setGroupCreateError(null)
    try {
      if (!backendAuthed) {
        await ensureBackendAuth()
      }
      const response = await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          members,
          avatarUrl: groupCreateAvatarDraft,
        }),
      })
      const created = response?.data as GroupMeta | undefined
      const groupId = normalizeGroupId(created?.id)
      if (!groupId) {
        throw new Error('Failed to create group')
      }
      setGroupsById((prev) => ({
        ...prev,
        [groupId]: {
          id: groupId,
          name:
            typeof created?.name === 'string' && created.name.trim()
              ? created.name.trim()
              : name,
          avatar_url:
            typeof created?.avatar_url === 'string'
              ? created.avatar_url
              : groupCreateAvatarDraft,
          created_by: String(created?.created_by ?? address).toLowerCase(),
          created_at: created?.created_at ?? new Date().toISOString(),
          updated_at: created?.updated_at ?? new Date().toISOString(),
          role: created?.role ?? 'owner',
          member_count: created?.member_count ?? members.length + 1,
        },
      }))
      openPeerChat(groupId, {
        name:
          typeof created?.name === 'string' && created.name.trim()
            ? created.name.trim()
            : name,
      })
      setGroupCreateOpen(false)
    } catch (err) {
      setGroupCreateError(formatGroupCreateError(err))
    } finally {
      setGroupCreateLoading(false)
    }
  }

  const handleSelectPeer = (peer: string, secret?: boolean) => {
    const peerLower = peer.toLowerCase()
    const updatedAt = new Date().toISOString()
    const groupPeer = isGroupId(peerLower)
    if (groupPeer && !groupsByIdRef.current[peerLower]) {
      applyPeerVisibility(peerLower, true, updatedAt, { force: true })
      emitPeerVisibility(peerLower, true, updatedAt)
      setError('You are no longer a member of this group')
      return
    }
    setActivePeer(peerLower)
    setPeerInput('')
    setPeerSearchResults([])
    setActiveSecret(groupPeer ? false : Boolean(secret))
    setSecretPassphraseDraft(
      !groupPeer && secret ? secretPassphrases[peerLower] ?? '' : '',
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
    const prevSaved = secretPassphrases[peerLower] ?? ''
    const passphraseChanged = next !== prevSaved
    if (activeSecret && address && passphraseChanged) {
      setConversationKey(null)
      const own = address.toLowerCase()
      setMessages((prev) => {
        let changed = false
        const nextMessages = prev.map((message) => {
          const from = message.from.toLowerCase()
          const to = message.to.toLowerCase()
          const pairMatch =
            (from === own && to === peerLower) || (from === peerLower && to === own)
          if (!pairMatch) return message
          if (!message.payload.startsWith(SECRET_ENCRYPTED_PREFIX)) return message
          if (message.text === 'Encrypted message') return message
          changed = true
          return { ...message, text: 'Encrypted message' }
        })
        return changed ? nextMessages : prev
      })
    }
    setSecretPassphrases((prev) => {
      if (!next) {
        const updated = { ...prev }
        delete updated[peerLower]
        return updated
      }
      return { ...prev, [peerLower]: next }
    })
    setSecretPassphraseDraft(next)
    if (activeSecret) {
      setChatKeySaved(next)
      if (!next) setConversationKey(null)
    }
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
    // Check if there is already a pending message
    if (sending) return
    emitTyping(false)

    const replyKeyForMessage = getGifSrc(text) ? null : replyDraft?.key ?? null
    const outgoingText = buildOutgoingMessageText(text, replyKeyForMessage)
    const addressLower = address.toLowerCase()
    const peerLower = activePeer.toLowerCase()
    const groupPeer = isGroupId(peerLower)
    if (groupPeer && !groupsByIdRef.current[peerLower]) {
      const updatedAt = new Date().toISOString()
      applyPeerVisibility(peerLower, true, updatedAt, { force: true })
      emitPeerVisibility(peerLower, true, updatedAt)
      setError('You are no longer a member of this group')
      if (!overrideText) {
        setMessageText('')
      }
      return
    }

    if (!abstractClient) {
      setError('AGW client is not ready yet')
      return
    }

    let payload: string | null = null
    try {
      if (groupPeer) {
        payload = outgoingText
      } else if (activeSecret) {
        const key = chatKeySaved.trim()
        if (!key) {
          setError('Set a shared password for this secret chat')
          return
        }
        if (conversationKey) {
          const iv = crypto.getRandomValues(new Uint8Array(12))
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            conversationKey,
            encoder.encode(outgoingText),
          )
          payload = `${SECRET_ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(
            new Uint8Array(encrypted),
          )}`
        } else {
          payload = await encryptSecretPayload(outgoingText, key, address, activePeer)
        }
      } else {
        const cachedManagedSecret = regularConversationSecretsRef.current[peerLower] ?? ''
        const activeConversationKey = conversationKeyRef.current
        const canUseActiveManagedKey =
          regularConversationModeRef.current !== 'legacy' &&
          Boolean(cachedManagedSecret) &&
          Boolean(activeConversationKey) &&
          activePeerRef.current === peerLower &&
          !activeSecretRef.current &&
          chatKeySaved.trim() === cachedManagedSecret

        if (canUseActiveManagedKey && activeConversationKey) {
          payload = await encryptPayloadV2WithKey(outgoingText, activeConversationKey)
        } else {
          const regularConversation = await ensureRegularConversationMaterial(peerLower)
          if (
            activePeerRef.current === peerLower &&
            !activeSecretRef.current &&
            chatKeySaved.trim() !== regularConversation.secret
          ) {
            setChatKeySaved(regularConversation.secret)
            setConversationKey(regularConversation.key)
          }
          if (regularConversation.mode === 'managed') {
            payload = await encryptPayloadV2WithKey(
              outgoingText,
              regularConversation.key,
            )
          } else if (regularConversation.secret) {
            payload = await encryptPayload(
              outgoingText,
              regularConversation.secret,
              address,
              activePeer,
            )
          } else {
            payload = outgoingText
          }
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
      replyToKey: replyKeyForMessage ?? undefined,
    }
    syncLog('send_start', { to: peerLower, createdAt })
    setMessages((prev) => [...prev, pending])
    if (!overrideText) {
      setMessageText('')
    }
    setReplyDraft(null)
    setSending(true)
    setError(null)

    try {
      let hash
      const sessionData = localStorage.getItem(`session:${addressLower}`)
      if (!groupPeer && sessionEnabled && sessionData) {
        try {
          const { privateKey, session } =
            parseWithBigInt<StoredSessionData>(sessionData)
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
      const sendWithWallet = async () =>
        abstractClient.sendTransaction({
          to: address as `0x${string}`,
          data: toHex(payload),
          value: 0n,
        })
      if (!hash) {
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

      const normalizedHash = normalizeTxHash(String(hash)) ?? String(hash)

      setMessages((prev) =>
        prev.map((message) =>
          message.id === pending.id
            ? { ...message, status: 'sent', txHash: normalizedHash }
            : message,
        ),
      )
      emitMessageSync({
        txHash: normalizedHash,
        from: addressLower,
        to: peerLower,
        payload,
        createdAt,
      })
      try {
        if (!backendAuthed) {
          await ensureBackendAuth()
        }
        await apiFetch('/messages', {
          method: 'POST',
          body: JSON.stringify({
            tx_hash: normalizedHash,
            from_address: addressLower,
            to_address: peerLower,
            text: payload,
            created_at: createdAt,
            chain_id: abstract.id,
          }),
        })
        syncLog('send_upsert', { txHash: normalizedHash, createdAt })
      } catch (upsertError) {
        syncLog('send_upsert_error', {
          txHash: normalizedHash,
          error: getErrorMessage(upsertError),
        })
      }
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

  const handleOpenTransfer = () => {
    if (!activePeerAddress) return
    setTransferError(null)
    setTransferAmountDraft('')
    setTransferOpen(true)
  }

  const persistTransferMessage = async (txHash: string, amount: string) => {
    if (!address || !activePeerValid || !activePeerAddress) return
    const createdAt = new Date().toISOString()
    const payload = buildTransferMessageText(amount)
    const from = address.toLowerCase()
    const to = activePeer.toLowerCase()
    const transferMessage: Message = {
      id: normalizeTxHash(txHash) ?? txHash,
      from: address,
      to: activePeer,
      text: payload,
      payload,
      createdAt,
      status: 'sent',
      txHash: normalizeTxHash(txHash) ?? txHash,
    }
    setMessages((prev) => mergeMessages(prev, [transferMessage]))
    emitMessageSync({
      txHash: transferMessage.txHash ?? txHash,
      from,
      to,
      payload,
      createdAt,
    })
    try {
      if (!backendAuthed) {
        await ensureBackendAuth()
      }
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({
          tx_hash: transferMessage.txHash,
          from_address: from,
          to_address: to,
          text: payload,
          created_at: createdAt,
          chain_id: abstract.id,
        }),
      })
    } catch (err) {
      console.error('Transfer message sync error:', err)
      setError(t.transferSyncError)
    }
  }

  const handleSendTransfer = async () => {
    if (!abstractClient || !activePeerValid || !activePeerAddress) return
    const cleanedAmount = transferAmountDraft.replace(',', '.').trim()
    if (!cleanedAmount) {
      setTransferError('Enter an amount')
      return
    }
    let value: bigint
    try {
      value = parseEther(cleanedAmount)
    } catch {
      setTransferError('Enter a valid ETH amount')
      return
    }
    if (value <= 0n) {
      setTransferError('Amount must be greater than 0')
      return
    }
    setTransferSubmitting(true)
    setTransferError(null)
    try {
      const hash = await abstractClient.sendTransaction({
        to: activePeer as Address,
        value,
      })
      await persistTransferMessage(String(hash), cleanedAmount)
      setTransferOpen(false)
      setTransferAmountDraft('')
    } catch (err) {
      const message = getErrorMessage(err)
      if (message.toLowerCase().includes('insufficient funds')) {
        setTransferError('Insufficient ETH balance in your AGW wallet')
      } else if (
        message.toLowerCase().includes('rejected') ||
        message.toLowerCase().includes('denied')
      ) {
        setTransferError('Transfer was cancelled')
      } else {
        setTransferError(message)
      }
    } finally {
      setTransferSubmitting(false)
    }
  }

  const handleSendGif = (file: (typeof GIF_FILES)[number]) => {
    setReplyDraft(null)
    sendMessage(`${GIF_PREFIX}${file}`)
    setEmojiOpen(false)
  }

  const handleReplyMessage = useCallback((message: Message) => {
    setReplyDraft({
      key: getMessageKey(message),
      from: message.from,
      text: summarizeMessageText(message.text),
    })
  }, [])

  const scrollToMessageKey = useCallback((messageKey: string) => {
    const body = chatBodyRef.current
    if (!body) return
    const el = body.querySelector<HTMLElement>(`[data-message-key="${messageKey}"]`)
    if (!el) return
    const bodyRect = body.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const targetTop =
      elRect.top - bodyRect.top + body.scrollTop - body.clientHeight * 0.35
    const maxScrollTop = Math.max(0, body.scrollHeight - body.clientHeight)
    const nextTop = Math.max(0, Math.min(targetTop, maxScrollTop))
    body.scrollTo({ top: nextTop, behavior: 'smooth' })
  }, [])

  const jumpToMessage = useCallback((messageKey: string) => {
    scrollToMessageKey(messageKey)
    setHighlightedMessageKey(messageKey)
  }, [scrollToMessageKey])

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

  const signerAddressLower = signerAddress ? signerAddress.toLowerCase() : ''
  const groupCreateMemberQueryTrimmed = groupCreateMemberQuery.trim()
  const typedGroupMemberAddress = normalizeAddressValue(groupCreateMemberQueryTrimmed)
  const canAddTypedGroupMember = Boolean(
    typedGroupMemberAddress &&
      typedGroupMemberAddress !== addressLower &&
      !selectedGroupMemberAddresses.has(typedGroupMemberAddress),
  )
  const currentUserReactionId = normalizeReactionUserId(addressLower) ?? ''
  const activePeerLower = activePeerValid ? activePeer.toLowerCase() : ''
  const activeThreadKey = activePeerValid
    ? getThreadKey(activePeerLower, activePeerGroup ? false : activeSecret)
    : ''
  const activeConversationKey =
    addressLower && activePeerValid && activePeerAddress
      ? getConversationKey(addressLower, activePeerLower, activeSecret)
      : ''
  const reactionsByMessage = useMemo(
    () => buildReactionsByMessage(reactionLedgerByKey),
    [reactionLedgerByKey],
  )
  const localPinnedMessageKey = activeThreadKey ? pinnedByThread[activeThreadKey] ?? null : null
  const sharedPinnedMessageKey = activeConversationKey
    ? sharedPinnedByConversation[activeConversationKey] ?? null
    : null
  const pinnedMessageKey = sharedPinnedMessageKey ?? localPinnedMessageKey
  const visibleMessagesByKey = useMemo(() => {
    const map = new Map<string, Message>()
    visibleMessages.forEach((message) => {
      map.set(getMessageKey(message), message)
    })
    return map
  }, [visibleMessages])
  const pinnedMessage = pinnedMessageKey ? visibleMessagesByKey.get(pinnedMessageKey) ?? null : null
  const contextMessage = contextMenu ? visibleMessagesByKey.get(contextMenu.messageKey) ?? null : null

  useEffect(() => {
    if (!activeThreadKey || !currentUserReactionId || !activePeerValid) return
    const sync = () => emitReactionSnapshot(activeThreadKey)
    sync()
    const interval = setInterval(sync, 8000)
    const handleFocus = () => sync()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [
    activeThreadKey,
    currentUserReactionId,
    activePeerValid,
    emitReactionSnapshot,
    reactionLedgerByKey,
  ])

  useEffect(() => {
    if (!activeConversationKey || !activePeerValid) return
    const sync = () => emitSharedPinnedSnapshot(activeConversationKey)
    sync()
    const interval = setInterval(sync, 10000)
    const handleFocus = () => sync()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [
    activeConversationKey,
    activePeerValid,
    emitSharedPinnedSnapshot,
    sharedPinnedByConversation,
  ])

  const handlePinMessage = useCallback((message: Message) => {
    const key = getMessageKey(message)
    if (pinnedMessageKey === key) {
      setPinPromptMessage(null)
      return
    }
    setPinPromptMessage(message)
  }, [pinnedMessageKey])

  const handleConfirmPin = useCallback(
    (scope: 'self' | 'all') => {
      if (!pinPromptMessage) return
      const key = getMessageKey(pinPromptMessage)
      const updatedAt = new Date().toISOString()
      if (scope === 'all' && activeConversationKey) {
        applySharedPinnedSync(activeConversationKey, key, updatedAt, { force: true })
        emitSharedPinnedSync(activeConversationKey, key, updatedAt)
        if (activeThreadKey) {
          applyPinnedSync(activeThreadKey, null, updatedAt, { force: true })
          emitPinnedSync(activeThreadKey, null, updatedAt)
        }
      } else if (activeThreadKey) {
        applyPinnedSync(activeThreadKey, key, updatedAt, { force: true })
        emitPinnedSync(activeThreadKey, key, updatedAt)
      }
      setPinPromptMessage(null)
      setContextMenu(null)
    },
    [
      pinPromptMessage,
      activeConversationKey,
      activeThreadKey,
      applySharedPinnedSync,
      emitSharedPinnedSync,
      applyPinnedSync,
      emitPinnedSync,
    ],
  )

  const clearPinnedForActiveThread = useCallback(() => {
    const updatedAt = new Date().toISOString()
    if (sharedPinnedMessageKey && activeConversationKey) {
      applySharedPinnedSync(activeConversationKey, null, updatedAt, { force: true })
      emitSharedPinnedSync(activeConversationKey, null, updatedAt)
      return
    }
    if (!activeThreadKey) return
    applyPinnedSync(activeThreadKey, null, updatedAt, { force: true })
    emitPinnedSync(activeThreadKey, null, updatedAt)
  }, [
    sharedPinnedMessageKey,
    activeConversationKey,
    activeThreadKey,
    applySharedPinnedSync,
    emitSharedPinnedSync,
    applyPinnedSync,
    emitPinnedSync,
  ])

  const handleToggleReaction = useCallback(
    (message: Message, emoji: string) => {
      if (!currentUserReactionId || !activeThreadKey) return
      const messageKey = getMessageKey(message)
      const updatedAt = Date.now()
      const reactionKey = getReactionUpdatedAtKey(messageKey, emoji, currentUserReactionId)
      const currentEntry = reactionLedgerByKeyRef.current[reactionKey]
      const active = !currentEntry?.active
      applyReactionSync(
        activeThreadKey,
        messageKey,
        emoji,
        currentUserReactionId,
        active,
        updatedAt,
      )
      emitReaction(activeThreadKey, messageKey, emoji, active, updatedAt)
      setContextMenu(null)
    },
    [currentUserReactionId, activeThreadKey, applyReactionSync, emitReaction],
  )

  const handleOpenContextMenuAt = useCallback((x: number, y: number, message: Message) => {
    const width = 280
    const height = 220
    const nextX = Math.max(12, Math.min(x, window.innerWidth - width - 12))
    const nextY = Math.max(12, Math.min(y, window.innerHeight - height - 12))
    setContextMenu({
      x: nextX,
      y: nextY,
      messageKey: getMessageKey(message),
    })
  }, [])

  const handleOpenContextMenu = useCallback((event: MouseEvent, message: Message) => {
    event.preventDefault()
    handleOpenContextMenuAt(event.clientX, event.clientY, message)
  }, [handleOpenContextMenuAt])

  const handleRemoveFailedMessage = useCallback((message: Message) => {
    const messageKey = getMessageKey(message)
    setMessages((prev) =>
      prev.filter((entry) => getMessageKey(entry) !== messageKey),
    )
    setContextMenu((current) =>
      current?.messageKey === messageKey ? null : current,
    )
  }, [])

  const getReplyLabel = useCallback(
    (replyKey: string) => {
      const message = visibleMessagesByKey.get(replyKey)
      if (!message) return null
      const senderLower = message.from.toLowerCase()
      const sender =
        addressLower && senderLower === addressLower
          ? t.you
          : displayNames[senderLower] || shorten(message.from)
      return `${sender}: ${summarizeMessageText(message.text)}`
    },
    [visibleMessagesByKey, addressLower, t.you, displayNames],
  )
  const pinnedLabel = pinnedMessageKey ? getReplyLabel(pinnedMessageKey) : null

  useEffect(() => {
    const missingLocalPinned =
      Boolean(activeThreadKey) &&
      localPinnedMessageKey !== null &&
      !visibleMessagesByKey.has(localPinnedMessageKey)
    if (missingLocalPinned && activeThreadKey) {
      setPinnedByThread((prev) => {
        const next = { ...prev }
        delete next[activeThreadKey]
        return next
      })
      setPinnedUpdatedAtByThread((prev) => {
        if (!(activeThreadKey in prev)) return prev
        const next = { ...prev }
        delete next[activeThreadKey]
        pinnedUpdatedAtByThreadRef.current = next
        return next
      })
    }
    const missingSharedPinned =
      Boolean(activeConversationKey) &&
      sharedPinnedMessageKey !== null &&
      !visibleMessagesByKey.has(sharedPinnedMessageKey)
    if (missingSharedPinned && activeConversationKey) {
      setSharedPinnedByConversation((prev) => {
        const next = { ...prev }
        delete next[activeConversationKey]
        return next
      })
      setSharedPinnedUpdatedAtByConversation((prev) => {
        if (!(activeConversationKey in prev)) return prev
        const next = { ...prev }
        delete next[activeConversationKey]
        sharedPinnedUpdatedAtByConversationRef.current = next
        return next
      })
    }
  }, [
    activeThreadKey,
    activeConversationKey,
    localPinnedMessageKey,
    sharedPinnedMessageKey,
    visibleMessagesByKey,
  ])

  useEffect(() => {
    if (!replyDraft) return
    if (!visibleMessagesByKey.has(replyDraft.key)) {
      setReplyDraft(null)
    }
  }, [replyDraft, visibleMessagesByKey])

  useEffect(() => {
    if (!highlightedMessageKey) return
    const timeout = setTimeout(() => {
      setHighlightedMessageKey((current) =>
        current === highlightedMessageKey ? null : current,
      )
    }, 1800)
    return () => clearTimeout(timeout)
  }, [highlightedMessageKey])

  useEffect(() => {
    setReplyDraft(null)
    setPinPromptMessage(null)
    setTransferOpen(false)
    setTransferError(null)
    setTransferAmountDraft('')
  }, [activeThreadKey])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  useEffect(() => {
    setContextMenu(null)
  }, [activeThreadKey, visibleMessages.length])
  const profileLabel =
    addressLower && displayNames[addressLower]
      ? displayNames[addressLower]
      : address ?? '—'
  const profileBioValue = addressLower ? customBios[addressLower] ?? null : null
  const peerProfileAddressLower = peerProfileAddress?.toLowerCase() ?? ''
  const peerProfileLabel = peerProfileAddressLower
    ? displayNames[peerProfileAddressLower] || shorten(peerProfileAddressLower)
    : '—'
  const peerProfileBio = peerProfileAddressLower
    ? customBios[peerProfileAddressLower] ?? null
    : null
  const groupProfileId = normalizeGroupId(groupProfileDetails?.id)
  const groupProfileRole = String(groupProfileDetails?.role ?? '').toLowerCase()
  const groupProfileCanEdit = Boolean(
    groupProfileId && addressLower && (groupProfileRole === 'owner' || groupProfileRole === 'admin'),
  )
  const groupProfileCanManageMembers = Boolean(
    groupProfileId && addressLower && groupProfileRole === 'owner',
  )

  useEffect(() => {
    setPeerSwipeState({ key: null, offset: 0 })
    peerSwipeTouchRef.current = null
    peerSwipeSuppressTapRef.current = null
  }, [activePeer, activeSecret, isEditing])

  const handleOpenPeerProfile = useCallback((peer: string) => {
    const peerLower = peer.toLowerCase()
    if (isGroupId(peerLower)) return
    setPeerProfileAddress(peerLower)
    void loadProfiles([peerLower])
  }, [loadProfiles])

  const handleCreateSecretChatAction = useCallback(
    (peerLower: string) => {
      if (isGroupId(peerLower)) return
      void handleCreateSecretChat(peerLower)
      if (!isMobileLayout()) {
        handleSelectPeer(peerLower, true)
      }
    },
    [handleCreateSecretChat, handleSelectPeer],
  )

  const handlePeerSwipeStart = useCallback(
    (
      event: TouchEvent<HTMLDivElement>,
      swipeKey: string,
      maxOffset: number,
    ) => {
      if (isEditing || !isMobileLayout()) return
      if (maxOffset <= 0) return
      const touch = event.touches[0]
      if (!touch) return
      const baseOffset =
        peerSwipeState.key === swipeKey ? peerSwipeState.offset : 0
      if (peerSwipeState.key && peerSwipeState.key !== swipeKey) {
        setPeerSwipeState({ key: null, offset: 0 })
      }
      peerSwipeTouchRef.current = {
        key: swipeKey,
        startX: touch.clientX,
        startY: touch.clientY,
        baseOffset,
        maxOffset,
        moved: false,
        horizontal: false,
      }
    },
    [isEditing, peerSwipeState],
  )

  const handlePeerSwipeMove = useCallback(
    (event: TouchEvent<HTMLDivElement>, swipeKey: string) => {
      const swipe = peerSwipeTouchRef.current
      if (!swipe || swipe.key !== swipeKey || !isMobileLayout()) return
      const touch = event.touches[0]
      if (!touch) return
      const deltaX = touch.clientX - swipe.startX
      const deltaY = touch.clientY - swipe.startY

      if (!swipe.horizontal) {
        if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
          peerSwipeTouchRef.current = null
          return
        }
        if (Math.abs(deltaX) < 6) return
        if (Math.abs(deltaX) <= Math.abs(deltaY)) return
        swipe.horizontal = true
      }

      const nextOffset = Math.max(
        0,
        Math.min(swipe.maxOffset, swipe.baseOffset - deltaX),
      )

      if (Math.abs(nextOffset - swipe.baseOffset) > 6) {
        swipe.moved = true
      }

      if (swipe.moved) {
        event.preventDefault()
      }

      setPeerSwipeState({ key: swipeKey, offset: nextOffset })
    },
    [],
  )

  const handlePeerSwipeEnd = useCallback((swipeKey: string) => {
    const swipe = peerSwipeTouchRef.current
    if (!swipe || swipe.key !== swipeKey) return
    const currentOffset =
      peerSwipeState.key === swipeKey ? peerSwipeState.offset : swipe.baseOffset
    const shouldOpen =
      swipe.horizontal && currentOffset > swipe.maxOffset * 0.42
    if (swipe.moved) {
      peerSwipeSuppressTapRef.current = swipeKey
      window.setTimeout(() => {
        if (peerSwipeSuppressTapRef.current === swipeKey) {
          peerSwipeSuppressTapRef.current = null
        }
      }, 220)
    }
    setPeerSwipeState(
      shouldOpen
        ? { key: swipeKey, offset: swipe.maxOffset }
        : { key: null, offset: 0 },
    )
    peerSwipeTouchRef.current = null
  }, [peerSwipeState])

  const handleOpenProfile = () => {
    setProfileOpen(true)
    setProfileEditing(false)
    setProfileError(null)
    setNftPickerOpen(false)
    if (addressLower) {
      setProfileNameDraft(displayNames[addressLower] ?? '')
      setProfileBioDraft(customBios[addressLower] ?? '')
      void loadProfiles([addressLower]).then(() => {
        setProfileNameDraft(customNamesRef.current[addressLower] ?? '')
        setProfileBioDraft(customBiosRef.current[addressLower] ?? '')
      })
      if (!displayNames[addressLower]) {
        const fallbackAddresses =
          signerAddressLower && signerAddressLower !== addressLower
            ? [signerAddressLower]
            : []
        void fetchPortalNameForAddress(
          addressLower,
          undefined,
          fallbackAddresses,
        )
          .then((name) => {
            if (name) {
              setProfileNameDraft((current) => current || name)
            }
          })
          .catch(() => {})
      }
    } else {
      setProfileNameDraft('')
      setProfileBioDraft('')
    }
  }

  const handleOpenNftPicker = async () => {
    if (!addressLower || profileSaving) return
    setProfileError(null)
    setNftPickerOpen(true)
    setNftPickerUseAgwAvatar(!customAvatars[addressLower])
    if (nftAvatarLoaded || nftAvatarLoading) return
    setNftAvatarLoading(true)
    try {
      const options = await fetchNftAvatars(addressLower)
      setNftAvatarOptions(options)
      setNftAvatarLoaded(true)
    } catch (err) {
      console.error('NFT avatar load error:', err)
      if (!isAbortError(err)) {
        setProfileError(getErrorMessage(err))
      }
    } finally {
      setNftAvatarLoading(false)
    }
  }

  const handleProfileSave = async () => {
    if (!addressLower) return
    setProfileError(null)
    const nextName = profileNameDraft.trim()
    const nextBio = profileBioDraft.trim().slice(0, 67)
    if (nextName && nextName.length < 3) {
      setProfileError('Username must contain at least 3 characters')
      return
    }
    setProfileSaving(true)
    const previousName = customNames[addressLower] ?? null
    const previousBio = customBios[addressLower] ?? null
    const previousAvatar = customAvatars[addressLower] ?? null
    setCustomNames((prev) => ({ ...prev, [addressLower]: nextName || null }))
    setCustomBios((prev) => ({ ...prev, [addressLower]: nextBio || null }))
    try {
      const row = await saveProfile({
        address: addressLower,
        display_name: nextName || null,
        avatar_url: customAvatars[addressLower] ?? null,
        bio: nextBio || null,
        updated_at: new Date().toISOString(),
      })
      const resolvedName = nextName || null
      const resolvedAvatar = row?.avatar_url ?? customAvatars[addressLower] ?? null
      const hasBioField = row ? Object.prototype.hasOwnProperty.call(row, 'bio') : false
      const resolvedBio = hasBioField ? row?.bio ?? null : nextBio || null
      setCustomNames((prev) => ({ ...prev, [addressLower]: resolvedName }))
      setCustomAvatars((prev) => ({ ...prev, [addressLower]: resolvedAvatar }))
      setCustomBios((prev) => ({ ...prev, [addressLower]: resolvedBio }))
      profileCacheRef.current[addressLower] = {
        displayName: resolvedName,
        avatarUrl: resolvedAvatar,
        bio: resolvedBio,
        ts: Date.now(),
      }
      emitProfileSync(resolvedName, resolvedAvatar, resolvedBio)
      if (!nextName) {
        const fallbackAddresses =
          signerAddressLower && signerAddressLower !== addressLower
            ? [signerAddressLower]
            : []
        void fetchPortalNameForAddress(
          addressLower,
          undefined,
          fallbackAddresses,
        ).catch(() => {})
      }
      setProfileNameDraft(resolvedName ?? '')
      setProfileBioDraft(resolvedBio ?? '')
      setProfileEditing(false)
    } catch (err) {
      console.error('Profile save error:', err)
      if (!isAbortError(err)) {
        const errorMessage = getErrorMessage(err)
        if (errorMessage.toLowerCase().includes('already taken')) {
          setProfileError('This username is already taken')
        } else if (errorMessage.toLowerCase().includes('at least 3')) {
          setProfileError('Username must contain at least 3 characters')
        } else {
          setProfileError(errorMessage)
        }
        setCustomNames((prev) => ({ ...prev, [addressLower]: previousName }))
        setCustomBios((prev) => ({ ...prev, [addressLower]: previousBio }))
        profileCacheRef.current[addressLower] = {
          displayName: previousName,
          avatarUrl: previousAvatar,
          bio: previousBio,
          ts: Date.now(),
        }
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const handleToggleProfileEditing = async () => {
    if (!address) return
    if (profileEditing) {
      await handleProfileSave()
      return
    }
    setProfileError(null)
    setProfileEditing(true)
  }

  const handleSelectNftAvatar = async (avatarUrl: string) => {
    if (!addressLower) return
    const previousAvatar = customAvatars[addressLower] ?? null
    const displayName = customNames[addressLower] ?? displayNames[addressLower] ?? null
    const bio = customBios[addressLower] ?? null
    setProfileError(null)
    setNftPickerUseAgwAvatar(false)
    setNftPickerOpen(false)
    setProfileSaving(true)
    try {
      setCustomAvatars((prev) => ({ ...prev, [addressLower]: avatarUrl }))
      profileCacheRef.current[addressLower] = {
        displayName,
        avatarUrl,
        bio,
        ts: Date.now(),
      }
      const row = await saveProfile({
        address: addressLower,
        display_name: customNames[addressLower] ?? null,
        avatar_url: avatarUrl,
        bio,
        updated_at: new Date().toISOString(),
      })
      if (row) {
        const hasBioField = Object.prototype.hasOwnProperty.call(row, 'bio')
        const syncedBio = hasBioField ? row.bio ?? null : bio
        setCustomNames((prev) => ({
          ...prev,
          [addressLower]: row.display_name ?? null,
        }))
        setCustomAvatars((prev) => ({
          ...prev,
          [addressLower]: avatarUrl,
        }))
        setCustomBios((prev) => ({ ...prev, [addressLower]: syncedBio }))
        profileCacheRef.current[addressLower] = {
          displayName: row.display_name ?? null,
          avatarUrl,
          bio: syncedBio,
          ts: Date.now(),
        }
      } else {
        await loadProfiles([addressLower])
      }
      emitProfileSync(
        row?.display_name ?? customNames[addressLower] ?? null,
        avatarUrl,
        row && Object.prototype.hasOwnProperty.call(row, 'bio') ? row.bio ?? null : bio,
      )
    } catch (err) {
      console.error('NFT avatar save error:', err)
      if (!isAbortError(err)) {
        setCustomAvatars((prev) => ({ ...prev, [addressLower]: previousAvatar }))
        profileCacheRef.current[addressLower] = {
          displayName,
          avatarUrl: previousAvatar,
          bio,
          ts: Date.now(),
        }
        setNftPickerOpen(true)
        setProfileError(getErrorMessage(err))
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const handleToggleUseAgwAvatar = async (checked: boolean) => {
    setNftPickerUseAgwAvatar(checked)
    if (!checked || !addressLower || profileSaving) return
    if (!customAvatars[addressLower]) return

    const previousAvatar = customAvatars[addressLower] ?? null
    const displayName = customNames[addressLower] ?? displayNames[addressLower] ?? null
    const bio = customBios[addressLower] ?? null
    setProfileError(null)
    setProfileSaving(true)
    try {
      setCustomAvatars((prev) => ({ ...prev, [addressLower]: null }))
      profileCacheRef.current[addressLower] = {
        displayName,
        avatarUrl: null,
        bio,
        ts: Date.now(),
      }
      const row = await saveProfile({
        address: addressLower,
        display_name: customNames[addressLower] ?? null,
        avatar_url: null,
        bio,
        updated_at: new Date().toISOString(),
      })
      if (row) {
        const hasBioField = Object.prototype.hasOwnProperty.call(row, 'bio')
        const syncedBio = hasBioField ? row.bio ?? null : bio
        setCustomNames((prev) => ({
          ...prev,
          [addressLower]: row.display_name ?? null,
        }))
        setCustomAvatars((prev) => ({
          ...prev,
          [addressLower]: null,
        }))
        setCustomBios((prev) => ({ ...prev, [addressLower]: syncedBio }))
        profileCacheRef.current[addressLower] = {
          displayName: row.display_name ?? null,
          avatarUrl: null,
          bio: syncedBio,
          ts: Date.now(),
        }
      } else {
        await loadProfiles([addressLower])
      }
      emitProfileSync(
        row?.display_name ?? customNames[addressLower] ?? null,
        null,
        row && Object.prototype.hasOwnProperty.call(row, 'bio') ? row.bio ?? null : bio,
      )
    } catch (err) {
      console.error('AGW avatar switch error:', err)
      if (!isAbortError(err)) {
        setCustomAvatars((prev) => ({ ...prev, [addressLower]: previousAvatar }))
        profileCacheRef.current[addressLower] = {
          displayName,
          avatarUrl: previousAvatar,
          bio,
          ts: Date.now(),
        }
        setNftPickerUseAgwAvatar(false)
        setProfileError(getErrorMessage(err))
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const lastOnlineAt = activePeerLower ? onlinePeers[activePeerLower] : undefined
  const isPeerOnline =
    activePeerValid && lastOnlineAt ? onlineTick - lastOnlineAt < 12000 : false
  const activePeerLabel = activePeerValid
    ? displayNames[activePeerLower] || shorten(activePeer)
    : t.chatTitle
  const handleBackToList = () => {
    setActivePeer('')
    setPeerInput('')
    setActiveSecret(false)
    setSecretPassphraseDraft('')
    setReplyDraft(null)
    setError(null)
  }

  return (
    <div className="app" data-theme={theme}>
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
              <button className="btn btn--ghost" onClick={handleLogout}>
                {t.signOut}
              </button>
            ) : (
              <button className="btn" onClick={login}>
                {t.signIn}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={`app__main ${activePeerValid ? 'app__main--chat' : ''}`}>
        <section className="panel panel--left">
          <div className="panel__title">{t.conversationsTitle}</div>
          <div className="address">
            <div className="address__search">
              <input
                className="input input--address"
                placeholder={t.searchPlaceholder}
                value={peerInput}
                onChange={(event) => setPeerInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSetPeer()
                }}
              />
              {peerInputTrimmed &&
                !peerInputIsGroup &&
                (peerSearchLoading ||
                  visiblePeerSearchResults.length > 0 ||
                  (!peerInputValid && peerInputTrimmed.length >= 2)) && (
                <div className="address__results">
                  {peerSearchLoading && visiblePeerSearchResults.length === 0 ? (
                    <div className="address__state">{t.searchLoading}</div>
                  ) : visiblePeerSearchResults.length > 0 ? (
                    visiblePeerSearchResults.map((item) => (
                      <button
                        key={item.address}
                        className="address__result"
                        type="button"
                        onClick={() => openPeerChat(item.address, item)}
                      >
                        <AbstractProfile
                          address={item.address}
                          src={item.avatarUrl ?? undefined}
                          size="sm"
                          showTooltip={false}
                          fallback={isGroupId(item.address) ? 'GR' : undefined}
                        />
                        <span className="address__result-copy">
                          <span className="address__result-name">{item.name}</span>
                          <span className="address__result-address">{shorten(item.address)}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="address__state">{t.searchNoUsers}</div>
                  )}
                </div>
              )}
            </div>
            <button
              className="btn btn--icon btn--open"
              onClick={handleOpenCreateGroup}
              aria-label={t.createGroup}
              title={t.createGroup}
            >
              <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle
                  cx="8"
                  cy="9"
                  r="3.1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M2.7 17.5c0-2.8 2.2-4.8 5.3-4.8s5.3 2 5.3 4.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="16.3"
                  cy="10.4"
                  r="2.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M13 17.5c.4-2.1 2.1-3.6 4.4-3.6 2.6 0 4.4 1.9 4.4 4.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
          <div className="peer-list">
            {peerCards.length === 0 ? (
              <div className="peer-list__empty">
                {t.emptyPeers}
              </div>
            ) : (
              peerCards.map((card) => {
                const peerLower = card.peer.toLowerCase()
                const isSecretCard = card.secret
                const isGroupPeer = isGroupId(peerLower)
                const threadKey = getThreadKey(peerLower, isSecretCard)
                const swipeKey = `${threadKey}:swipe`
                const hasSecret =
                  Boolean(secretPeers[peerLower]) && !hiddenSecretPeers.includes(peerLower)
                const isActive =
                  activePeer.toLowerCase() === peerLower &&
                  activeSecret === isSecretCard
                const canCreateSecret = !isGroupPeer && !hasSecret && !isSecretCard
                const swipeActionCount = (isSecretCard || isGroupPeer ? 0 : 1) + 1
                const swipeWidth = getPeerSwipeWidth(swipeActionCount)
                const swipeOffset =
                  peerSwipeState.key === swipeKey ? peerSwipeState.offset : 0
                const preview = threadPreviewByKey[threadKey]
                const unreadCount = unreadCountsByThread[threadKey] ?? 0
                const hasUnread = unreadCount > 0
                const previewText = preview
                  ? preview.text
                  : isSecretCard
                    ? t.secretChatLabel
                    : t.noMessagesYet
                const previewTime = preview?.createdAt
                  ? formatRelativeTime(preview.createdAt, onlineTick)
                  : ''
                const peerLabel = displayNames[peerLower] || shorten(peerLower)
                return (
                  <div
                    key={`${peerLower}:${isSecretCard ? 'secret' : 'main'}`}
                    className={`peer ${isActive ? 'peer--active' : ''} ${
                      isEditing ? 'peer--shake' : ''
                    } ${swipeOffset > 0 ? 'peer--swiped' : ''}`}
                  >
                    {isEditing && !isSecretCard && !isGroupPeer && (
                      <div
                        className={`peer__lock ${
                          canCreateSecret ? '' : 'peer__lock--off'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!canCreateSecret) return
                          handleCreateSecretChatAction(peerLower)
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
                    <div className="peer__swipe-actions">
                      {!isSecretCard && !isGroupPeer && (
                        <button
                          className={`peer__swipe-action peer__swipe-action--secret ${
                            canCreateSecret ? '' : 'peer__swipe-action--disabled'
                          }`}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (!canCreateSecret) return
                            setPeerSwipeState({ key: null, offset: 0 })
                            handleCreateSecretChatAction(peerLower)
                          }}
                          disabled={!canCreateSecret}
                          aria-label="Create secret chat"
                          title="Create secret chat"
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
                              strokeWidth="1.7"
                            />
                            <path
                              d="M8 10V7a4 4 0 0 1 8 0v3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        className="peer__swipe-action peer__swipe-action--delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          setPeerSwipeState({ key: null, offset: 0 })
                          if (isSecretCard) {
                            handleRemoveSecretChat(peerLower)
                          } else {
                            handleRemovePeer(peerLower)
                          }
                        }}
                        aria-label="Delete chat"
                        title="Delete chat"
                      >
                        <svg viewBox="0 0 28 28" aria-hidden="true">
                          <path
                            d="M15.6 8.4h2.6c.48 0 .72.58.38.92l-2.02 2.02 4.84 4.84-6.16 8.58-.18-7.7z"
                            fill="rgba(0, 0, 0, 0.16)"
                          />
                          <path
                            d="M8 9.2h12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M11 9.2V7.85A2.35 2.35 0 0 1 13.35 5.5h1.3A2.35 2.35 0 0 1 17 7.85V9.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10.3 11.4l.72 9.1a1.9 1.9 0 0 0 1.9 1.72h2.1a1.9 1.9 0 0 0 1.9-1.72l.72-9.1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12.35 13.05v5.8M14 13.05v5.8M15.65 13.05v5.8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                    <div
                      className="peer__surface"
                      role="button"
                      tabIndex={isEditing ? -1 : 0}
                      style={{
                        transform: swipeOffset
                          ? `translateX(-${swipeOffset}px)`
                          : undefined,
                      }}
                      onClick={() => {
                        if (peerSwipeSuppressTapRef.current === swipeKey) {
                          peerSwipeSuppressTapRef.current = null
                          return
                        }
                        if (peerSwipeState.key === swipeKey && peerSwipeState.offset > 0) {
                          setPeerSwipeState({ key: null, offset: 0 })
                          return
                        }
                        if (!isEditing) {
                          handleSelectPeer(peerLower, isSecretCard)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (isEditing || event.target !== event.currentTarget) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          if (peerSwipeState.key === swipeKey && peerSwipeState.offset > 0) {
                            setPeerSwipeState({ key: null, offset: 0 })
                            return
                          }
                          handleSelectPeer(peerLower, isSecretCard)
                        }
                      }}
                      onTouchStart={(event) =>
                        handlePeerSwipeStart(event, swipeKey, swipeWidth)
                      }
                      onTouchMove={(event) => handlePeerSwipeMove(event, swipeKey)}
                      onTouchEnd={() => handlePeerSwipeEnd(swipeKey)}
                      onTouchCancel={() => handlePeerSwipeEnd(swipeKey)}
                    >
                      <div className="peer__row">
                        <button
                          className="peer__avatar-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (isGroupPeer) {
                              void handleOpenGroupProfile(peerLower)
                              return
                            }
                            handleOpenPeerProfile(peerLower)
                          }}
                          aria-label={
                            isGroupPeer
                              ? `Open ${peerLabel} group profile`
                              : `Open ${peerLabel} profile`
                          }
                          title={peerLower}
                        >
                          <AbstractProfile
                            address={peerLower}
                            size="md"
                            src={displayAvatars[peerLower] ?? undefined}
                            fallback={isGroupPeer ? 'GR' : undefined}
                          />
                        </button>
                        <div className="peer__content">
                          <div className="peer__topline">
                            <div className="peer__title-row">
                              <span className={`peer__address ${hasUnread ? 'peer__address--unread' : ''}`}>
                                {peerLabel}
                              </span>
                              {isSecretCard && (
                                <button
                                  className="peer__secret-lock peer__secret-lock--button peer__secret-lock--inline"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSecretInfoOpen(true)
                                  }}
                                  aria-label={t.secretInfoTitle}
                                  title={t.secretInfoTitle}
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
                                </button>
                              )}
                            </div>
                            <div className="peer__topline-right">
                              {!isEditing && previewTime && (
                                <span className="peer__time">{previewTime}</span>
                              )}
                              {!isEditing && hasUnread && (
                                <span className="peer__unread" aria-label={`${unreadCount} unread`}>
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`peer__preview ${
                              hasUnread ? 'peer__preview--unread' : ''
                            } ${!preview ? 'peer__preview--empty' : ''}`}
                          >
                            {previewText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
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
                <button
                  className="chat__avatar chat__avatar--button"
                  onClick={() => {
                    if (activePeerGroup) {
                      void handleOpenGroupProfile(activePeerLower)
                      return
                    }
                    handleOpenPeerProfile(activePeerLower)
                  }}
                  aria-label={
                    activePeerGroup
                      ? `Open ${activePeerLabel} group profile`
                      : `Open ${activePeerLabel} profile`
                  }
                  title={activePeer}
                >
                  <AbstractProfile
                    address={activePeer}
                    size="chat"
                    src={displayAvatars[activePeerLower] ?? undefined}
                    fallback={activePeerGroup ? 'GR' : undefined}
                  />
                </button>
              )}
              <div className="chat__left-main">
                <div className="chat__title">
                  {activePeerLabel}
                  {activePeerValid && activeSecret && (
                    <button
                      className="chat__title-lock chat__title-lock--button"
                      onClick={() => setSecretInfoOpen(true)}
                      aria-label={t.secretInfoTitle}
                      title={t.secretInfoTitle}
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
                    </button>
                  )}
                </div>
                {pinnedMessage && pinnedLabel && (
                  <div className="chat__header-pinned chat__header-pinned--mobile">
                    <button
                      className="chat__header-pinned-main"
                      onClick={() => scrollToMessageKey(getMessageKey(pinnedMessage))}
                    >
                      <span className="chat__header-pinned-tag">{t.pinned}</span>
                      <span className="chat__header-pinned-text">{pinnedLabel}</span>
                    </button>
                  </div>
                )}
                <div
                  className={`chat__typing ${
                    activePeerValid && activeTypingParticipants.length > 0
                      ? 'chat__typing--on'
                      : 'chat__typing--off'
                  }`}
                >
                  {activeTypingLabel}
                </div>
              </div>
            </div>
            <div className="chat__right">
              {pinnedMessage && pinnedLabel && (
                <div className="chat__header-pinned chat__header-pinned--desktop">
                  <button
                    className="chat__header-pinned-main"
                    onClick={() => scrollToMessageKey(getMessageKey(pinnedMessage))}
                  >
                    <span className="chat__header-pinned-tag">{t.pinned}</span>
                    <span className="chat__header-pinned-text">{pinnedLabel}</span>
                  </button>
                  <button
                    className="chat__header-pinned-clear"
                    onClick={clearPinnedForActiveThread}
                    aria-label={t.unpin}
                    title={t.unpin}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path
                        d="M5 5l10 10M15 5L5 15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <div className="chat__status">
                {activePeerGroup ? (
                  <span className="pulse pulse--off">{t.groupTypeLabel}</span>
                ) : isPeerOnline ? (
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
              activePeerGroup={activePeerGroup}
              activeSecret={activeSecret}
              t={t}
              displayNames={displayNames}
              displayAvatars={displayAvatars}
              readReceiptsByPeer={readReceiptsByPeer}
              readReceiptTxByPeer={readReceiptTxByPeer}
              pinnedMessageKey={pinnedMessageKey}
              highlightedMessageKey={highlightedMessageKey}
              currentUserReactionId={currentUserReactionId}
              reactionsByMessage={reactionsByMessage}
              getReplyLabel={getReplyLabel}
              onReplyChipClick={jumpToMessage}
              onOpenContextMenu={handleOpenContextMenu}
              onOpenContextMenuAt={handleOpenContextMenuAt}
              onToggleReaction={handleToggleReaction}
              onRemoveFailedMessage={handleRemoveFailedMessage}
              onOpenSenderProfile={handleOpenPeerProfile}
            />
          </div>

          {activePeerValid && activePeerAddress && activeSecret && (
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

          {replyDraft && (
            <div className="chat__reply-draft">
              <div className="chat__reply-copy">
                <span className="chat__reply-label">{t.reply}</span>
                <span className="chat__reply-text">
                  {getReplyLabel(replyDraft.key) ??
                    `${shorten(replyDraft.from)}: ${replyDraft.text}`}
                </span>
              </div>
              <button
                className="chat__reply-cancel"
                onClick={() => setReplyDraft(null)}
              >
                {t.cancel}
              </button>
            </div>
          )}
          <div className="chat__composer">
            <button
              className="chat__money-btn"
              onClick={handleOpenTransfer}
              aria-label={t.transfer}
              title={t.transfer}
              disabled={!connected || !activePeerValid || !activePeerAddress || transferSubmitting}
            >
              <span className="chat__money-icon">$</span>
            </button>
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
                !activePeer ||
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
      {contextMenu && contextMessage && (
        <div
          className="context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="context-menu__reactions">
            {QUICK_REACTIONS.map((emoji) => {
              const users = reactionsByMessage[contextMenu.messageKey]?.[emoji] ?? []
              const selected = users.includes(currentUserReactionId)
              return (
                <button
                  key={`ctx:${contextMenu.messageKey}:${emoji}`}
                  className={`context-menu__reaction ${selected ? 'context-menu__reaction--selected' : ''}`}
                  disabled={!currentUserReactionId}
                  onClick={() => handleToggleReaction(contextMessage, emoji)}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
          <div className="context-menu__items">
            <button
              className="context-menu__item"
              onClick={() => {
                handleReplyMessage(contextMessage)
                setContextMenu(null)
              }}
            >
              {t.reply}
            </button>
            <button
              className="context-menu__item"
              onClick={() => {
                if (pinnedMessageKey === getMessageKey(contextMessage)) {
                  clearPinnedForActiveThread()
                } else {
                  handlePinMessage(contextMessage)
                }
                setContextMenu(null)
              }}
            >
              {pinnedMessageKey === getMessageKey(contextMessage) ? t.unpin : t.pin}
            </button>
          </div>
        </div>
      )}
      {pinPromptMessage && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setPinPromptMessage(null)} />
          <div className="modal__content modal__content--pin">
            <div className="modal__header">
              <div className="modal__title">{t.pinQuestionTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain pin-modal__close"
                onClick={() => setPinPromptMessage(null)}
              >
                {t.cancel}
              </button>
            </div>
            <div className="pin-modal__preview">
              {getReplyLabel(getMessageKey(pinPromptMessage)) ??
                summarizeMessageText(pinPromptMessage.text)}
            </div>
            <div className="pin-modal__actions">
              <button
                className="btn pin-modal__button pin-modal__button--primary"
                onClick={() => handleConfirmPin('all')}
              >
                {t.pinForEveryone}
              </button>
              <button
                className="btn btn--ghost pin-modal__button pin-modal__button--ghost"
                onClick={() => handleConfirmPin('self')}
              >
                {t.pinOnlyMe}
              </button>
            </div>
          </div>
        </div>
      )}
      {groupCreateOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setGroupCreateOpen(false)} />
          <div className="modal__content modal__content--group-create">
            <div className="modal__header">
              <div className="modal__title">{t.groupTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setGroupCreateOpen(false)}
                disabled={groupCreateLoading || groupCreateAvatarProcessing}
              >
                {t.cancel}
              </button>
            </div>
            <div className="group-create">
              <div className="group-create__hero">
                <div className="group-create__hero-avatar">
                  <button
                    className="group-create__avatar-btn"
                    type="button"
                    onClick={handleGroupAvatarUploadClick}
                    disabled={groupCreateLoading || groupCreateAvatarProcessing}
                    aria-label="Choose group photo"
                  >
                    {groupCreateAvatarDraft ? (
                      <img
                        className="group-create__avatar-image"
                        src={groupCreateAvatarDraft}
                        alt="Group avatar preview"
                      />
                    ) : (
                      <span className="group-create__avatar-fallback" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M8.2 7.2 9.4 5h5.2l1.2 2.2H18A2.5 2.5 0 0 1 20.5 9.7v6.6A2.5 2.5 0 0 1 18 18.8H6A2.5 2.5 0 0 1 3.5 16.3V9.7A2.5 2.5 0 0 1 6 7.2h2.2Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="12.3"
                            r="3.1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                  {groupCreateAvatarDraft && (
                    <button
                      className="group-create__avatar-clear"
                      type="button"
                      aria-label="Remove group photo"
                      onClick={() => {
                        setGroupCreateAvatarDraft(null)
                        if (groupCreateAvatarInputRef.current) {
                          groupCreateAvatarInputRef.current.value = ''
                        }
                      }}
                      disabled={groupCreateLoading || groupCreateAvatarProcessing}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path
                          d="M5 5l10 10M15 5L5 15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                  <input
                    ref={groupCreateAvatarInputRef}
                    className="group-create__avatar-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    onChange={handleGroupAvatarFileChange}
                  />
                </div>
                <input
                  className="input group-create__hero-input"
                  value={groupCreateNameDraft}
                  onChange={(event) => setGroupCreateNameDraft(event.target.value)}
                  placeholder={t.groupNamePlaceholder}
                  maxLength={64}
                  autoFocus
                />
              </div>
              <div className="group-create__field group-create__field--members">
                <label className="group-create__label">{t.groupMembersLabel}</label>
                <div className="group-members-picker">
                  <div className="group-members-picker__tokens">
                    {groupCreateMembers.map((member) => (
                      <span key={member.address} className="group-member-chip">
                        <AbstractProfile
                          address={member.address}
                          src={member.avatarUrl ?? undefined}
                          size="sm"
                          showTooltip={false}
                        />
                        <span className="group-member-chip__name">
                          {member.name || shorten(member.address)}
                        </span>
                        <button
                          className="group-member-chip__remove"
                          type="button"
                          onClick={() => handleRemoveGroupMember(member.address)}
                          aria-label={`Remove ${member.name || shorten(member.address)}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      className="group-members-picker__input"
                      value={groupCreateMemberQuery}
                      onChange={(event) => setGroupCreateMemberQuery(event.target.value)}
                      onKeyDown={handleGroupMemberQueryKeyDown}
                      placeholder="Search by username or paste 0x address"
                      disabled={groupCreateLoading}
                    />
                  </div>
                  {(groupCreateMemberQueryTrimmed.length >= 2 || canAddTypedGroupMember) && (
                    <div className="group-members-picker__results">
                      {groupCreateMemberSearchLoading &&
                      visibleGroupMemberSearchResults.length === 0 &&
                      !canAddTypedGroupMember ? (
                        <div className="address__state">{t.searchLoading}</div>
                      ) : canAddTypedGroupMember ||
                        visibleGroupMemberSearchResults.length > 0 ? (
                        <>
                          {canAddTypedGroupMember && typedGroupMemberAddress && (
                            <button
                              className="address__result"
                              type="button"
                              onClick={() =>
                                addGroupMember(buildGroupMemberFromAddress(typedGroupMemberAddress))
                              }
                            >
                              <AbstractProfile
                                address={typedGroupMemberAddress}
                                size="sm"
                                showTooltip={false}
                              />
                              <span className="address__result-copy">
                                <span className="address__result-name">
                                  {shorten(typedGroupMemberAddress)}
                                </span>
                                <span className="address__result-address">Add address</span>
                              </span>
                            </button>
                          )}
                          {visibleGroupMemberSearchResults.map((item) => (
                            <button
                              key={item.address}
                              className="address__result"
                              type="button"
                              onClick={() => addGroupMember(item)}
                            >
                              <AbstractProfile
                                address={item.address}
                                src={item.avatarUrl ?? undefined}
                                size="sm"
                                showTooltip={false}
                              />
                              <span className="address__result-copy">
                                <span className="address__result-name">{item.name}</span>
                                <span className="address__result-address">
                                  {shorten(item.address)}
                                </span>
                              </span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="address__state">{t.searchNoUsers}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="group-create__hint">{t.groupMembersHint}</div>
              </div>
              <div className="group-create__actions">
                <button
                  className="btn btn--ghost settings__control"
                  onClick={() => setGroupCreateOpen(false)}
                  disabled={groupCreateLoading || groupCreateAvatarProcessing}
                >
                  {t.cancel}
                </button>
                <button
                  className="btn settings__control"
                  onClick={handleCreateGroup}
                  disabled={groupCreateLoading || groupCreateAvatarProcessing}
                >
                  {groupCreateLoading ? t.signing : t.groupCreateAction}
                </button>
              </div>
              {groupCreateError && <div className="error">{groupCreateError}</div>}
            </div>
          </div>
        </div>
      )}
      {groupProfileOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={closeGroupProfile} />
          <div className="modal__content modal__content--group-profile">
            <div className="modal__header">
              <div className="modal__title">Group profile</div>
              {groupProfileCanEdit ? (
                <button
                  className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                  onClick={() => {
                    void handleToggleGroupProfileEditing()
                  }}
                  disabled={groupProfileSaving || groupProfileAvatarProcessing}
                >
                  {groupProfileEditing ? 'Done' : t.edit}
                </button>
              ) : (
                <button
                  className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                  onClick={closeGroupProfile}
                  disabled={groupProfileSaving || groupProfileAvatarProcessing}
                >
                  Close
                </button>
              )}
            </div>
            <div className="group-profile">
              {groupProfileLoading ? (
                <div className="group-profile__state">{t.searchLoading}</div>
              ) : groupProfileDetails ? (
                <>
                  <div className="group-profile__hero">
                    <div className="group-profile__hero-main">
                      <div className="group-profile__avatar-wrap">
                        <button
                          className={`group-profile__avatar-btn ${
                            groupProfileCanEdit && groupProfileEditing
                              ? 'group-profile__avatar-btn--editable'
                              : ''
                          }`}
                          type="button"
                          onClick={handleGroupProfileAvatarUploadClick}
                          disabled={
                            !groupProfileCanEdit ||
                            !groupProfileEditing ||
                            groupProfileSaving ||
                            groupProfileAvatarProcessing
                          }
                          aria-label="Change group photo"
                        >
                          <AbstractProfile
                            address={groupProfileId || groupProfileDetails.id}
                            size="xl"
                            showTooltip={false}
                            src={groupProfileAvatarDraft ?? groupProfileDetails.avatar_url ?? undefined}
                            fallback="GR"
                          />
                          {groupProfileCanEdit && groupProfileEditing && (
                            <span className="group-profile__avatar-edit" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path
                                  d="M4 20h4.2l9.9-9.9a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20Z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="m11.5 7.2 5.3 5.3"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                        {groupProfileCanEdit &&
                          groupProfileEditing &&
                          (groupProfileAvatarDraft ?? groupProfileDetails.avatar_url) && (
                            <button
                              className="group-profile__avatar-remove"
                              type="button"
                              aria-label="Remove group photo"
                              onClick={() => {
                                setGroupProfileAvatarDraft(null)
                              }}
                              disabled={groupProfileSaving || groupProfileAvatarProcessing}
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path
                                  d="M5 5l10 10M15 5L5 15"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          )}
                      </div>
                      {groupProfileCanEdit && groupProfileEditing ? (
                        <input
                          className="input group-profile__name-input"
                          value={groupProfileNameDraft}
                          onChange={(event) => setGroupProfileNameDraft(event.target.value)}
                          onBlur={() => {
                            void handleGroupProfileSave()
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                          maxLength={64}
                          disabled={groupProfileSaving || groupProfileAvatarProcessing}
                        />
                      ) : (
                        <div className="group-profile__name-display">{groupProfileDetails.name}</div>
                      )}
                    </div>
                    <input
                      ref={groupProfileAvatarInputRef}
                      className="group-profile__avatar-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      onChange={handleGroupProfileAvatarFileChange}
                    />
                    {groupProfileCanEdit && groupProfileAvatarProcessing && (
                      <div className="group-profile__avatar-hint">Processing...</div>
                    )}
                  </div>
                  <div className="group-profile__members">
                    <div className="group-profile__members-title">
                      Members ({groupProfileDetails.member_count ?? groupProfileDetails.members.length})
                    </div>
                    <div className="group-profile__members-list">
                      {groupProfileDetails.members.map((member) => {
                        const memberName =
                          displayNames[member.address]?.trim() || shorten(member.address)
                        const memberRole = member.role.toLowerCase()
                        const isOwner = memberRole === 'owner'
                        const isAdmin = memberRole === 'admin'
                        const canManageThisMember =
                          groupProfileEditing &&
                          groupProfileCanManageMembers &&
                          !isOwner &&
                          member.address !== addressLower
                        return (
                          <div
                            key={`${groupProfileDetails.id}:${member.address}`}
                            className={`group-profile__member ${
                              groupProfileEditing ? 'group-profile__member--editing' : ''
                            }`}
                          >
                            <button
                              className="group-profile__member-avatar"
                              type="button"
                              onClick={() => handleOpenPeerProfile(member.address)}
                              aria-label={`Open ${memberName} profile`}
                            >
                              <AbstractProfile
                                address={member.address}
                                src={displayAvatars[member.address] ?? undefined}
                                size="sm"
                                showTooltip={false}
                              />
                            </button>
                            <div className="group-profile__member-copy">
                              <div className="group-profile__member-line">
                                <span className="group-profile__member-name">{memberName}</span>
                                {isOwner && (
                                  <span className="group-profile__member-role">Creator</span>
                                )}
                                {!isOwner && isAdmin && (
                                  <span className="group-profile__member-role">Admin</span>
                                )}
                              </div>
                              <div className="group-profile__member-address">
                                {member.address}
                              </div>
                            </div>
                            {canManageThisMember && (
                              <div className="group-profile__member-actions">
                                <button
                                  className={`group-profile__member-action ${
                                    isAdmin ? 'group-profile__member-action--active' : ''
                                  }`}
                                  type="button"
                                  onClick={() => {
                                    void handleUpdateGroupMemberRole(
                                      member.address,
                                      isAdmin ? 'member' : 'admin',
                                    )
                                  }}
                                  disabled={groupProfileSaving}
                                  title={isAdmin ? 'Remove admin' : 'Make admin'}
                                >
                                  Admin
                                </button>
                                <button
                                  className="group-profile__member-action group-profile__member-action--danger"
                                  type="button"
                                  onClick={() => {
                                    void handleKickGroupMember(member.address, memberName)
                                  }}
                                  disabled={groupProfileSaving}
                                  aria-label={`Kick ${memberName}`}
                                  title={`Kick ${memberName}`}
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {groupProfileCanEdit && groupProfileEditing && (
                      <div className="group-profile__add-more">
                        {!groupProfileAddMoreOpen ? (
                          <button
                            className="btn btn--ghost settings__control settings__control--sm"
                            type="button"
                            onClick={() => setGroupProfileAddMoreOpen(true)}
                            disabled={groupProfileSaving || groupProfileAvatarProcessing}
                          >
                            Add more
                          </button>
                        ) : (
                          <div className="group-members-picker group-members-picker--profile">
                            <div className="group-members-picker__tokens group-members-picker__tokens--profile">
                              <input
                                className="group-members-picker__input"
                                value={groupProfileMemberQuery}
                                onChange={(event) => setGroupProfileMemberQuery(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key !== 'Enter' && event.key !== ',') return
                                  const query = groupProfileMemberQuery.trim()
                                  if (!query) return
                                  event.preventDefault()
                                  const normalizedQuery = query.toLowerCase()
                                  const exactSearchMatch =
                                    visibleGroupProfileMemberSearchResults.find(
                                      (item) =>
                                        item.name.trim().toLowerCase() === normalizedQuery ||
                                        item.address.toLowerCase() === normalizedQuery,
                                    ) ?? null
                                  if (exactSearchMatch) {
                                    void handleAddGroupProfileMember(exactSearchMatch)
                                    return
                                  }
                                  if (typedGroupProfileMemberAddress) {
                                    void handleAddGroupProfileMember(
                                      buildGroupMemberFromAddress(typedGroupProfileMemberAddress),
                                    )
                                  }
                                }}
                                placeholder="Search by username or paste 0x address"
                                disabled={groupProfileSaving}
                                autoFocus
                              />
                              <button
                                className="group-members-picker__dismiss"
                                type="button"
                                onClick={() => {
                                  setGroupProfileAddMoreOpen(false)
                                  setGroupProfileMemberQuery('')
                                  setGroupProfileMemberSearchResults([])
                                  setGroupProfileError(null)
                                }}
                                disabled={groupProfileSaving}
                                aria-label="Close add member"
                              >
                                <svg viewBox="0 0 20 20" aria-hidden="true">
                                  <path
                                    d="M5 5l10 10M15 5L5 15"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            </div>
                            {(groupProfileMemberQueryTrimmed.length >= 2 ||
                              canAddTypedGroupProfileMember) && (
                              <div className="group-members-picker__results">
                                {groupProfileMemberSearchLoading &&
                                visibleGroupProfileMemberSearchResults.length === 0 &&
                                !canAddTypedGroupProfileMember ? (
                                  <div className="address__state">{t.searchLoading}</div>
                                ) : canAddTypedGroupProfileMember ||
                                  visibleGroupProfileMemberSearchResults.length > 0 ? (
                                  <>
                                    {canAddTypedGroupProfileMember &&
                                      typedGroupProfileMemberAddress && (
                                        <button
                                          className="address__result"
                                          type="button"
                                          onClick={() =>
                                            void handleAddGroupProfileMember(
                                              buildGroupMemberFromAddress(
                                                typedGroupProfileMemberAddress,
                                              ),
                                            )
                                          }
                                        >
                                          <AbstractProfile
                                            address={typedGroupProfileMemberAddress}
                                            size="sm"
                                            showTooltip={false}
                                          />
                                          <span className="address__result-copy">
                                            <span className="address__result-name">
                                              {shorten(typedGroupProfileMemberAddress)}
                                            </span>
                                            <span className="address__result-address">
                                              Add address
                                            </span>
                                          </span>
                                        </button>
                                      )}
                                    {visibleGroupProfileMemberSearchResults
                                      .slice(0, 6)
                                      .map((item) => (
                                      <button
                                        key={`group-profile:${item.address}`}
                                        className="address__result"
                                        type="button"
                                        onClick={() => void handleAddGroupProfileMember(item)}
                                      >
                                        <AbstractProfile
                                          address={item.address}
                                          src={item.avatarUrl ?? undefined}
                                          size="sm"
                                          showTooltip={false}
                                        />
                                        <span className="address__result-copy">
                                          <span className="address__result-name">{item.name}</span>
                                          <span className="address__result-address">
                                            {shorten(item.address)}
                                          </span>
                                        </span>
                                      </button>
                                    ))}
                                  </>
                                ) : (
                                  <div className="address__state">{t.searchNoUsers}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="group-profile__footer">
                    <button
                      className="btn btn--danger settings__control group-profile__leave"
                      type="button"
                      onClick={() => {
                        void handleLeaveGroup()
                      }}
                      disabled={groupProfileSaving || groupProfileAvatarProcessing}
                    >
                      {t.leaveGroup}
                    </button>
                  </div>
                </>
              ) : (
                <div className="group-profile__state">Group not found</div>
              )}
              {groupProfileError && <div className="error">{groupProfileError}</div>}
            </div>
          </div>
        </div>
      )}
      {profileOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setProfileOpen(false)} />
          <div className="modal__content modal__content--profile">
            <div className="modal__header">
              <div className="modal__title">{t.profileTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => {
                  void handleToggleProfileEditing()
                }}
                disabled={!address || profileSaving}
              >
                {profileEditing ? 'Done' : t.edit}
              </button>
            </div>
            <div className="profile">
              <button
                className={`profile__avatar profile__avatar-button ${
                  address && profileEditing ? 'profile__avatar-button--editable' : ''
                }`}
                onClick={handleOpenNftPicker}
                disabled={!address || profileSaving || !profileEditing}
                type="button"
                aria-label={t.profileChooseNftAvatar}
                title={t.profileChooseNftAvatar}
              >
                <AbstractProfile
                  address={address}
                  size="xl"
                  showTooltip={false}
                  src={addressLower ? customAvatars[addressLower] ?? undefined : undefined}
                />
                {address && profileEditing && (
                  <span className="profile__avatar-edit" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="profile__avatar-edit-icon">
                      <path
                        d="M4 20h4.2l9.9-9.9a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <path
                        d="m11.5 7.2 5.3 5.3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                )}
              </button>
              {profileEditing ? (
                <input
                  className="input profile__name-input"
                  placeholder={t.profileNamePlaceholder}
                  value={profileNameDraft}
                  onChange={(event) => setProfileNameDraft(event.target.value)}
                  maxLength={64}
                  disabled={profileSaving}
                />
              ) : (
                <div className="profile__name-display">{profileLabel}</div>
              )}
              <div className="profile__meta">
                <div className="profile__meta-label">{t.walletPrefix.slice(0, -1)}</div>
                <div className="profile__meta-value">
                  {connected ? shorten(address) : t.walletConnect}
                </div>
              </div>
              {profileEditing ? (
                <div className="profile__edit">
                  <textarea
                    className="input profile__input profile__textarea"
                    placeholder={t.profileBioPlaceholder}
                    value={profileBioDraft}
                    onChange={(event) => setProfileBioDraft(event.target.value.slice(0, 67))}
                    rows={3}
                  />
                  <div className="profile__meta-label">
                    {profileBioDraft.length}/67 · {t.profileBioLimit}
                  </div>
                </div>
              ) : (
                <div className="profile__meta profile__meta--bio">
                  <div className="profile__meta-label">{t.profileBioPlaceholder}</div>
                  <div className="profile__bio-value">{profileBioValue || '—'}</div>
                </div>
              )}
              {profileError && <div className="error">{profileError}</div>}
            </div>
          </div>
        </div>
      )}
      {nftPickerOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setNftPickerOpen(false)} />
          <div className="modal__content modal__content--nft-picker">
            <div className="modal__header">
              <div className="modal__title">{t.profileChooseNftTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setNftPickerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="nft-picker">
              <div className="nft-picker__controls">
                <label className="nft-picker__agw-toggle">
                  <input
                    className="nft-picker__agw-checkbox"
                    type="checkbox"
                    checked={nftPickerUseAgwAvatar}
                    disabled={profileSaving}
                    onChange={(event) => {
                      void handleToggleUseAgwAvatar(event.target.checked)
                    }}
                  />
                  <span>{t.profileUseAgwAvatar}</span>
                </label>
              </div>
              {nftAvatarLoading && avatarPickerOptions.length === 0 ? (
                <div className="nft-picker__state">{t.profileLoadingNfts}</div>
              ) : avatarPickerOptions.length > 0 ? (
                <div
                  className={`nft-picker__grid ${
                    nftPickerUseAgwAvatar ? 'nft-picker__grid--disabled' : ''
                  }`}
                >
                  {avatarPickerOptions.map((item) => {
                    const selectedAvatarUrl = addressLower
                      ? customAvatars[addressLower] ?? null
                      : null
                    const selected = !nftPickerUseAgwAvatar && selectedAvatarUrl === item.imageUrl
                    return (
                      <button
                        key={item.id}
                        className={`nft-picker__item ${selected ? 'nft-picker__item--selected' : ''} ${
                          nftPickerUseAgwAvatar ? 'nft-picker__item--disabled' : ''
                        }`}
                        onClick={() => handleSelectNftAvatar(item.imageUrl)}
                        disabled={profileSaving || nftPickerUseAgwAvatar}
                        type="button"
                        aria-label={item.name}
                        title={item.name}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="nft-picker__image"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="nft-picker__state">{t.profileNoNfts}</div>
              )}
            </div>
          </div>
        </div>
      )}
      {transferOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setTransferOpen(false)} />
          <div className="modal__content modal__content--transfer">
            <div className="modal__header">
              <div className="modal__title">{t.transferTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setTransferOpen(false)}
                disabled={transferSubmitting}
              >
                {t.cancel}
              </button>
            </div>
            <div className="transfer-modal">
              <div className="transfer-modal__recipient">
                <AbstractProfile
                  address={activePeerLower || undefined}
                  size="lg"
                  showTooltip={false}
                  src={activePeerLower ? displayAvatars[activePeerLower] ?? undefined : undefined}
                  fallback={activePeerGroup ? 'GR' : undefined}
                />
                <div className="transfer-modal__recipient-copy">
                  <div className="transfer-modal__label">{t.transferRecipient}</div>
                  <div className="transfer-modal__name">
                    {activePeerLower
                      ? displayNames[activePeerLower] || shorten(activePeerLower)
                      : '—'}
                  </div>
                  <div className="transfer-modal__address">
                    {activePeerLower || '—'}
                  </div>
                </div>
              </div>
              <input
                className="input transfer-modal__input"
                placeholder={t.transferAmountPlaceholder}
                value={transferAmountDraft}
                onChange={(event) => setTransferAmountDraft(event.target.value)}
                inputMode="decimal"
                autoFocus
              />
              <div className="transfer-modal__actions">
                <button
                  className="btn btn--ghost settings__control"
                  onClick={() => setTransferOpen(false)}
                  disabled={transferSubmitting}
                >
                  {t.cancel}
                </button>
                <button
                  className="btn settings__control"
                  onClick={handleSendTransfer}
                  disabled={transferSubmitting || !activePeerValid || !activePeerAddress}
                >
                  {transferSubmitting ? t.signing : t.transferAction}
                </button>
              </div>
              {transferError && <div className="error">{transferError}</div>}
            </div>
          </div>
        </div>
      )}
      {peerProfileAddressLower && (
        <div className="modal">
          <div
            className="modal__overlay"
            onClick={() => setPeerProfileAddress(null)}
          />
          <div className="modal__content modal__content--peer-card">
            <div className="modal__header">
              <div className="modal__title">{t.profileTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setPeerProfileAddress(null)}
              >
                Close
              </button>
            </div>
            <div className="peer-profile">
              <AbstractProfile
                address={peerProfileAddressLower}
                size="xl"
                showTooltip={false}
                src={displayAvatars[peerProfileAddressLower] ?? undefined}
              />
              <div className="peer-profile__name">{peerProfileLabel}</div>
              <div className="peer-profile__address">{peerProfileAddressLower}</div>
              <div className="peer-profile__bio">
                <div className="peer-profile__label">{t.profileBioPlaceholder}</div>
                <div className="peer-profile__bio-value">{peerProfileBio || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setSettingsOpen(false)} />
          <div className="modal__content modal__content--settings">
            <div className="modal__header">
              <div className="modal__title">{t.settingsTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="settings__grid">
              <div className="settings__row settings__row--wallet">
                <div className="settings__icon settings__icon--wallet" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="settings__icon-svg">
                    <path
                      d="M5.5 8.5h10.8a2.7 2.7 0 0 1 2.7 2.7v5.1a2.7 2.7 0 0 1-2.7 2.7H5.5a2.7 2.7 0 0 1-2.7-2.7v-9a2.7 2.7 0 0 1 2.7-2.7h9.1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16.6 12.1h2.5v3.2h-2.5a1.6 1.6 0 1 1 0-3.2Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="settings__label">{t.walletStatusLabel}</div>
                <div className="settings__actions">
                  <div className={`pill ${connected ? 'pill--on' : 'pill--off'}`}>
                    {connected ? t.connected : t.notConnected}
                  </div>
                </div>
              </div>

              <div className="settings__row settings__row--language">
                <div className="settings__icon settings__icon--language" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="settings__icon-svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M4 12h16M12 4c2.4 2.2 3.7 5 3.7 8S14.4 17.8 12 20M12 4c-2.4 2.2-3.7 5-3.7 8s1.3 5.8 3.7 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="settings__label">{t.language}</div>
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

              <div className="settings__row settings__row--theme">
                <div className="settings__icon settings__icon--theme" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="settings__icon-svg">
                    <path
                      d="M18.5 14.2A6.8 6.8 0 1 1 9.8 5.5a7.1 7.1 0 0 0 8.7 8.7Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="settings__label">{t.theme}</div>
                <div className="settings__actions">
                  <select
                    className="settings__select settings__control"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as AppTheme)}
                  >
                    <option value="abschat">{t.themeDefault}</option>
                    <option value="x-black">{t.themeXBlack}</option>
                  </select>
                </div>
              </div>

              <div className="settings__row settings__row--session">
                <div className="settings__icon settings__icon--session" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="settings__icon-svg">
                    <rect
                      x="4.5"
                      y="6"
                      width="15"
                      height="11.5"
                      rx="2.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M7.5 19h9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="settings__label">{t.session}</div>
                <div className="settings__actions">
                  {sessionEnabled ? (
                    <button
                      className="btn btn--danger settings__control"
                      onClick={handleRevokeSession}
                    >
                      {t.revokeSession}
                    </button>
                  ) : (
                    <button
                      className="btn settings__control"
                      onClick={handleCreateSession}
                      disabled={sessionEnabled || isSessionSubmitting}
                    >
                      {isSessionSubmitting ? t.signing : t.session}
                    </button>
                  )}
                </div>
              </div>

              <div className="settings__row settings__row--docs">
                <div className="settings__icon settings__icon--docs" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="settings__icon-svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      fill="rgba(255, 255, 255, 0.92)"
                    />
                    <path
                      d="M10.1 10a2.1 2.1 0 1 1 3.8 1.2c-.5.7-1.3 1-1.7 1.8-.2.4-.2.7-.2 1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="16.8" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div className="settings__label">{t.docs}</div>
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
        </div>
      )}
      {secretInfoOpen && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setSecretInfoOpen(false)} />
          <div className="modal__content modal__content--secret">
            <div className="modal__header">
              <div className="modal__title">{t.secretInfoTitle}</div>
              <button
                className="btn btn--ghost settings__control settings__control--sm modal__close modal__close--plain"
                onClick={() => setSecretInfoOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="secret-info">
              <div className="secret-info__line">{t.secretInfoLine1}</div>
              <div className="secret-info__line">{t.secretInfoLine2}</div>
              <div className="secret-info__line">{t.secretInfoLine3}</div>
              <div className="secret-info__line">{t.secretInfoLine4}</div>
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
