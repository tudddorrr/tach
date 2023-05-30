import type { LexiconTable } from '~/models/lexicon_table.server'
import type { LexiconColumn } from '~/models/lexicon_column.server'
import type { OpenAILog } from '~/models/openai_log.server'
import type { BlocklistItem } from '~/models/blocklist_item.server'

export type Database = {
  blocklist_items: BlocklistItem
  lexicon_columns: LexiconColumn
  lexicon_tables: LexiconTable
  openai_logs: OpenAILog
}
