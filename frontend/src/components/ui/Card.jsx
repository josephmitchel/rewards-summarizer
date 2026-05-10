import './Card.css'

export default function Card({ title, action, children, className }) {
  const classes = ['card', className].filter(Boolean).join(' ')
  const hasHeader = title != null || action != null
  return (
    <div className={classes}>
      {hasHeader && (
        <div className="card__header">
          {title != null && <h2 className="card__title">{title}</h2>}
          {action != null && <div className="card__action">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
