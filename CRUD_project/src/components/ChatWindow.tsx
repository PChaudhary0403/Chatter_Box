import { useState, useRef, useEffect } from 'react'
import type { User, Message, ChatTarget, ChatRequest } from '../pages/ChatPage'

const AVATAR_COLORS = [
  'linear-gradient(135deg, #c06c3e, #e8955f)',
  'linear-gradient(135deg, #5a9e6f, #7ec98f)',
  'linear-gradient(135deg, #4a8db7, #6bb5d9)',
  'linear-gradient(135deg, #9b59b6, #c39bd3)',
  'linear-gradient(135deg, #e67e22, #f0a04b)',
  'linear-gradient(135deg, #1abc9c, #48d1a5)',
  'linear-gradient(135deg, #c0392b, #e74c3c)',
]
function getColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length] }
function getInitial(name: string) { return name.charAt(0).toUpperCase() }
function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  activeChat: ChatTarget | null
  currentUser: User
  messages: Message[]
  typingUser: string | null
  chatRequests: ChatRequest[]
  onSend: (text: string) => void
  onTyping: () => void
  onSummarize: () => Promise<string>
  onSendRequest: (receiverId: number) => void
  onRespondRequest: (requestId: number, status: 'ACCEPTED' | 'DECLINED') => void
}

export default function ChatWindow({ activeChat, currentUser, messages, typingUser, chatRequests, onSend, onTyping, onSummarize, onSendRequest, onRespondRequest }: Props) {
  const [input, setInput] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUser])

  // Reset summary when chat changes
  useEffect(() => { setSummary(null) }, [activeChat])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInputChange = (val: string) => {
    setInput(val)
    clearTimeout(typingTimeout.current)
    onTyping()
    typingTimeout.current = setTimeout(() => {}, 2000)
  }

  const handleSummarize = async () => {
    if (messages.length === 0) return
    setSummarizing(true)
    const result = await onSummarize()
    setSummary(result)
    setSummarizing(false)
  }

  // Empty state
  if (!activeChat) {
    return (
      <div className="chat-main">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h2>Welcome to ChatterBox</h2>
          <p>Select a person or group from the sidebar to start chatting. Your messages are beautifully organized here.</p>
        </div>
      </div>
    )
  }

  const chatName = activeChat.type === 'user' ? activeChat.user.username : activeChat.group.name
  const chatId = activeChat.type === 'user' ? activeChat.user.user_id : activeChat.group.group_id + 1000
  const isGroup = activeChat.type === 'group'

  // Chat request status check (only for individual chats)
  const request = !isGroup
    ? chatRequests.find(r =>
        (r.senderId === currentUser.user_id && r.receiverId === activeChat.user.user_id) ||
        (r.senderId === activeChat.user.user_id && r.receiverId === currentUser.user_id)
      )
    : undefined

  const isConnected = isGroup || (request && request.status === 'ACCEPTED')

  return (
    <div className="chat-main">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-avatar" style={{ background: getColor(chatId) }}>
            {getInitial(chatName)}
          </div>
          <div>
            <div className="chat-name">{chatName}</div>
            <div className={`chat-status ${!isGroup && isConnected ? 'online' : ''}`}>
              {isGroup
                ? `${activeChat.group.members?.length || 0} members`
                : !isConnected ? 'Not connected' : typingUser ? '✍️ typing...' : 'online'}
            </div>
          </div>
        </div>
        {isConnected && (
          <div className="chat-header-actions">
            <button className="clay-btn clay-btn-sm" onClick={handleSummarize} disabled={summarizing || messages.length === 0} title="AI Summarize">
              {summarizing ? '⏳ Summarizing...' : '🤖 AI Summary'}
            </button>
          </div>
        )}
      </div>

      {/* Connection restriction UX */}
      {!isConnected ? (
        <div className="empty-state" style={{ padding: '40px' }}>
          <div className="clay-card-raised" style={{ padding: '36px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            
            {!request && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Connect to Chat</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Send a chat request to <strong>{chatName}</strong>. You can text each other once they accept your request.
                </p>
                <button className="clay-btn clay-btn-primary" onClick={() => onSendRequest(activeChat.user.user_id)}>
                  ✉️ Send Chat Request
                </button>
              </>
            )}

            {request && request.status === 'PENDING' && request.senderId === currentUser.user_id && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Request Pending</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Your chat request to <strong>{chatName}</strong> is pending approval. We will let you know once they accept.
                </p>
                <button className="clay-btn" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                  ⏳ Waiting for response...
                </button>
              </>
            )}

            {request && request.status === 'PENDING' && request.receiverId === currentUser.user_id && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Chat Request</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  <strong>{chatName}</strong> wants to connect with you. Accept their request to start texting.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="clay-btn clay-btn-primary" onClick={() => onRespondRequest(request.request_id, 'ACCEPTED')}>
                    ✓ Accept
                  </button>
                  <button className="clay-btn clay-btn-danger" onClick={() => onRespondRequest(request.request_id, 'DECLINED')}>
                    ✕ Decline
                  </button>
                </div>
              </>
            )}

            {request && request.status === 'DECLINED' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Connection Declined</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  The chat request with <strong>{chatName}</strong> was declined. You can resend the request to try again.
                </p>
                <button className="clay-btn clay-btn-primary" onClick={() => onSendRequest(activeChat.user.user_id)}>
                  ✉️ Resend Chat Request
                </button>
              </>
            )}

          </div>
        </div>
      ) : (
        <>
          {/* AI Summary Panel */}
          {summary && (
            <div className="summary-panel">
              <h3>🤖 AI Summary</h3>
              <div className="summary-text">{summary}</div>
              <button className="clay-btn clay-btn-sm close-summary" onClick={() => setSummary(null)}>✕ Close</button>
            </div>
          )}

          {/* Messages */}
          <div className="messages-area">
            {messages.length === 0 && (
              <div className="empty-state" style={{ padding: '60px 0' }}>
                <div className="empty-icon" style={{ fontSize: 48 }}>👋</div>
                <p style={{ fontSize: 14 }}>No messages yet. Say hello!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isSent = msg.senderId === currentUser.user_id
              return (
                <div key={msg.message_id} className={`message-row ${isSent ? 'sent' : 'received'}`}>
                  {!isSent && (
                    <div className="msg-avatar" style={{ background: getColor(msg.senderId) }}>
                      {getInitial(msg.sender.username)}
                    </div>
                  )}
                  <div className="msg-bubble">
                    {isGroup && !isSent && <span className="msg-sender">{msg.sender.username}</span>}
                    {msg.content}
                    <span className="msg-meta">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              )
            })}
            {typingUser && (
              <div className="typing-indicator">
                <div className="typing-dots"><span /><span /><span /></div>
                {typingUser} is typing...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Compose */}
          <div className="compose-bar">
            <input
              className="clay-input"
              placeholder={`Message ${chatName}...`}
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button className="send-btn" onClick={handleSend} title="Send message">
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  )
}
