create table lexicon_columns (
  column_name varchar(255),
  table_name varchar(255),
  description varchar(1024),
  primary key (column_name, table_name),
  foreign key (table_name) references lexicon_tables (table_name) 
);