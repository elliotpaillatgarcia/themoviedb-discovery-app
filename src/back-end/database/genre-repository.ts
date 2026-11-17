import type { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
/**
 * Represents a genre in the database.
 */
export interface Genre {
  id: number;
  name: string;
}

export function parseGenresCsv(csv: string): Genre[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0] !== 'id,name') {
    throw new Error('Genres CSV must start with the "id,name" header');
  }

  return lines.slice(1).map((line, index) => {
    const [idText, name] = line.split(',');
    const id = Number(idText);
    if (!Number.isInteger(id) || id <= 0 || !name?.trim()) {
      throw new Error(`Invalid genre at CSV line ${index + 2}`);
    }
    return { id, name: name.trim() };
  });
}

export function findGenreById(
  database: DatabaseSync,
  id: number,
): Genre | undefined {
  return database
    .prepare('SELECT id, name FROM genres WHERE id = ?')
    .get(id) as Genre | undefined;
}

export function findAllGenres(database: DatabaseSync): Genre[] {
  return database
    .prepare('SELECT id, name FROM genres ORDER BY id')
    .all() as Genre[];
}

export function upsertGenre(database: DatabaseSync, genre: Genre): void {
  database
    .prepare(`
      INSERT INTO genres (id, name)
      VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name
    `)
    .run(genre.id, genre.name);
}

export function importGenresFromCsv(
  database: DatabaseSync,
  csvPath: string,
): number {
  const genres = parseGenresCsv(readFileSync(csvPath, 'utf8'));
  database.exec('BEGIN TRANSACTION');
  try {
    for (const genre of genres) {
      upsertGenre(database, genre);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return genres.length;
}

export function removeUnusedGenres(database: DatabaseSync): number {
  const result = database
    .prepare(`
      DELETE FROM genres
      WHERE NOT EXISTS (
        SELECT 1
        FROM movie_genres
        WHERE movie_genres.genre_id = genres.id
      )
    `)
    .run();
  return Number(result.changes);
}

export function removeGenresNotInCsv(
  database: DatabaseSync,
  genres: Genre[],
): number {
  const ids = genres.map(({ id }) => id);
  if (ids.length === 0) {
    return Number(
      database
        .prepare(
          `DELETE FROM genres
           WHERE NOT EXISTS (
             SELECT 1 FROM movie_genres
             WHERE movie_genres.genre_id = genres.id
           )`,
        )
        .run().changes,
    );
  }

  const placeholders = ids.map(() => '?').join(', ');
  const result = database
    .prepare(`
      DELETE FROM genres
      WHERE id NOT IN (${placeholders})
        AND NOT EXISTS (
          SELECT 1
          FROM movie_genres
          WHERE movie_genres.genre_id = genres.id
        )
    `)
    .run(...ids);
  return Number(result.changes);
}
