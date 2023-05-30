import clsx from 'clsx'
import type { ReactNode } from 'react'

type Props = {
  className?: string
  children: ReactNode
}

export default function TableCell({ className, children }: Props) {
  return (
    <td
      className={clsx(
        'p-4',
        className,
        {
          'min-w-40': !className?.startsWith('min-w-')
        }
      )}
    >
      {children}
    </td>
  )
}
