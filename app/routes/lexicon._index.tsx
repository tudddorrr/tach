import type { ActionArgs, LoaderArgs, V2_MetaFunction} from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, useLoaderData, useNavigation, useSubmit } from '@remix-run/react'
import Button from '~/components/Button'
import Link from '~/components/Link'
import type { LexiconTable} from '~/models/lexicon_table.server';
import { updateTableDescription } from '~/models/lexicon_table.server';
import { scan } from '~/models/lexicon_table.server';
import { getTables } from '~/models/lexicon_table.server'
import Table from '~/components/tables/Table'
import TableBody from '~/components/tables/TableBody'
import TableCell from '~/components/tables/TableCell'
import { useDebouncedCallback } from 'use-debounce'
import { useCallback } from 'react'

export const meta: V2_MetaFunction = () => {
  return [{ title: 'Lexicon | Tach' }]
}

export async function loader(args: LoaderArgs) {
  return json({ tables: await getTables(args) })
}

export async function action(args: ActionArgs) {
  if (args.request.method === 'POST') {
    return json({ tables: await scan() })
  } else if (args.request.method === 'PUT') {
    return json({ tables: await updateTableDescription(args) })
  }
}

export default function Lexicon() {
  const { tables } = useLoaderData<typeof loader>()

  const navigation = useNavigation()
  const submit = useSubmit()

  const updateDescription = useCallback((table: LexiconTable, value: string) => {
    const formData = new FormData()
    formData.set('tableName', table.table_name)
    formData.set('description', value)
    submit(formData, { method: 'PUT' })
  }, [submit])

  const debouncedUpdateDescription = useDebouncedCallback(updateDescription, 500)

  return (
    <div className='p-8 space-y-8'>
      <h1 className='text-2xl font-bold'>Lexicon</h1>
      <Link to='..'>Home</Link>

      {tables.length === 0 && <p>No tables</p>}
      {tables.length > 0 &&
        <Table columns={['Name', 'Description', '']}>
          <TableBody<LexiconTable> iterator={tables}>
            {(table) => (
              <>
                <TableCell className='w-1/3'>{table.table_name}</TableCell>
                <TableCell>
                  <input
                    defaultValue={table.description ?? ''}
                    onChange={(e) => debouncedUpdateDescription(table, e.target.value)}
                    className='w-full border border-gray-300 rounded p-2'
                    placeholder='Description'
                  />
                </TableCell>
                <TableCell className='text-right'>
                  <Link
                    className='text-white font-normal bg-emerald-500 hover:bg-emerald-600 hover:no-underline px-4 py-2 rounded transition-colors'
                    to={`/lexicon/${table.table_name}`}
                  >
                    View columns
                  </Link>
                </TableCell>
              </>
            )}
          </TableBody>
        </Table>
      }

      <Form method='POST'>
        <Button
            disabled={navigation.state !== 'idle'}
          >
            {navigation.state !== 'idle' && 'Loading...'}
            {navigation.state === 'idle' && 'Scan'}
          </Button>
      </Form>
    </div>
  )
}
