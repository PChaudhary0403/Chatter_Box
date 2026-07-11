import { useState } from 'react'
import type { User } from '../pages/ChatPage'

interface Props {
  users: User[]
  onCreate: (name: string, description: string, memberIds: number[]) => void
  onClose: () => void
}

export default function CreateGroupModal({ users, onCreate, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate(name.trim(), description.trim(), [...selectedIds])
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal clay-card-raised" onClick={e => e.stopPropagation()}>
        <h2>👥 Create Group</h2>

        <div className="field">
          <label>Group Name</label>
          <input className="clay-input" placeholder="e.g. Project Alpha" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>

        <div className="field">
          <label>Description (optional)</label>
          <input className="clay-input" placeholder="What's this group about?" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="field">
          <label>Add Members ({selectedIds.size} selected)</label>
          <div className="member-list clay-inset" style={{ padding: 8 }}>
            {users.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No other users available
              </div>
            ) : (
              users.map(user => (
                <div key={user.user_id} className={`member-item ${selectedIds.has(user.user_id) ? 'selected' : ''}`} onClick={() => toggle(user.user_id)}>
                  <div className="check">{selectedIds.has(user.user_id) ? '✓' : ''}</div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{user.username}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="clay-btn clay-btn-sm" onClick={onClose}>Cancel</button>
          <button className="clay-btn clay-btn-primary clay-btn-sm" onClick={handleCreate} disabled={!name.trim()}>
            ✨ Create Group
          </button>
        </div>
      </div>
    </div>
  )
}
