import type { ActionArgs, LoaderArgs, V2_MetaFunction} from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useParams, useSubmit } from '@remix-run/react'
import { useCallback } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import Link from '~/components/Link'
import Table from '~/components/tables/Table'
import TableBody from '~/components/tables/TableBody'
import TableCell from '~/components/tables/TableCell'
import type { LexiconColumn} from '~/models/lexicon_column.server';
import { updateColumnDescription } from '~/models/lexicon_column.server';
import { getColumns } from '~/models/lexicon_column.server'

export const meta: V2_MetaFunction = ({ params }) => {
  return [{ title: `${params.tableName} columns | Tach` }]
}

export async function loader(args: LoaderArgs) {
  return json({ columns: await getColumns(args) })
}

export async function action(args: ActionArgs) {
  await updateColumnDescription(args)
  return json({})
}

export default function LexiconTable() {
  const { tableName } = useParams()
  const { columns } = useLoaderData<typeof loader>()
  const submit = useSubmit()

  const updateDescription = useCallback((column: LexiconColumn, value: string) => {
    const formData = new FormData()
    formData.set('columnName', column.column_name)
    formData.set('description', value)
    submit(formData, { method: 'PUT' })
  }, [submit])

  const debouncedUpdateDescription = useDebouncedCallback(updateDescription, 500)

  return (
    <div className='p-8 space-y-8'>
      <h1 className='text-2xl font-bold'>{tableName}</h1>
      <Link to='/lexicon'>Back</Link>

      {columns.length === 0 && <p>No columns</p>}
      {columns.length > 0 &&
        <Table columns={['Name', 'Description', '']}>
          <TableBody<LexiconColumn> iterator={columns}>
            {(column) => (
              <>
                <TableCell className='w-1/3'>{column.column_name}</TableCell>
                <TableCell>
                  <input
                    defaultValue={column.description ?? ''}
                    onChange={(e) => debouncedUpdateDescription(column, e.target.value)}
                    className='w-full border border-gray-300 rounded p-2'
                    placeholder='Description'
                  />
                </TableCell>
                <TableCell><div /></TableCell>
              </>
            )}
          </TableBody>
        </Table>
      }
    </div>
  )
}
