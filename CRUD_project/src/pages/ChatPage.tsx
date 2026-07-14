import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import CreateGroupModal from '../components/CreateGroupModal'
import { API_BASE_URL, WS_BASE_URL } from '../config'

export type User = { user_id: number; username: string }
export type Group = {
  group_id: number; name: string; description?: string;
  members: { user: User }[];
}
export type Message = {
  message_id: number; content: string; senderId: number;
  sender: { username: string }; receiverId?: number;
  groupId?: number; timestamp: string;
}
export type ChatRequest = {
  request_id: number;
  senderId: number;
  receiverId: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}
export type ChatTarget = { type: 'user'; user: User } | { type: 'group'; group: Group }

const BASE = API_BASE_URL

export default function ChatPage() {
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
  const currentUser: User = { user_id: storedUser.id || storedUser.user_id, username: storedUser.username }
  const token = localStorage.getItem('token') || ''

  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
  const [activeChat, setActiveChat] = useState<ChatTarget | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [showGroupModal, setShowGroupModal] = useState(false)

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  // ─── Fetch users, groups & requests ──────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/users`, { headers })
      if (res.ok) setUsers(await res.json())
    } catch {}
  }, [token])

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/groups`, { headers })
      if (res.ok) setGroups(await res.json())
    } catch {}
  }, [token])

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/chat-requests`, { headers })
      if (res.ok) setChatRequests(await res.json())
    } catch {}
  }, [token])

  useEffect(() => {
    fetchUsers()
    fetchGroups()
    fetchRequests()
  }, [fetchUsers, fetchGroups, fetchRequests])

  // ─── Debounced User Fuzzy Search ──────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/users/search?q=${encodeURIComponent(searchQuery)}`, { headers })
        if (res.ok) setSearchResults(await res.json())
      } catch {}
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [searchQuery, token])

  // ─── WebSocket connection ──────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_BASE_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', userId: currentUser.user_id, username: currentUser.username }))
    }

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data)
      switch (data.type) {
        case 'online-users':
          setOnlineIds(new Set(data.users.map((u: any) => String(u.userId))))
          break
        case 'user-joined':
          setOnlineIds(prev => new Set([...prev, String(data.userId)]))
          fetchUsers()
          break
        case 'user-left':
          setOnlineIds(prev => { const s = new Set(prev); s.delete(String(data.userId)); return s })
          break
        case 'dm':
          setMessages(prev => {
            if (prev.some(m => m.message_id === data.message_id)) return prev
            return [...prev, {
              message_id: data.message_id, content: data.content,
              senderId: data.senderId, sender: { username: data.senderName },
              receiverId: data.receiverId, timestamp: data.timestamp,
            }]
          })
          break
        case 'group-message':
          setMessages(prev => {
            if (prev.some(m => m.message_id === data.message_id)) return prev
            return [...prev, {
              message_id: data.message_id, content: data.content,
              senderId: data.senderId, sender: { username: data.senderName },
              groupId: data.groupId, timestamp: data.timestamp,
            }]
          })
          break
        case 'group-created':
          fetchGroups()
          break
        case 'chat-request-updated':
          fetchRequests()
          break
        case 'typing':
          if (String(data.senderId) !== String(currentUser.user_id)) {
            setTypingUser(data.senderName)
            setTimeout(() => setTypingUser(null), 3000)
          }
          break
        case 'stop-typing':
          setTypingUser(null)
          break
      }
    }

    ws.onclose = () => console.log('WS closed')
    return () => ws.close()
  }, [currentUser.user_id])

  // ─── Load messages when chat target changes ─────────────
  useEffect(() => {
    if (!activeChat) return
    setMessages([])
    const loadMessages = async () => {
      try {
        let url = ''
        if (activeChat.type === 'user') url = `${BASE}/messages/${activeChat.user.user_id}`
        else url = `${BASE}/groups/${activeChat.group.group_id}/messages`
        const res = await fetch(url, { headers })
        if (res.ok) setMessages(await res.json())
      } catch {}
    }
    loadMessages()
  }, [activeChat])

  // ─── Send message ──────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!activeChat || !text.trim()) return
    try {
      if (activeChat.type === 'user') {
        await fetch(`${BASE}/send`, {
          method: 'POST', headers,
          body: JSON.stringify({ message: text, receiverId: activeChat.user.user_id }),
        })
      } else {
        await fetch(`${BASE}/groups/${activeChat.group.group_id}/messages`, {
          method: 'POST', headers,
          body: JSON.stringify({ message: text }),
        })
      }
    } catch (err) { console.error('Send error:', err) }
  }

  // ─── Typing indicator ──────────────────────────────────
  const sendTyping = () => {
    if (!wsRef.current || !activeChat) return
    const payload: any = { type: 'typing' }
    if (activeChat.type === 'user') payload.receiverId = String(activeChat.user.user_id)
    else payload.groupId = String(activeChat.group.group_id)
    wsRef.current.send(JSON.stringify(payload))
  }

  // ─── AI Summarize ──────────────────────────────────────
  const summarizeMessages = async (): Promise<string> => {
    const payload = messages.map(m => ({
      senderName: m.sender.username, content: m.content, timestamp: m.timestamp,
    }))
    try {
      const res = await fetch(`${BASE}/summarize`, {
        method: 'POST', headers,
        body: JSON.stringify({ messages: payload }),
      })
      const data = await res.json()
      return data.summary || 'No summary available'
    } catch { return 'Error generating summary' }
  }

  // ─── Send Chat Request ─────────────────────────────────
  const sendChatRequest = async (receiverId: number) => {
    try {
      const res = await fetch(`${BASE}/chat-requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ receiverId })
      })
      if (res.ok) fetchRequests()
    } catch {}
  }

  // ─── Respond to Chat Request ───────────────────────────
  const respondChatRequest = async (requestId: number, status: 'ACCEPTED' | 'DECLINED') => {
    try {
      const res = await fetch(`${BASE}/chat-requests/${requestId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status })
      })
      if (res.ok) fetchRequests()
    } catch {}
  }

  // ─── Create group ──────────────────────────────────────
  const createGroup = async (name: string, desc: string, memberIds: number[]) => {
    try {
      await fetch(`${BASE}/groups`, {
        method: 'POST', headers,
        body: JSON.stringify({ name, description: desc, memberIds }),
      })
      setShowGroupModal(false)
      fetchGroups()
    } catch {}
  }

  // ─── Logout ────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    wsRef.current?.close()
    navigate('/')
  }

  // ─── Filter messages for active chat ───────────────────
  const filteredMessages = messages.filter(m => {
    if (!activeChat) return false
    if (activeChat.type === 'user') {
      const uid = activeChat.user.user_id
      return (!m.groupId) && (
        (m.senderId === currentUser.user_id && m.receiverId === uid) ||
        (m.senderId === uid && m.receiverId === currentUser.user_id)
      )
    } else {
      return m.groupId === activeChat.group.group_id
    }
  })

  // ─── Filter friends & incoming requests ─────────────────
  const friends = users.filter(u =>
    chatRequests.some(r =>
      r.status === 'ACCEPTED' &&
      ((r.senderId === currentUser.user_id && r.receiverId === u.user_id) ||
       (r.senderId === u.user_id && r.receiverId === currentUser.user_id))
    )
  )

  const incomingUsers = users.filter(u =>
    chatRequests.some(r =>
      r.status === 'PENDING' &&
      r.senderId === u.user_id &&
      r.receiverId === currentUser.user_id
    )
  )

  return (
    <div className="chat-layout">
      <Sidebar
        currentUser={currentUser}
        users={friends}
        incomingUsers={incomingUsers}
        searchResults={searchResults}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        groups={groups}
        onlineIds={onlineIds}
        activeChat={activeChat}
        chatRequests={chatRequests}
        onSelectChat={setActiveChat}
        onCreateGroup={() => setShowGroupModal(true)}
        onLogout={logout}
      />
      <ChatWindow
        activeChat={activeChat}
        currentUser={currentUser}
        messages={filteredMessages}
        typingUser={typingUser}
        chatRequests={chatRequests}
        onSend={sendMessage}
        onTyping={sendTyping}
        onSummarize={summarizeMessages}
        onSendRequest={sendChatRequest}
        onRespondRequest={respondChatRequest}
      />
      {showGroupModal && (
        <CreateGroupModal
          users={users}
          onCreate={createGroup}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </div>
  )
}
