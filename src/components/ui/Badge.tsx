interface BadgeProps {
  variant: 'paid' | 'refunded'
  children: React.ReactNode
}

export function Badge({ variant, children }: BadgeProps) {
  const cls =
    variant === 'refunded'
      ? 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800'
      : 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800'

  return <span className={cls}>{children}</span>
}
