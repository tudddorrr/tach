import type { ActionArgs, LoaderArgs, V2_MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, useActionData, useLoaderData, useLocation, useNavigation } from '@remix-run/react'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import Button from '~/components/Button'
import Link from '~/components/Link'
import { getTables } from '~/models/lexicon_table.server'
import { getQueryFromPromptAndExecute } from '~/models/openai_log.server'
import Fuse from 'fuse.js'

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

  const cache = useMemo(() => {
    return new URLSearchParams(location.search).get('cache') ?? '1'
  }, [location.search])

  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  useEffect(() => {
    if (selectedTables.length === 0) {
      const urlTables = new URLSearchParams(location.search).get('tables') ?? ''
      setSelectedTables(urlTables.split(','))
    }
  }, [selectedTables, location.search])

  const [tablesSearch, setTablesSearch] = useState('')
  const tablesToShow = useMemo(() => {
    if (!tablesSearch) return tables

    const fuse = new Fuse(tables, {
      keys: ['table_name', 'description'],
      threshold: 0.4
    })

    const foundTables = fuse.search(tablesSearch).map(({ item }) => item)
    const alreadySelected = tables.filter((table) => selectedTables.includes(table.table_name))

    return [...new Set(alreadySelected.concat(foundTables))]
  }, [selectedTables, tables, tablesSearch])

  useEffect(() => {
    setTab(TAB_RESULTS)
    setCopied(false)
  }, [results])

  const toggleTable = (e: React.ChangeEvent<HTMLInputElement>, tableName: string) => {
    if (e.target.checked) {
      setSelectedTables((curr) => [...curr, tableName])
    } else {
      setSelectedTables((curr) => curr.filter((name) => name !== tableName))
    }
  }

  const sortedTables = useMemo(() => {
    let unpinnedTables = tablesToShow.filter((table) => !selectedTables.includes(table.table_name))
    if (tablesSearch.length === 0) {
      unpinnedTables = unpinnedTables.sort((a, b) => a.table_name.localeCompare(b.table_name))
    }

    return [
      ...tablesToShow.filter((table) => selectedTables.includes(table.table_name)).sort((a, b) => a.table_name.localeCompare(b.table_name)),
      ...unpinnedTables
    ]
  }, [tablesToShow, selectedTables, tablesSearch])

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
              <p className='font-medium'>Tables ({tablesToShow.length})</p>
              <input
                type='search'
                className='w-full border border-gray-300 rounded mt-2 p-2'
                placeholder='Search'
                onChange={(e) => setTablesSearch(e.target.value)}
                value={tablesSearch}
              />

              <div className='mt-2 overflow-y-scroll max-h-96 rounded'>
                {tablesToShow.length === 0 && <p>No tables found</p>}
                {sortedTables.map((table, idx) => (
                  <label key={table.table_name} className={clsx('cursor-pointer p-4 flex flex-row items-center gap-4', {
                    'bg-slate-300': idx % 2 !== 0,
                    'bg-slate-200': idx % 2 === 0,
                  })}>
                    <input
                      type='checkbox'
                      name='tables'
                      className='w-4 h-4'
                      value={table.table_name}
                      onChange={(e) => toggleTable(e, table.table_name)}
                      checked={selectedTables.includes(table.table_name)}
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

          <input type='hidden' name='cache' value={cache} />

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
        {results && tab === TAB_RESULTS &&
          <pre className='p-8 grow whitespace-pre-wrap max-h-screen overflow-y-scroll'>
            {results.error &&
              <div role='alert' className='p-4 rounded bg-red-200 text-red-800'>{results.error}</div>
            }
            {!results.error && results.data.csv}
          </pre>
        }
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
                  {copied ? 'Copied' : 'Copy CSV'}
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
