import type { ActionArgs, LoaderArgs, V2_MetaFunction} from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, useActionData, useLoaderData, useLocation, useNavigation } from '@remix-run/react'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import Button from '~/components/Button'
import Link from '~/components/Link'
import { getTables } from '~/models/lexicon_table.server'
import { getQueryFromPromptAndExecute } from '~/models/openai_log.server'

export const meta: V2_MetaFunction = () => {
  return [{ title: 'Query | Tach' }]
}

export async function loader(args: LoaderArgs) {
  return json({ tables: await getTables(args) })
}

export async function action(args: ActionArgs) {
  return await getQueryFromPromptAndExecute(args)
}

const TAB_RESULTS = 0
const TAB_QUERY = 1

export default function Index() {
  const { tables } = useLoaderData<typeof loader>()
  const results = useActionData<typeof action>()
  const navigation = useNavigation()

  const [tab, setTab] = useState(TAB_RESULTS)
  const [copied, setCopied] = useState(false)

  const location = useLocation()

  const prompt = useMemo(() => {
    return new URLSearchParams(location.search).get('prompt') ?? ''
  }, [location.search])

  const selectedTables = useMemo(() => {
    return (new URLSearchParams(location.search).get('tables') ?? '').split(',')
  }, [location.search])

  useEffect(() => {
    setTab(TAB_RESULTS)
    setCopied(false)
  }, [results])

  return (
    <div className='flex'>
      <div className='w-1/2 h-screen p-8'>
        <Form method='POST' className='space-y-8'>
          <div>
            <div>
              <label htmlFor='prompt' className='font-medium'>Prompt</label>
              <textarea
                id='prompt'
                rows={3}
                name='prompt'
                className='block w-full border border-gray-300 rounded mt-2 p-2'
                defaultValue={prompt}
                placeholder='e.g. number of users since the start of the year'
              />
            </div>

            <div className='mt-4'>
              <Link to='/history'>Prompt history</Link>
            </div>
          </div>

          <div>
            <fieldset>
              <p className='font-medium'>Tables</p>
              <div className='mt-2 overflow-y-scroll max-h-96 rounded'>
                {tables.length === 0 && <p>No tables found - run the Scan tool from the Lexicon</p>}
                {tables.map((table, idx) => (
                  <label key={table.table_name} className={clsx('cursor-pointer p-4 flex flex-row items-center gap-4', {
                    'bg-slate-300': idx % 2 !== 0,
                    'bg-slate-200': idx % 2 === 0,
                  })}>
                    <input
                      type='checkbox'
                      name='tables'
                      className='w-4 h-4'
                      value={table.table_name}
                      defaultChecked={selectedTables.includes(table.table_name)}
                    />
                    {table.table_name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className='mt-4'>
              <Link to='/lexicon'>Lexicon</Link>
            </div>
          </div>

          <Button
            disabled={navigation.state !== 'idle'}
          >
            {navigation.state !== 'idle' && 'Loading...'}
            {navigation.state === 'idle' && 'Submit'}
          </Button>
        </Form>
      </div>
      <div className='w-1/2 bg-slate-200 flex flex-col'>
        {!results && <pre className='p-8 grow'>Waiting...</pre>}
        {results && tab === TAB_RESULTS && <pre className='p-8 grow whitespace-pre-wrap max-h-screen overflow-y-scroll'>{results.data.csv}</pre>}
        {results && tab === TAB_QUERY && <pre className='p-8 grow whitespace-pre-wrap'>{results.query}</pre>}

        {results &&
          <>
            {tab === TAB_RESULTS &&
              <div className='fixed top-0 right-0'>
                <Button
                  type='button'
                  className='rounded-none p-4 bg-slate-500 text-white'
                  onClick={() => {
                    navigator.clipboard.writeText(results.data.csv)
                    setCopied(true)
                  }}
                >
                  {copied ? 'Copied' :  'Copy CSV'}
                </Button>
              </div>
            }
            <div className='flex fixed bottom-0 right-0'>
              <Button
                type='button'
                className={clsx('rounded-none p-4 bg-slate-500 text-white', { 'bg-slate-600': tab === TAB_RESULTS })}
                onClick={() => setTab(TAB_RESULTS)}
              >
                Results
              </Button>
              <Button
                type='button'
                className={clsx('rounded-none p-4 bg-slate-500 text-white', { 'bg-slate-600': tab === TAB_QUERY })}
                onClick={() => setTab(TAB_QUERY)}
              >
                Query
              </Button>
            </div>
          </>
        }
      </div>
    </div>
  )
}
