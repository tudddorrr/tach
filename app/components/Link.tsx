import type { LinkProps} from '@remix-run/react'
import { Link as RemixLink } from '@remix-run/react'
import clsx from 'clsx'

export default function Link({ className, children, ...rest }: LinkProps) {
  return (
    <RemixLink className={clsx('text-emerald-500 font-semibold hover:underline', className)} {...rest}>
      {children}
    </RemixLink>
  )
}
