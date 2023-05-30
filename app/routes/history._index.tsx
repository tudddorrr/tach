import type { V2_MetaFunction} from '@remix-run/node';
import { json} from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import type { Selectable } from 'kysely'
import Link from '~/components/Link'
import Table from '~/components/tables/Table'
import TableBody from '~/components/tables/TableBody'
import TableCell from '~/components/tables/TableCell'
import type { OpenAILog} from '~/models/openai_log.server';
import { getOpenAILogs } from '~/models/openai_log.server';

export const meta: V2_MetaFunction = () => {
  return [{ title: 'Query history | Tach' }]
}

export async function loader() {
  return json({ logs: await getOpenAILogs() })
}

export default function History() {
  const { logs } = useLoaderData<typeof loader>()

  return (
    <div className='p-8 space-y-8'>
      <h1 className='text-2xl font-bold'>History</h1>
      <Link to='..'>Home</Link>

      {logs.length === 0 && <p>No history</p>}
      {logs.length > 0 &&
        <Table columns={['Tables', 'Prompt', 'Last used', '']}>
          <TableBody<Selectable<OpenAILog>> iterator={logs}>
            {(log) => (
              <>
                <TableCell>
                  <span className='text-sm'>{log.tables}</span>
                </TableCell>
                <TableCell>{log.prompt}</TableCell>
                <TableCell>
                  <span className='text-sm'>{new Date(log.last_used_at).toString()}</span>
                </TableCell>
                <TableCell className='text-right'>
                  <Link
                    className='text-white font-normal bg-emerald-500 hover:bg-emerald-600 hover:no-underline px-4 py-2 rounded transition-colors'
                    to={`..?prompt=${log.prompt}&tables=${log.tables}`}
                  >
                    Prefill prompt
                  </Link>
                </TableCell>
              </>
            )}
          </TableBody>
        </Table>
      }
    </div>
  )
}
