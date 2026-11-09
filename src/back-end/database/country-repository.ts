import type { DatabaseSync } from 'node:sqlite';
/**
 * Represents a Country in the database.
 */
export interface Country {
  code: string;
  name: string;
}

export function findCountryBycode(
  database: DatabaseSync,
  code: string,
): Country | undefined {
  return database
    .prepare('SELECT code, name FROM countries WHERE code = ?')
    .get(code) as Country | undefined;
}

export function findAllCountries(database: DatabaseSync): Country[] {
  return database
    .prepare('SELECT code, name FROM countries ORDER BY code')
    .all() as Country[];
}

export function upsertCountry(database: DatabaseSync, country: Country): void {
  database
    .prepare(`
      INSERT INTO countries (code, name)
      VALUES (?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name
    `)
    .run(country.code, country.name);
}
