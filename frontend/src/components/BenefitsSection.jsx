import { useState } from 'react'
import { getResetDate } from '../utils/rewards'

export default function BenefitsSection({ benefits, selectedPeriod, onUsedChange, title = 'Benefits' }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')

  if (!benefits?.length) return null

  const startEdit = (benefit) => {
    setEditingId(benefit._id)
    setDraft(String(benefit.used))
  }

  const commit = async (benefit) => {
    setEditingId(null)
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed === benefit.used) return
    await onUsedChange?.(benefit, parsed)
  }

  return (
    <>
      <h3>{title}</h3>
      {benefits.map(benefit => {
        const resetDate = getResetDate(benefit.periodType, selectedPeriod)
        const isManual = benefit.trackingType === 'manual'
        const isEditing = editingId === benefit._id
        return (
          <p key={benefit.benefitId}>
            <strong>{benefit.name}</strong>:{' '}
            {isEditing ? (
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => commit(benefit)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commit(benefit)
                  else if (e.key === 'Escape') setEditingId(null)
                }}
                style={{ width: '6em' }}
              />
            ) : (
              <span
                onClick={isManual ? () => startEdit(benefit) : undefined}
                style={isManual ? { cursor: 'pointer', textDecoration: 'underline dotted' } : undefined}
              >
                ${benefit.used.toFixed(2)}
              </span>
            )}
            {' '}/ ${benefit.total}{resetDate ? ` — resets ${resetDate}` : ''}
          </p>
        )
      })}
    </>
  )
}
