import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

export default function Button({ className, children, ...rest }: ButtonHTMLAttributes<any>) {
  return (
    <button className={clsx('px-4 py-2 bg-slate-500 hover:bg-slate-600 disabled:bg-slate-400 text-white rounded transition-colors', className)} {...rest}>
      {children}
    </button>
  )
}
