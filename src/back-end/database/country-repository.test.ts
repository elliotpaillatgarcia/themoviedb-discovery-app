import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  findAllCountries,
  findCountryBycode,
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
});

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  initializeSchema(database);
  return database;
}
