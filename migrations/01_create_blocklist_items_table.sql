create table blocklist_items (
  table_name varchar(255),
  column_name varchar(255),
  primary key (column_name, table_name)
);