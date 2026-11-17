import type { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
/**
 * Represents a Country in the database.
 */
export interface Country {
  code: string;
  name: string;
}

export function parseCountriesCsv(csv: string): Country[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0] !== 'code,name') {
    throw new Error('Countries CSV must start with the "code,name" header');
  }

  return lines.slice(1).map((line, index) => {
    const [codeText, name] = line.split(',');
    const code = codeText.trim();
    if (!/^[A-Z]{2}$/.test(code) || !name?.trim()) {
      throw new Error(`Invalid country at CSV line ${index + 2}`);
    }
    return { code, name: name.trim() };
  });
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

export function importCountriesFromCsv(
  database: DatabaseSync,
  csvPath: string,
): number {
  const countries = parseCountriesCsv(readFileSync(csvPath, 'utf8'));
  database.exec('BEGIN TRANSACTION');
  try {
    for (const country of countries) {
      upsertCountry(database, country);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return countries.length;
}

export function removeUnusedCountries(database: DatabaseSync): number {
  return Number(
    database
      .prepare(`
        DELETE FROM countries
        WHERE NOT EXISTS (
          SELECT 1
          FROM production_countries
          WHERE production_countries.country_code = countries.code
        )
      `)
      .run().changes,
  );
}

export function removeCountriesNotInCsv(
  database: DatabaseSync,
  countries: Country[],
): number {
  const codes = countries.map(({ code }) => code);
  if (codes.length === 0) {
    return removeUnusedCountries(database);
  }

  const placeholders = codes.map(() => '?').join(', ');
  return Number(
    database
      .prepare(`
        DELETE FROM countries
        WHERE code NOT IN (${placeholders})
          AND NOT EXISTS (
            SELECT 1
            FROM production_countries
            WHERE production_countries.country_code = countries.code
          )
      `)
      .run(...codes).changes,
  );
}
