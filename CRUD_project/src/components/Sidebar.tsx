import { useState } from 'react'
import type { User, Group, ChatTarget, ChatRequest } from '../pages/ChatPage'

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

interface Props {
  currentUser: User
  users: User[] // Friends (ACCEPTED requests)
  incomingUsers: User[] // Pending incoming requests
  searchResults: User[] // Results from database fuzzy search
  searchQuery: string
  onSearchChange: (query: string) => void
  groups: Group[]
  onlineIds: Set<string>
  activeChat: ChatTarget | null
  chatRequests: ChatRequest[]
  onSelectChat: (target: ChatTarget) => void
  onCreateGroup: () => void
  onLogout: () => void
}

export default function Sidebar({
  currentUser,
  users,
  incomingUsers,
  searchResults,
  searchQuery,
  onSearchChange,
  groups,
  onlineIds,
  activeChat,
  chatRequests,
  onSelectChat,
  onCreateGroup,
  onLogout
}: Props) {
  const [tab, setTab] = useState<'users' | 'groups'>('users')

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isActive = (target: ChatTarget) => {
    if (!activeChat) return false
    if (activeChat.type === 'user' && target.type === 'user') return activeChat.user.user_id === target.user.user_id
    if (activeChat.type === 'group' && target.type === 'group') return activeChat.group.group_id === target.group.group_id
    return false
  }

  const renderUserItem = (user: User) => {
    const online = onlineIds.has(String(user.user_id))
    const target: ChatTarget = { type: 'user', user }

    // Find request status
    const request = chatRequests.find(r =>
      (r.senderId === currentUser.user_id && r.receiverId === user.user_id) ||
      (r.senderId === user.user_id && r.receiverId === currentUser.user_id)
    )

    let subtitle = 'Not connected'
    let dotClass = 'offline-dot'

    if (request) {
      if (request.status === 'ACCEPTED') {
        subtitle = online ? '🟢 Online' : 'Offline'
        dotClass = online ? 'online-dot' : 'offline-dot'
      } else if (request.status === 'PENDING') {
        if (request.senderId === currentUser.user_id) {
          subtitle = '⏳ Request Pending'
          dotClass = 'offline-dot'
        } else {
          subtitle = '👋 Wants to Connect'
          dotClass = 'online-dot'
        }
      } else if (request.status === 'DECLINED') {
        subtitle = '❌ Request Declined'
        dotClass = 'offline-dot'
      }
    }

    return (
      <div key={user.user_id} className={`sidebar-item ${isActive(target) ? 'active' : ''}`} onClick={() => onSelectChat(target)}>
        <div className="item-avatar" style={{ background: getColor(user.user_id) }}>
          {getInitial(user.username)}
        </div>
        <div className="item-info">
          <div className="item-name">{user.username}</div>
          <div className="item-preview">{subtitle}</div>
        </div>
        <div className={dotClass} />
      </div>
    )
  }

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">💬 ChatterBox</div>
        <div className="user-info">
          <span className="username-display">{currentUser.username}</span>
          <div className="avatar" style={{ background: getColor(currentUser.user_id) }}>
            {getInitial(currentUser.username)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          👤 People
        </button>
        <button className={`sidebar-tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
          👥 Groups
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <input
          className="clay-input"
          placeholder={tab === 'users' ? '🔍 Find new friends by username...' : '🔍 Search groups...'}
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="sidebar-list">
        {tab === 'users' ? (
          searchQuery.trim() !== '' ? (
            // Search Results Mode
            searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No matching users found
              </div>
            ) : (
              <>
                <div className="sidebar-section-header">🔍 Search Results</div>
                {searchResults.map(user => renderUserItem(user))}
              </>
            )
          ) : (
            // Default Mode: Friends & Incoming
            <>
              {incomingUsers.length > 0 && (
                <>
                  <div className="sidebar-section-header">👋 Incoming Requests</div>
                  {incomingUsers.map(user => renderUserItem(user))}
                </>
              )}

              <div className="sidebar-section-header" style={{ marginTop: incomingUsers.length > 0 ? '16px' : '0' }}>👥 Friends</div>
              {users.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                  No friends connected yet.<br />Search usernames above to find friends!
                </div>
              ) : (
                users.map(user => renderUserItem(user))
              )}
            </>
          )
        ) : (
          <>
            <div style={{ padding: '4px 4px 12px' }}>
              <button className="clay-btn clay-btn-primary clay-btn-sm" style={{ width: '100%' }} onClick={onCreateGroup}>
                ➕ Create New Group
              </button>
            </div>
            {filteredGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No groups yet
              </div>
            ) : (
              filteredGroups.map(group => {
                const target: ChatTarget = { type: 'group', group }
                return (
                  <div key={group.group_id} className={`sidebar-item ${isActive(target) ? 'active' : ''}`} onClick={() => onSelectChat(target)}>
                    <div className="item-avatar" style={{ background: getColor(group.group_id + 100) }}>
                      {getInitial(group.name)}
                    </div>
                    <div className="item-info">
                      <div className="item-name">{group.name}</div>
                      <div className="item-preview">{group.members?.length || 0} members</div>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="clay-btn clay-btn-sm" style={{ width: '100%' }} onClick={onLogout}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  )
}
