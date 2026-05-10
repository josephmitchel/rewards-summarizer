import './Button.css'

export default function Button({
  variant = 'secondary',
  as: Component = 'button',
  className,
  children,
  ...rest
}) {
  const classes = ['button', `button--${variant}`, className].filter(Boolean).join(' ')
  const typeProp = Component === 'button' && rest.type == null ? { type: 'button' } : null
  return (
    <Component className={classes} {...typeProp} {...rest}>
      {children}
    </Component>
  )
}
