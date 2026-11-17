import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  findAllGenres,
  findGenreById,
  importGenresFromCsv,
  parseGenresCsv,
  removeGenresNotInCsv,
  removeUnusedGenres,
  upsertGenre,
} from './genre-repository';
import { initializeSchema } from './schema';

describe('genre-repository', () => {
  it('finds a genre by identifier and returns undefined when it does not exist', () => {
    const database = createDatabase();
    upsertGenre(database, { id: 28, name: 'Action' });

    expect(findGenreById(database, 28)).toEqual({ id: 28, name: 'Action' });
    expect(findGenreById(database, 18)).toBeUndefined();
    database.close();
  });

  it('lists genres ordered by identifier', () => {
    const database = createDatabase();
    upsertGenre(database, { id: 28, name: 'Action' });
    upsertGenre(database, { id: 18, name: 'Drama' });

    expect(findAllGenres(database)).toEqual([
      { id: 18, name: 'Drama' },
      { id: 28, name: 'Action' },
    ]);
    database.close();
  });

  it('inserts a genre and updates its label on an existing identifier', () => {
    const database = createDatabase();

    upsertGenre(database, { id: 28, name: 'Action' });
    upsertGenre(database, { id: 28, name: 'Action updated' });

    expect(findGenreById(database, 28)).toEqual({
      id: 28,
      name: 'Action updated',
    });
    database.close();
  });

  it('rejects malformed CSV rows', () => {
    expect(() =>
      importGenresFromCsv(createDatabase(), '/missing.csv'),
    ).toThrow();
    expect(() => importGenresFromCsvFromContent('name\n28,Action')).toThrow(
      /"id,name" header/,
    );
    expect(() =>
      importGenresFromCsvFromContent('id,name\ninvalid,Action'),
    ).toThrow(/Invalid genre/);
  });

  it('imports genres from CSV and removes only unused genres', () => {
    const database = createDatabase();
    const directory = mkdtempSync(join(tmpdir(), 'genres-'));
    const csvPath = join(directory, 'genres.csv');
    writeFileSync(csvPath, 'id,name\n28,Action\n18,Drama');
    database
      .prepare('INSERT INTO genres (id, name) VALUES (?, ?)')
      .run(99, 'Unused');
    database
      .prepare(
        'INSERT INTO movies (id, title, original_title, original_language, overview, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Movie', 'Movie', 'en', '', '2026-01-01');
    database
      .prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)')
      .run(1, 99);

    try {
      expect(importGenresFromCsv(database, csvPath)).toBe(2);
      expect(removeUnusedGenres(database)).toBe(2);
      expect(findAllGenres(database)).toEqual([{ id: 99, name: 'Unused' }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      database.close();
    }
  });

  it('removes genres absent from the CSV while preserving linked genres', () => {
    const database = createDatabase();
    upsertGenre(database, { id: 18, name: 'Drama' });
    upsertGenre(database, { id: 28, name: 'Action' });
    upsertGenre(database, { id: 99, name: 'Documentary' });
    database
      .prepare(
        'INSERT INTO movies (id, title, original_title, original_language, overview, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Movie', 'Movie', 'en', '', '2026-01-01');
    database
      .prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)')
      .run(1, 18);

    expect(
      removeGenresNotInCsv(database, parseGenresCsv('id,name\n28,Action')),
    ).toBe(1);
    expect(findAllGenres(database)).toEqual([
      { id: 18, name: 'Drama' },
      { id: 28, name: 'Action' },
    ]);
    database.close();
  });

  it('removes all unlinked genres when the CSV is empty', () => {
    const database = createDatabase();
    upsertGenre(database, { id: 28, name: 'Action' });

    expect(removeGenresNotInCsv(database, [])).toBe(1);
    expect(findAllGenres(database)).toEqual([]);
    database.close();
  });

  it('rolls back a failed CSV import', () => {
    const database = createDatabase();
    const directory = mkdtempSync(join(tmpdir(), 'genres-'));
    const csvPath = join(directory, 'genres.csv');
    writeFileSync(csvPath, 'id,name\n28,Action');
    database.exec(`
      CREATE TRIGGER reject_genre BEFORE INSERT ON genres
      BEGIN
        SELECT RAISE(ABORT, 'genre rejected');
      END;
    `);

    try {
      expect(() => importGenresFromCsv(database, csvPath)).toThrow(
        /genre rejected/,
      );
      expect(findAllGenres(database)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      database.close();
    }
  });
});

function importGenresFromCsvFromContent(content: string): number {
  const directory = mkdtempSync(join(tmpdir(), 'genres-'));
  const csvPath = join(directory, 'genres.csv');
  const database = createDatabase();
  writeFileSync(csvPath, content);
  try {
    return importGenresFromCsv(database, csvPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    database.close();
  }
}

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  initializeSchema(database);
  return database;
}
