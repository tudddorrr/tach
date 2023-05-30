import type { ReactNode } from 'react'
import TableHeader from './TableHeader'

type Props = {
  columns: string[]
  children: ReactNode
}

export default function Table({ columns, children }: Props) {
  return (
    <div className='overflow-x-scroll'>
      <table className='table-auto w-full'>
        <TableHeader columns={columns} />
        {children}
      </table>
    </div>
  )
}
