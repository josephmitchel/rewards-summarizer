import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Login from './Login'
import Register from './Register'
import AccountPage from './AccountPage'
import HomePage from './HomePage'
import './App.css'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [screen, setScreen] = useState('login');
  const [linkToken, setLinkToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([]);
  const [view, setView] = useState('home'); // 'home' | accountId
  const [removeStatus, setRemoveStatus] = useState({}); // { [itemId]: { ok, requestId? } }
  const [accountCache, setAccountCache] = useState({}); // { [accountId]: { transactions, card } }
  const [benefitsCache, setBenefitsCache] = useState({}); // { [accountId]: { [periodKey]: benefits[] } }
  const [txnRange, setTxnRange] = useState(null); // { earliest: {year,month}, latest: {year,month} } | null
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return { mode: 'month', year: now.getFullYear(), month: now.getMonth() }
  });
  const pendingOpen = useRef(false);
  const inFlight = useRef(new Set());
  const benefitsInFlight = useRef(new Set()); // `${accountId}:${periodKey}`
  // Clamp selectedPeriod to the active view's bounds. Prevents being stuck on
  // a month the current account doesn't have data for (e.g. switching from an
  // older card to a newer one).
  const clampToBounds = (period, bounds) => {
    if (!bounds) return period;
    const { earliest, latest } = bounds;
    if (period.mode === 'year') {
      if (period.year < earliest.year) return { ...period, year: earliest.year };
      if (period.year > latest.year) return { ...period, year: latest.year };
      return period;
    }
    if (period.year < earliest.year || (period.year === earliest.year && period.month < earliest.month)) {
      return { ...period, year: earliest.year, month: earliest.month };
    }
    if (period.year > latest.year || (period.year === latest.year && period.month > latest.month)) {
      return { ...period, year: latest.year, month: latest.month };
    }
    return period;
  };

  // Per-account bounds derived from the cached transactions. Accounts without
  // any transactions yet won't have an entry; callers should fall back to the
  // global range in that case.
  const accountBounds = useMemo(() => {
    const map = {};
    for (const a of accounts) {
      const txns = accountCache[a.accountId]?.transactions;
      if (!txns?.length) continue;
      let earliest = null, latest = null;
      for (const t of txns) {
        const d = t.plaidTransaction.authorized_date;
        if (!d) continue;
        if (!earliest || d < earliest) earliest = d;
        if (!latest || d > latest) latest = d;
      }
      if (!earliest || !latest) continue;
      const [ey, em] = earliest.split('-').map(Number);
      const [ly, lm] = latest.split('-').map(Number);
      map[a.accountId] = {
        earliest: { year: ey, month: em - 1 },
        latest: { year: ly, month: lm - 1 },
      };
    }
    return map;
  }, [accounts, accountCache]);

  /**
   * Exchanges the public token for an access token, which is then stored server-side and associated with the user's account.
   */
  const onSuccess = useCallback(async (public_token) => {
    const response = await fetch("/api/item/public_token/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Authorization": `Bearer ${token}`,
      },
      body: `public_token=${public_token}`,
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to link account:", data.error);
      return;
    }
    console.log("Access token saved:", data);
    window.history.pushState("", "", "/");
  }, [token]);

  // Plaid API variables
  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  // Automatically open Plaid Link when the link token is ready
  useEffect(() => {
    if (ready && pendingOpen.current) {
      pendingOpen.current = false;
      open();
    }
  }, [ready, open]);

  // Logs the user out by clearing the token from localStorage and resetting state
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  useEffect(() => {
    if (!token) return;
    const headers = { "Authorization": `Bearer ${token}` };

    fetch("/api/items", { headers })
      .then(res => { if (res.status === 401) { logout(); return null; } return res.json(); })
      .then(data => { if (data) setItems(data.items ?? []); })
      .catch(() => console.error("Failed to fetch items"));

    fetch("/api/accounts", { headers })
      .then(res => { if (res.status === 401) { logout(); return null; } return res.json(); })
      .then(data => { if (data) setAccounts(data.accounts ?? []); })
      .catch(() => console.error("Failed to fetch accounts"));

    fetch("/api/transactions/range", { headers })
      .then(res => { if (res.status === 401) { logout(); return null; } return res.json(); })
      .then(data => {
        if (!data) return;
        if (!data.earliest || !data.latest) { setTxnRange(null); return; }
        const [ey, em] = data.earliest.split('-').map(Number);
        const [ly, lm] = data.latest.split('-').map(Number);
        setTxnRange({
          earliest: { year: ey, month: em - 1 },
          latest: { year: ly, month: lm - 1 },
        });
      })
      .catch(() => console.error("Failed to fetch transaction range"));
  }, [token]);

  /**
   * Calls the server to create a Plaid Link token for the user,
   * which opens up the Plaid Link so the user can link their bank accounts.
   */
  const linkBankAccount = async () => {
    const response = await fetch("/api/link/token/create", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) { console.error("Failed to create link token"); return; }
    const data = await response.json();
    if (data.error != null) { console.error("Error creating link token:", data.error); return; }
    pendingOpen.current = true;
    setLinkToken(data.link_token);
  };

  /**
   * Calls the server to sync transactions for all of the user's linked items
   */
  const syncTransactions = useCallback(async () => {
    const response = await fetch("/api/transactions/sync", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) { console.error("Failed to sync transactions"); return; }
    const data = await response.json();
    console.log(`Synced ${data.synced} transactions`);
    setAccountCache({});
    setBenefitsCache({});
  }, [token]);

  // Fetch transactions and card data for accounts required by the current view.
  // Home view prefetches all accounts; account view fetches one.
  useEffect(() => {
    if (!token) return;
    const ids = view === 'home' ? accounts.map(a => a.accountId) : [view];
    const toFetch = ids.filter(id => id && !accountCache[id] && !inFlight.current.has(id));
    if (toFetch.length === 0) return;

    const headers = { "Authorization": `Bearer ${token}` };
    for (const id of toFetch) {
      inFlight.current.add(id);
      Promise.all([
        fetch(`/api/accounts/${id}/transactions`, { headers }).then(r => r.json()),
        fetch(`/api/accounts/${id}/card`, { headers }).then(r => r.json()),
      ]).then(([txnData, cardData]) => {
        setAccountCache(prev => ({
          ...prev,
          [id]: {
            transactions: txnData.transactions ?? [],
            card: cardData.card ?? null,
          },
        }));
      }).catch(() => console.error("Failed to fetch account data for", id))
        .finally(() => { inFlight.current.delete(id); });
    }
  }, [view, token, accounts, accountCache]);

  // Effective period for the active view — clamps to the view's bounds so
  // switching from a longer-held card to a newer one doesn't leave us on a
  // month that newer card doesn't cover. selectedPeriod stays as the raw choice
  // from the selector; downstream consumers use effectivePeriod.
  const activeBounds = view === 'home' ? txnRange : (accountBounds[view] ?? txnRange);
  const effectivePeriod = useMemo(
    () => clampToBounds(selectedPeriod, activeBounds),
    [selectedPeriod, activeBounds]
  );
  const periodKey = effectivePeriod.mode === 'year'
    ? `y:${effectivePeriod.year}`
    : `m:${effectivePeriod.year}-${effectivePeriod.month}`;
  const benefitsQuery = effectivePeriod.mode === 'year'
    ? `mode=year&year=${effectivePeriod.year}`
    : `mode=month&year=${effectivePeriod.year}&month=${effectivePeriod.month}`;

  // Fetch benefit usage for the accounts needed by the current view and period.
  useEffect(() => {
    if (!token) return;
    const ids = view === 'home' ? accounts.map(a => a.accountId) : [view];
    const headers = { "Authorization": `Bearer ${token}` };
    for (const id of ids) {
      if (!id) continue;
      const key = `${id}:${periodKey}`;
      if (benefitsCache[id]?.[periodKey]) continue;
      if (benefitsInFlight.current.has(key)) continue;
      benefitsInFlight.current.add(key);
      fetch(`/api/accounts/${id}/benefits?${benefitsQuery}`, { headers })
        .then(r => r.json())
        .then(data => {
          setBenefitsCache(prev => ({
            ...prev,
            [id]: { ...(prev[id] ?? {}), [periodKey]: data.benefits ?? [] },
          }));
        })
        .catch(() => console.error("Failed to fetch benefits for", id))
        .finally(() => { benefitsInFlight.current.delete(key); });
    }
  }, [view, token, accounts, benefitsCache, periodKey, benefitsQuery]);

  /**
   * Updates a single transaction's category on the server and refreshes the cache.
   */
  const updateTransactionCategory = useCallback(async (txn, newCategory) => {
    const response = await fetch(`/api/transactions/${txn.transactionId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newCategory }),
    });
    if (!response.ok) { console.error('Failed to update category'); return; }
    const data = await response.json();
    const updated = data.transaction;
    setAccountCache(prev => {
      const cached = prev[updated.accountId];
      if (!cached) return prev;
      return {
        ...prev,
        [updated.accountId]: {
          ...cached,
          transactions: cached.transactions.map(t =>
            t.transactionId === updated.transactionId ? updated : t
          ),
        },
      };
    });
    fetch(`/api/accounts/${updated.accountId}/benefits?${benefitsQuery}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setBenefitsCache(prev => ({
          ...prev,
          [updated.accountId]: {
            ...(prev[updated.accountId] ?? {}),
            [periodKey]: data.benefits ?? [],
          },
        }));
      })
      .catch(() => console.error('Failed to refresh benefits for', updated.accountId));
  }, [token, periodKey, benefitsQuery]);

  /**
   * Update a manually-tracked benefit's `used` amount and refresh the cache entry in place.
   */
  const updateBenefitUsed = useCallback(async (benefit, used) => {
    const response = await fetch(`/api/benefits/${benefit._id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ used }),
    });
    if (!response.ok) { console.error('Failed to update benefit'); return; }
    setBenefitsCache(prev => {
      const forAccount = prev[benefit.accountId];
      const forPeriod = forAccount?.[periodKey];
      if (!forPeriod) return prev;
      return {
        ...prev,
        [benefit.accountId]: {
          ...forAccount,
          [periodKey]: forPeriod.map(b => b._id === benefit._id ? { ...b, used } : b),
        },
      };
    });
  }, [token, periodKey]);

  /**
   * Helper method to simulate processing transactions through the same logic as when they are first ingested from Plaid.
   */
  const reprocessTransactions = useCallback(async () => {
    const response = await fetch("/api/transactions/reprocess", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) { console.error("Failed to reprocess transactions"); return; }
    const data = await response.json();
    console.log(`Reprocessed ${data.reprocessed} transactions`);
    setAccountCache({});
    setBenefitsCache({});
  }, [token]);

  /**
   * Helper method for removing specific Plaid items
   */
  const removeItem = useCallback(async (itemId) => {
    const response = await fetch(`/api/items/${itemId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setRemoveStatus(prev => ({ ...prev, [itemId]: { ok: false } }));
      return;
    }
    setRemoveStatus(prev => ({ ...prev, [itemId]: { ok: true, requestId: data.request_id } }));
  }, [token]);

  if (!token) {
    if (screen === 'register') return <Register onRegister={() => setScreen('login')} />;
    return <Login onLogin={setToken} onShowRegister={() => setScreen('register')} />;
  }

  return (
    <div className="app">
      <button onClick={() => setView('home')}>Home</button>
      <button onClick={linkBankAccount}>Link Bank Account</button>
      <button onClick={syncTransactions}>Get Transactions</button>
      <button onClick={reprocessTransactions}>Reprocess Transactions</button>
      <button onClick={logout}>Log Out</button>
      <div>
        {items.map(item => (
          <div key={item.itemId}>
            <strong>{item.institutionName || item.itemId}</strong>
            <button onClick={() => removeItem(item.itemId)}>Remove from Plaid</button>
            {removeStatus[item.itemId]?.ok && (
              <span>Removed. request_id: {removeStatus[item.itemId].requestId}</span>
            )}
            {removeStatus[item.itemId]?.ok === false && (
              <span>Failed to remove item.</span>
            )}
            {accounts.filter(a => a.itemId === item.itemId).map(account => (
              <button
                key={account.accountId}
                onClick={() => setView(account.accountId)}
              >
                {account.name} ({account.subtype})
              </button>
            ))}
          </div>
        ))}
      </div>

      {view === 'home' ? (
        <HomePage
          accounts={accounts}
          accountCache={accountCache}
          benefitsByAccount={Object.fromEntries(
            accounts.map(a => [a.accountId, benefitsCache[a.accountId]?.[periodKey] ?? []])
          )}
          selectedPeriod={effectivePeriod}
          bounds={txnRange}
          onPeriodChange={setSelectedPeriod}
          onCategoryChange={updateTransactionCategory}
          onBenefitUsedChange={updateBenefitUsed}
        />
      ) : (
        <AccountPage
          account={accounts.find(a => a.accountId === view) ?? null}
          cachedData={accountCache[view] ?? null}
          benefits={benefitsCache[view]?.[periodKey] ?? []}
          selectedPeriod={effectivePeriod}
          bounds={accountBounds[view] ?? txnRange}
          onPeriodChange={setSelectedPeriod}
          onCategoryChange={updateTransactionCategory}
          onBenefitUsedChange={updateBenefitUsed}
        />
      )}
    </div>
  )
}
