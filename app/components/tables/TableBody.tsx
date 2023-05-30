import type { ClassValue } from 'clsx';
import clsx from 'clsx'
import type { ReactNode } from 'react'

type Props<T> = {
  iterator: T[]
  children: (iteraee: T, idx: number) => ReactNode
  startIdx: number
  configureClassNames?: (iteraee: T, idx: number) => ClassValue[]
}

export default function TableBody<T>({ iterator, children, startIdx, configureClassNames }: Props<T>) {
  return (
    <tbody>
      {iterator.map((iteraee, idx) => (
        <tr
          key={idx}
          className={clsx({
            'bg-slate-300': (startIdx + idx) % 2 !== 0,
            'bg-slate-200': (startIdx + idx) % 2 === 0,
            ...configureClassNames?.(iteraee, startIdx + idx)
          })}
        >
          {children(iteraee, idx)}
        </tr>
      ))}
    </tbody>
  )
}

TableBody.defaultProps = {
  startIdx: 0
}
