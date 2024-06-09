
export default function ErrorMessage({ error }: { error: string }) {
  return <div role='alert' className='p-4 rounded bg-red-200 text-red-800'>{error}</div>
}
