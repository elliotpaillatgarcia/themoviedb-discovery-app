#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importMoviesFromCsv } from './database/movie-csv.ts';
import { DEFAULT_DATABASE_PATH, getDatabase } from './database/schema.ts';

/** Command-line interface for movie database operations. */
const program = new Command().description('CLI for movie database operations');

program
  .command('create-database')
  .description('Create and initialize the movies database schema')
  .option(
    '-p, --path <path>',
    'path to the SQLite database file',
    DEFAULT_DATABASE_PATH,
  )
  .action(({ path }: { path: string }) => {
    const database = getDatabase(path);
    database.close();
    console.log(`Database available at ${resolve(path)}`);
  });

program
  .command('add-movies')
  .description('Import and update movies from a CSV file')
  .argument('<csvPath>', 'path to the movies CSV file')
  .option(
    '-p, --path <path>',
    'path to the SQLite database file',
    DEFAULT_DATABASE_PATH,
  )
  .action((csvPath: string, { path }: { path: string }) => {
    const database = getDatabase(path);
    try {
      const importedCount = importMoviesFromCsv(
        database,
        readFileSync(csvPath, 'utf8'),
      );
      console.log(`${importedCount} movies imported into ${resolve(path)}`);
    } finally {
      database.close();
    }
  });

program.parse();
