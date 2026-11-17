import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  findAllCountries,
  findCountryBycode,
  importCountriesFromCsv,
  parseCountriesCsv,
  removeCountriesNotInCsv,
  removeUnusedCountries,
  upsertCountry,
} from './country-repository';
import { initializeSchema } from './schema';

describe('country-repository', () => {
  it('finds a country by identifier and returns undefined when it does not exist', () => {
    const database = createDatabase();
    upsertCountry(database, { code: 'FR', name: 'France' });

    expect(findCountryBycode(database, 'FR')).toEqual({
      code: 'FR',
      name: 'France',
    });
    expect(findCountryBycode(database, 'PT')).toBeUndefined();
    database.close();
  });

  it('lists Countrys ordered by identifier', () => {
    const database = createDatabase();
    upsertCountry(database, { code: 'FR', name: 'France' });
    upsertCountry(database, { code: 'PT', name: 'Portugal' });

    expect(findAllCountries(database)).toEqual([
      { code: 'FR', name: 'France' },
      { code: 'PT', name: 'Portugal' },
    ]);
    database.close();
  });

  it('inserts a Country and updates its label on an existing identifier', () => {
    const database = createDatabase();

    upsertCountry(database, { code: 'FR', name: 'France' });
    upsertCountry(database, { code: 'FR', name: 'France outremer' });

    expect(findCountryBycode(database, 'FR')).toEqual({
      code: 'FR',
      name: 'France outremer',
    });
    database.close();
  });

  it('imports CSV countries and removes unreferenced countries', () => {
    const database = createDatabase();
    const directory = mkdtempSync(join(tmpdir(), 'countries-'));
    const csvPath = join(directory, 'countries.csv');
    writeFileSync(csvPath, 'code,name\nFR,France\nPT,Portugal');
    upsertCountry(database, { code: 'US', name: 'United States' });
    addMovieCountry(database, 'US');

    try {
      expect(importCountriesFromCsv(database, csvPath)).toBe(2);
      upsertCountry(database, { code: 'CA', name: 'Canada' });
      expect(removeUnusedCountries(database)).toBe(3);
      expect(findAllCountries(database)).toEqual([
        { code: 'US', name: 'United States' },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      database.close();
    }
  });

  it('removes unreferenced countries absent from the CSV', () => {
    const database = createDatabase();
    upsertCountry(database, { code: 'FR', name: 'France' });
    upsertCountry(database, { code: 'PT', name: 'Portugal' });
    addMovieCountry(database, 'FR');

    expect(
      removeCountriesNotInCsv(
        database,
        parseCountriesCsv('code,name\nPT,Portugal'),
      ),
    ).toBe(0);
    expect(findAllCountries(database)).toEqual([
      { code: 'FR', name: 'France' },
      { code: 'PT', name: 'Portugal' },
    ]);
    database.close();
  });

  it('removes all unreferenced countries for an empty CSV', () => {
    const database = createDatabase();
    upsertCountry(database, { code: 'PT', name: 'Portugal' });

    expect(removeCountriesNotInCsv(database, [])).toBe(1);
    expect(findAllCountries(database)).toEqual([]);
    database.close();
  });

  it('rejects malformed CSV rows and rolls back failed imports', () => {
    expect(() => parseCountriesCsv('name\nFR,France')).toThrow(/"code,name"/);
    expect(() => parseCountriesCsv('code,name\nFrance,France')).toThrow(
      /Invalid country/,
    );

    const database = createDatabase();
    const directory = mkdtempSync(join(tmpdir(), 'countries-'));
    const csvPath = join(directory, 'countries.csv');
    writeFileSync(csvPath, 'code,name\nFR,France');
    database.exec(`
      CREATE TRIGGER reject_country BEFORE INSERT ON countries
      BEGIN
        SELECT RAISE(ABORT, 'country rejected');
      END;
    `);
    try {
      expect(() => importCountriesFromCsv(database, csvPath)).toThrow(
        /country rejected/,
      );
      expect(findAllCountries(database)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      database.close();
    }
  });
});

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  initializeSchema(database);
  return database;
}

function addMovieCountry(database: DatabaseSync, code: string): void {
  database
    .prepare(
      'INSERT INTO movies (id, title, original_title, original_language, overview, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(1, 'Movie', 'Movie', 'en', '', '2026-01-01');
  database
    .prepare(
      'INSERT INTO production_countries (movie_id, country_code) VALUES (?, ?)',
    )
    .run(1, code);
}
