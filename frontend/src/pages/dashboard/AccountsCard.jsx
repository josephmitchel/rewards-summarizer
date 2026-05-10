import { Link } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import Card from '../../components/ui/Card'
import { useAppData } from '../../state/useAppData'
import './AccountsCard.css'

export default function AccountsCard() {
  const { accounts, items, linkBankAccount } = useAppData()

  const creditCards = accounts.filter(a => a.type === 'credit')
  const totalBalance = creditCards.reduce((sum, a) => sum + (a.balances?.current ?? 0), 0)

  const itemByItemId = Object.fromEntries(
    items.map(i => [i.itemId, i])
  )

  const linkAction = (
    <button type="button" onClick={linkBankAccount} className="accounts-card__link-action">
      Link Account
    </button>
  )

  return (
    <Card title="Accounts" action={linkAction} className="accounts-card">
      {creditCards.length === 0 ? (
        <p className="accounts-card__empty">Link a credit card to get started.</p>
      ) : (
        <>
          <div className="accounts-card__totals-row">
            <CreditCard size={24} className="accounts-card__icon" />
            <span className="accounts-card__totals-label">Card Balance</span>
            <span className="accounts-card__totals-amount">${totalBalance.toFixed(0)}</span>
          </div>

          <div className="accounts-card__divider" />

          <ul className="accounts-card__list">
            {creditCards.map(account => {
              const item = itemByItemId[account.itemId]
              const logoSrc = item?.institutionLogo ? `data:image/png;base64,${item.institutionLogo}` : null
              return (
                <li key={account.accountId}>
                  <Link to={`/spending/${account.accountId}`} className="accounts-card__row">
                    {logoSrc ? (
                      <img className="accounts-card__avatar accounts-card__avatar--logo" src={logoSrc} alt="" />
                    ) : (
                      <div className="accounts-card__avatar" aria-hidden="true" />
                    )}
                    <div className="accounts-card__row-text">
                      <div className="accounts-card__card-name">{account.name}</div>
                      <div className="accounts-card__card-meta">
                        **{account.mask}
                        {item?.institutionName ? ` | ${item.institutionName}` : ''}
                      </div>
                    </div>
                    <div className="accounts-card__amount">${(account.balances?.current ?? 0).toFixed(0)}</div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
