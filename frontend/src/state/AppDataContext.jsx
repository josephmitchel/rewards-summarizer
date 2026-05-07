import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { AppDataContext } from './context'
import { periodKeyToPeriod, periodToKey, periodToQuery } from './period'

const initialPeriod = () => {
  const now = new Date()
  return { mode: 'month', year: now.getFullYear(), month: now.getMonth() }
}

export function AppDataProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [accountCache, setAccountCache] = useState({})
  const [benefitsCache, setBenefitsCache] = useState({})
  const [txnRange, setTxnRange] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod)
  const [removeStatus, setRemoveStatus] = useState({})
  const [linkToken, setLinkToken] = useState(null)

  const pendingOpen = useRef(false)
  const inFlight = useRef(new Set())
  const benefitsInFlight = useRef(new Set())

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setItems([])
    setAccounts([])
    setAccountCache({})
    setBenefitsCache({})
    setTxnRange(null)
    setRemoveStatus({})
  }, [])

  const authedFetch = useCallback(async (input, init = {}) => {
    const res = await fetch(input, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) {
      logout()
      return null
    }
    return res
  }, [token, logout])

  const onPlaidSuccess = useCallback(async (publicToken) => {
    const res = await authedFetch('/api/item/public_token/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `public_token=${publicToken}`,
    })
    if (!res || !res.ok) {
      console.error('Failed to link account')
    }
  }, [authedFetch])

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({ token: linkToken, onSuccess: onPlaidSuccess })

  useEffect(() => {
    if (plaidReady && pendingOpen.current) {
      pendingOpen.current = false
      openPlaid()
    }
  }, [plaidReady, openPlaid])

  // Initial load when token changes. setState fires inside async callbacks, which
  // is the standard fetch-on-mount pattern; React 19's strict rule flags it but
  // there's no idiomatic alternative without adding a query library.
  useEffect(() => {
    if (!token) return
    let cancelled = false

    /* eslint-disable react-hooks/set-state-in-effect */
    authedFetch('/api/items')
      .then(r => r?.json())
      .then(data => { if (data && !cancelled) setItems(data.items ?? []) })
      .catch(() => console.error('Failed to fetch items'))

    authedFetch('/api/accounts')
      .then(r => r?.json())
      .then(data => { if (data && !cancelled) setAccounts(data.accounts ?? []) })
      .catch(() => console.error('Failed to fetch accounts'))

    authedFetch('/api/transactions/range')
      .then(r => r?.json())
      .then(data => {
        if (cancelled || !data) return
        if (!data.earliest || !data.latest) { setTxnRange(null); return }
        const [ey, em] = data.earliest.split('-').map(Number)
        const [ly, lm] = data.latest.split('-').map(Number)
        setTxnRange({
          earliest: { year: ey, month: em - 1 },
          latest: { year: ly, month: lm - 1 },
        })
      })
      .catch(() => console.error('Failed to fetch transaction range'))
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => { cancelled = true }
  }, [token, authedFetch])

  const accountBounds = useMemo(() => {
    const map = {}
    for (const a of accounts) {
      const txns = accountCache[a.accountId]?.transactions
      if (!txns?.length) continue
      let earliest = null, latest = null
      for (const t of txns) {
        const d = t.plaidTransaction.authorized_date
        if (!d) continue
        if (!earliest || d < earliest) earliest = d
        if (!latest || d > latest) latest = d
      }
      if (!earliest || !latest) continue
      const [ey, em] = earliest.split('-').map(Number)
      const [ly, lm] = latest.split('-').map(Number)
      map[a.accountId] = {
        earliest: { year: ey, month: em - 1 },
        latest: { year: ly, month: lm - 1 },
      }
    }
    return map
  }, [accounts, accountCache])

  const ensureAccountData = useCallback((accountIds) => {
    if (!token) return
    const toFetch = accountIds.filter(id => id && !accountCache[id] && !inFlight.current.has(id))
    if (toFetch.length === 0) return

    for (const id of toFetch) {
      inFlight.current.add(id)
      Promise.all([
        authedFetch(`/api/accounts/${id}/transactions`).then(r => r?.json()),
        authedFetch(`/api/accounts/${id}/card`).then(r => r?.json()),
      ]).then(([txnData, cardData]) => {
        if (!txnData || !cardData) return
        setAccountCache(prev => ({
          ...prev,
          [id]: {
            transactions: txnData.transactions ?? [],
            card: cardData.card ?? null,
          },
        }))
      }).catch(() => console.error('Failed to fetch account data for', id))
        .finally(() => { inFlight.current.delete(id) })
    }
  }, [token, accountCache, authedFetch])

  const ensureBenefits = useCallback((accountIds, period) => {
    if (!token) return
    const key = periodToKey(period)
    const query = periodToQuery(period)
    for (const id of accountIds) {
      if (!id) continue
      if (benefitsCache[id]?.[key]) continue
      const flightKey = `${id}:${key}`
      if (benefitsInFlight.current.has(flightKey)) continue
      benefitsInFlight.current.add(flightKey)
      authedFetch(`/api/accounts/${id}/benefits?${query}`)
        .then(r => r?.json())
        .then(data => {
          if (!data) return
          setBenefitsCache(prev => ({
            ...prev,
            [id]: { ...(prev[id] ?? {}), [key]: data.benefits ?? [] },
          }))
        })
        .catch(() => console.error('Failed to fetch benefits for', id))
        .finally(() => { benefitsInFlight.current.delete(flightKey) })
    }
  }, [token, benefitsCache, authedFetch])

  const linkBankAccount = useCallback(async () => {
    const res = await authedFetch('/api/link/token/create', { method: 'POST' })
    if (!res || !res.ok) { console.error('Failed to create link token'); return }
    const data = await res.json()
    if (data.error != null) { console.error('Error creating link token:', data.error); return }
    pendingOpen.current = true
    setLinkToken(data.link_token)
  }, [authedFetch])

  const syncTransactions = useCallback(async () => {
    const res = await authedFetch('/api/transactions/sync', { method: 'POST' })
    if (!res || !res.ok) { console.error('Failed to sync transactions'); return }
    const data = await res.json()
    console.log(`Synced ${data.synced} transactions`)
    setAccountCache({})
    setBenefitsCache({})
  }, [authedFetch])

  const reprocessTransactions = useCallback(async () => {
    const res = await authedFetch('/api/transactions/reprocess', { method: 'POST' })
    if (!res || !res.ok) { console.error('Failed to reprocess transactions'); return }
    const data = await res.json()
    console.log(`Reprocessed ${data.reprocessed} transactions`)
    setAccountCache({})
    setBenefitsCache({})
  }, [authedFetch])

  const removeItem = useCallback(async (itemId) => {
    const res = await authedFetch(`/api/items/${itemId}`, { method: 'DELETE' })
    if (!res) return
    const data = await res.json()
    if (!res.ok) {
      setRemoveStatus(prev => ({ ...prev, [itemId]: { ok: false } }))
      return
    }
    setRemoveStatus(prev => ({ ...prev, [itemId]: { ok: true, requestId: data.request_id } }))
  }, [authedFetch])

  const updateTransactionCategory = useCallback(async (txn, newCategory) => {
    const res = await authedFetch(`/api/transactions/${txn.transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newCategory }),
    })
    if (!res || !res.ok) { console.error('Failed to update category'); return }
    const data = await res.json()
    const updated = data.transaction
    setAccountCache(prev => {
      const cached = prev[updated.accountId]
      if (!cached) return prev
      return {
        ...prev,
        [updated.accountId]: {
          ...cached,
          transactions: cached.transactions.map(t =>
            t.transactionId === updated.transactionId ? updated : t
          ),
        },
      }
    })
    const affected = benefitsCache[updated.accountId]
    if (affected) {
      for (const periodKey of Object.keys(affected)) {
        const period = periodKeyToPeriod(periodKey)
        const query = periodToQuery(period)
        authedFetch(`/api/accounts/${updated.accountId}/benefits?${query}`)
          .then(r => r?.json())
          .then(d => {
            if (!d) return
            setBenefitsCache(prev => ({
              ...prev,
              [updated.accountId]: {
                ...(prev[updated.accountId] ?? {}),
                [periodKey]: d.benefits ?? [],
              },
            }))
          })
          .catch(() => console.error('Failed to refresh benefits for', updated.accountId))
      }
    }
  }, [authedFetch, benefitsCache])

  const updateBenefitUsed = useCallback(async (benefit, used) => {
    const res = await authedFetch(`/api/benefits/${benefit._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ used }),
    })
    if (!res || !res.ok) { console.error('Failed to update benefit'); return }
    setBenefitsCache(prev => {
      const forAccount = prev[benefit.accountId]
      if (!forAccount) return prev
      const next = {}
      for (const [k, list] of Object.entries(forAccount)) {
        next[k] = list.map(b => b._id === benefit._id ? { ...b, used } : b)
      }
      return { ...prev, [benefit.accountId]: next }
    })
  }, [authedFetch])

  const value = useMemo(() => ({
    token,
    login,
    logout,
    items,
    accounts,
    accountCache,
    benefitsCache,
    txnRange,
    accountBounds,
    selectedPeriod,
    setSelectedPeriod,
    removeStatus,
    ensureAccountData,
    ensureBenefits,
    linkBankAccount,
    syncTransactions,
    reprocessTransactions,
    removeItem,
    updateTransactionCategory,
    updateBenefitUsed,
  }), [
    token, login, logout, items, accounts, accountCache, benefitsCache,
    txnRange, accountBounds, selectedPeriod, removeStatus,
    ensureAccountData, ensureBenefits, linkBankAccount, syncTransactions,
    reprocessTransactions, removeItem, updateTransactionCategory, updateBenefitUsed,
  ])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
