create table openai_logs (
  id integer primary key autoincrement,
  tables varchar(1024),
  prompt varchar(1024),
  query varchar(1024),
  success tinyint,
  cache_enabled tinyint,
  tokens_used integer,
  created_at timestamp,
  last_used_at timestamp
);