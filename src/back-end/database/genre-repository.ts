import type { DatabaseSync } from 'node:sqlite';
/**
 * Represents a genre in the database.
 */
export interface Genre {
  id: number;
  name: string;
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
