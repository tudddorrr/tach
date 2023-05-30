type Props = {
  columns: string[]
}

export default function TableHeader({ columns }: Props) {
  return (
    <thead className='bg-slate-600 text-white font-semibold'>
      <tr>
        {columns.map((col, idx) => (
          <th key={idx} className='p-4 text-left'>{col}</th>
        ))}
      </tr>
    </thead>
  )
}
