import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMovieById } from './movie-repository';
import { importMoviesFromCsv, parseMoviesCsv } from './movie-csv';
import { initializeSchema } from './schema';

const headers =
  'id,title,original_title,original_language,overview,release_date,popularity,vote_average,vote_count,poster_path,backdrop_path,runtime,budget,revenue,genres,production_countries';
const csv = `${headers}\n42,"The, Answer",The Answer,en,Overview,2024-01-15,10.5,7.5,100,/poster.jpg,/backdrop.jpg,120,1000000,2000000,"[28]","[{""iso_3166_1"":""US""}]"`;

describe('movie-csv', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    initializeSchema(database);
  });

  afterEach(() => {
    database.close();
  });

  it('parses quoted fields, empty values, and movie numeric fields', () => {
    // Arrange
    const content = [
      headers,
      [
        '7',
        'Movie',
        'Movie',
        'fr',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '[]',
        '[]',
      ].join(','),
    ].join('\n');

    // Act
    const [movie] = parseMoviesCsv(content, '2026-01-01T00:00:00Z');

    // Assert
    expect(movie).toEqual({
      id: 7,
      title: 'Movie',
      original_title: 'Movie',
      original_language: 'fr',
      overview: '',
      release_date: null,
      popularity: null,
      vote_average: null,
      vote_count: null,
      poster_path: null,
      backdrop_path: null,
      runtime_minutes: null,
      budget: null,
      revenue: null,
      collected_at: '2026-01-01T00:00:00Z',
    });
  });

  it('handles Windows line endings and ignores empty rows', () => {
    // Arrange
    const content = `${headers}\r\n\r\n,`;

    // Act
    const movies = parseMoviesCsv(content);

    // Assert
    expect(movies).toEqual([]);
  });

  it('imports movies and updates existing rows through the repository', () => {
    // Arrange
    importMoviesFromCsv(database, csv, '2026-01-01T00:00:00Z');
    const updatedCsv = csv.replace('The, Answer', 'Updated title');

    // Act
    const importedCount = importMoviesFromCsv(
      database,
      updatedCsv,
      '2026-01-02T00:00:00Z',
    );

    // Assert
    expect(importedCount).toBe(1);
    expect(getMovieById(database, 42)).toMatchObject({
      title: 'Updated title',
      collected_at: '2026-01-02T00:00:00Z',
    });
  });

  it('rejects invalid headers, rows, and numeric values before writing', () => {
    // Arrange, Act, and Assert
    expect(() => parseMoviesCsv('')).toThrow(/CSV headers must contain/);
    expect(() => parseMoviesCsv('wrong,headers\n1,Movie')).toThrow(
      /CSV headers must contain/,
    );
    expect(() =>
      parseMoviesCsv(`${headers.replace('id,', 'movie_id,')}\n1,Movie`),
    ).toThrow(/CSV headers must contain/);
    expect(() => parseMoviesCsv(`${headers}\n1,Movie`)).toThrow(
      /invalid number of columns/,
    );
    expect(() =>
      parseMoviesCsv(`${headers}\nnot-a-number,Movie,,,,,,,,,,,,,,`),
    ).toThrow(/Invalid id value/);
    expect(() => parseMoviesCsv(`${headers}\n,Movie,,,,,,,,,,,,,,`)).toThrow(
      /id cannot be empty/,
    );
    expect(() => parseMoviesCsv(`${headers}\n1.5,Movie,,,,,,,,,,,,,,`)).toThrow(
      /Invalid id value/,
    );
    expect(() => parseMoviesCsv(`${headers}\n-1,Movie,,,,,,,,,,,,,,`)).toThrow(
      /Invalid id value/,
    );
    expect(() =>
      parseMoviesCsv(`${headers}\n1,Movie,,,,not-a-date,invalid,,,,,,,,,`),
    ).toThrow(/Invalid popularity value/);
  });

  it('rejects an unterminated quoted field', () => {
    // Arrange, Act, and Assert
    expect(() => parseMoviesCsv(`${headers}\n1,"Movie`)).toThrow(
      /unterminated quoted field/,
    );
  });
});
